/**
 * Semantic / Market Search
 *
 * Architecture:
 * - searchableText field on Project, CurrentShow, Article stores concatenated
 *   text for fast keyword/fuzzy matching.
 * - When an embeddings API is available, embeddingStatus tracks whether a
 *   vector has been stored externally (future: pgvector or Pinecone).
 * - Fallback: keyword/fuzzy search using ILIKE (Postgres) or JS string matching.
 * - Never breaks search when embeddings are unavailable.
 */

import { prisma } from "@/lib/prisma";
import { logOperationalEvent } from "@/lib/ops-log";
import { canUseMockPreview } from "@/lib/runtime-mode";
import { mockSemanticSearchResults } from "@/lib/mock-semantic-search";

// ─── Searchable text builders ────────────────────────────────────────────────

type ProjectLike = {
  title: string;
  aliases?: string | null;
  logline?: string | null;
  genre?: string | null;
  format?: string | null;
  source_material?: string | null;
  tags?: string | null;
  notes?: string | null;
  networkOrPlatform?: string | null;
  countryOfOrigin?: string | null;
  confidenceReasons?: string | null;
  buyer?: { name: string } | null;
  studio?: { name: string } | null;
  productionCompanies?: { name: string }[];
  people?: { name: string; role: string }[];
};

type CurrentShowLike = {
  title: string;
  aliases?: string | null;
  networkOrPlatform: string;
  genre?: string | null;
  studio?: string | null;
  productionCompanies?: string | null;
  country?: string | null;
  tags?: string | null;
  notes?: string | null;
  status: string;
};

type ArticleLike = {
  headline: string;
  summary?: string | null;
  extractedText?: string | null;
  extractedExcerpt?: string | null;
  extractedLogline?: string | null;
  extractedGenre?: string | null;
  extractedProjectTitle?: string | null;
  extractedBuyer?: string | null;
  extractedStudio?: string | null;
  extractedPeople?: string | null;
  extractedCompanies?: string | null;
  publication?: string | null;
  tags?: string | null;
};

export function buildProjectSearchableText(p: ProjectLike): string {
  const parts = [
    p.title,
    p.aliases,
    p.logline,
    p.genre,
    p.format,
    p.source_material,
    p.tags,
    p.notes,
    p.networkOrPlatform,
    p.countryOfOrigin,
    p.buyer?.name,
    p.studio?.name,
    ...(p.productionCompanies ?? []).map((c) => c.name),
    ...(p.people ?? []).map((person) => `${person.name} ${person.role}`),
  ];
  return parts
    .filter(Boolean)
    .join(" ")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

export function buildCurrentShowSearchableText(s: CurrentShowLike): string {
  const parts = [
    s.title,
    s.aliases,
    s.networkOrPlatform,
    s.genre,
    s.studio,
    s.productionCompanies,
    s.country,
    s.tags,
    s.notes,
    s.status,
  ];
  return parts
    .filter(Boolean)
    .join(" ")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

export function buildArticleSearchableText(a: ArticleLike): string {
  const parts = [
    a.headline,
    a.summary,
    a.extractedProjectTitle,
    a.extractedLogline,
    a.extractedGenre,
    a.extractedBuyer,
    a.extractedStudio,
    a.extractedPeople,
    a.extractedCompanies,
    // Use a truncated excerpt for search (not full body — too large)
    (a.extractedExcerpt ?? a.extractedText ?? "").slice(0, 2000),
    a.publication,
    a.tags,
  ];
  return parts
    .filter(Boolean)
    .join(" ")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

// ─── Index / rebuild searchable text ─────────────────────────────────────────

export async function indexProjectSearchableText(id: string): Promise<void> {
  const project = await prisma.project.findUnique({
    where: { id },
    include: { buyer: true, studio: true, productionCompanies: true, people: true },
  });
  if (!project) return;

  const text = buildProjectSearchableText(project);
  await prisma.project.update({
    where: { id },
    data: {
      searchableText: text,
      embeddingStatus: "indexed",
      lastIndexedAt: new Date(),
    },
  });
}

export async function indexCurrentShowSearchableText(id: string): Promise<void> {
  const show = await prisma.currentShow.findUnique({ where: { id } });
  if (!show) return;

  const text = buildCurrentShowSearchableText(show);
  await prisma.currentShow.update({
    where: { id },
    data: {
      searchableText: text,
      embeddingStatus: "indexed",
      lastIndexedAt: new Date(),
    },
  });
}

export async function indexArticleSearchableText(id: string): Promise<void> {
  const article = await prisma.article.findUnique({ where: { id } });
  if (!article) return;

  const text = buildArticleSearchableText(article);
  await prisma.article.update({
    where: { id },
    data: {
      searchableText: text,
      embeddingStatus: "indexed",
      lastIndexedAt: new Date(),
    },
  });
}

// ─── Search types ─────────────────────────────────────────────────────────────

export type SearchResultKind = "project" | "current_show" | "article";

export type SearchResult = {
  id: string;
  kind: SearchResultKind;
  title: string;
  subtitle: string;
  matchType: "exact_title" | "logline_topic" | "genre_theme" | "development_history" | "company_person";
  matchScore: number;
  confidenceScore?: number | null;
  confidenceLevel?: string | null;
  status?: string | null;
  genre?: string | null;
  buyer?: string | null;
  sourceUrl?: string | null;
  publication?: string | null;
  publishedDate?: Date | string | null;
  isAutoCreated?: boolean;
  needsReview?: boolean;
  snippet?: string | null;
};

export type SearchOptions = {
  query: string;
  includeProjects?: boolean;
  includeShows?: boolean;
  includeArticles?: boolean;
  maxResults?: number;
  minScore?: number;
};

// ─── Keyword/fuzzy matching ───────────────────────────────────────────────────

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .split(/\W+/)
    .filter((t) => t.length > 2);
}

function scoreMatch(searchText: string, queryTokens: string[], query: string): number {
  if (!searchText) return 0;
  const lower = searchText.toLowerCase();
  let score = 0;
  if (lower.includes(query.toLowerCase())) score += 0.6;
  const textTokens = new Set(tokenize(searchText));
  let tokenMatches = 0;
  for (const token of queryTokens) {
    if (textTokens.has(token)) tokenMatches++;
    else {
      for (const t of textTokens) {
        if (t.includes(token) || token.includes(t)) { tokenMatches += 0.5; break; }
      }
    }
  }
  if (queryTokens.length > 0) score += (tokenMatches / queryTokens.length) * 0.4;
  return Math.min(1, score);
}

function inferMatchType(
  score: number,
  field: "title" | "logline" | "genre" | "history" | "company"
): SearchResult["matchType"] {
  if (field === "title") return score > 0.5 ? "exact_title" : "logline_topic";
  if (field === "logline") return "logline_topic";
  if (field === "genre") return "genre_theme";
  if (field === "history") return "development_history";
  return "company_person";
}

function buildSnippet(searchableText: string | null | undefined, query: string): string | null {
  if (!searchableText) return null;
  const idx = searchableText.toLowerCase().indexOf(query.toLowerCase());
  if (idx === -1) return searchableText.slice(0, 120) + "…";
  const start = Math.max(0, idx - 40);
  const end = Math.min(searchableText.length, idx + query.length + 80);
  const prefix = start > 0 ? "…" : "";
  const suffix = end < searchableText.length ? "…" : "";
  return prefix + searchableText.slice(start, end) + suffix;
}

// ─── Database search ──────────────────────────────────────────────────────────

async function searchProjects(
  queryTokens: string[],
  rawQuery: string,
  max: number
): Promise<SearchResult[]> {
  // Use Postgres ILIKE search across indexed fields
  const whereClause = queryTokens.length > 0
    ? {
        OR: [
          { title: { contains: rawQuery, mode: "insensitive" as const } },
          { logline: { contains: rawQuery, mode: "insensitive" as const } },
          { genre: { contains: rawQuery, mode: "insensitive" as const } },
          { tags: { contains: rawQuery, mode: "insensitive" as const } },
          { notes: { contains: rawQuery, mode: "insensitive" as const } },
          { source_material: { contains: rawQuery, mode: "insensitive" as const } },
          { searchableText: { contains: rawQuery, mode: "insensitive" as const } },
          // Also try first token for partial matches
          ...(queryTokens.length > 1
            ? queryTokens.slice(0, 3).map((t) => ({
                searchableText: { contains: t, mode: "insensitive" as const },
              }))
            : []),
        ],
        archivedAt: null,
      }
    : { archivedAt: null };

  const projects = await prisma.project.findMany({
    where: whereClause,
    include: { buyer: true },
    take: max * 2,
    orderBy: [{ confidenceScore: "desc" }, { updatedAt: "desc" }],
  });

  return projects
    .map((p) => {
      const titleScore = scoreMatch(p.title, queryTokens, rawQuery);
      const loglineScore = scoreMatch(p.logline ?? "", queryTokens, rawQuery);
      const genreScore = scoreMatch(p.genre ?? "", queryTokens, rawQuery);
      const searchScore = scoreMatch(p.searchableText ?? "", queryTokens, rawQuery);
      const best = Math.max(titleScore, loglineScore, genreScore, searchScore);

      const dominantField = titleScore >= loglineScore && titleScore >= genreScore ? "title"
        : loglineScore >= genreScore ? "logline"
        : "genre";

      return {
        id: p.id,
        kind: "project" as const,
        title: p.title,
        subtitle: `${p.buyer?.name ?? p.networkOrPlatform ?? "Unknown buyer"} · ${p.status ?? "unknown"}`,
        matchType: inferMatchType(titleScore, dominantField as "title" | "logline" | "genre"),
        matchScore: best,
        confidenceScore: p.confidenceScore,
        confidenceLevel: p.confidenceLevel,
        status: p.status,
        genre: p.genre,
        buyer: p.buyer?.name ?? p.networkOrPlatform ?? null,
        sourceUrl: p.sourceUrl,
        isAutoCreated: p.autoCreated,
        needsReview: p.needsReview,
        snippet: buildSnippet(p.searchableText ?? p.logline, rawQuery),
      };
    })
    .filter((r) => r.matchScore > 0.1)
    .sort((a, b) => b.matchScore - a.matchScore)
    .slice(0, max);
}

async function searchCurrentShows(
  queryTokens: string[],
  rawQuery: string,
  max: number
): Promise<SearchResult[]> {
  const shows = await prisma.currentShow.findMany({
    where: {
      OR: [
        { title: { contains: rawQuery, mode: "insensitive" as const } },
        { genre: { contains: rawQuery, mode: "insensitive" as const } },
        { networkOrPlatform: { contains: rawQuery, mode: "insensitive" as const } },
        { tags: { contains: rawQuery, mode: "insensitive" as const } },
        { searchableText: { contains: rawQuery, mode: "insensitive" as const } },
        ...(queryTokens.slice(0, 3).map((t) => ({
          searchableText: { contains: t, mode: "insensitive" as const },
        }))),
      ],
      archivedAt: null,
    },
    take: max * 2,
    orderBy: [{ confidenceScore: "desc" }, { updatedAt: "desc" }],
  });

  return shows
    .map((s) => {
      const titleScore = scoreMatch(s.title, queryTokens, rawQuery);
      const genreScore = scoreMatch(s.genre ?? "", queryTokens, rawQuery);
      const searchScore = scoreMatch(s.searchableText ?? "", queryTokens, rawQuery);
      const best = Math.max(titleScore, genreScore, searchScore);

      return {
        id: s.id,
        kind: "current_show" as const,
        title: s.title,
        subtitle: `${s.networkOrPlatform} · ${s.status}`,
        matchType: "genre_theme" as const,
        matchScore: best,
        confidenceScore: s.confidenceScore,
        confidenceLevel: s.confidenceLevel,
        status: s.status,
        genre: s.genre,
        buyer: s.networkOrPlatform,
        sourceUrl: s.sourceUrl,
        isAutoCreated: s.autoCreated,
        needsReview: s.needsVerification,
        snippet: buildSnippet(s.searchableText, rawQuery),
      };
    })
    .filter((r) => r.matchScore > 0.1)
    .sort((a, b) => b.matchScore - a.matchScore)
    .slice(0, max);
}

async function searchArticles(
  queryTokens: string[],
  rawQuery: string,
  max: number
): Promise<SearchResult[]> {
  const articles = await prisma.article.findMany({
    where: {
      OR: [
        { headline: { contains: rawQuery, mode: "insensitive" as const } },
        { summary: { contains: rawQuery, mode: "insensitive" as const } },
        { extractedProjectTitle: { contains: rawQuery, mode: "insensitive" as const } },
        { extractedLogline: { contains: rawQuery, mode: "insensitive" as const } },
        { extractedGenre: { contains: rawQuery, mode: "insensitive" as const } },
        { tags: { contains: rawQuery, mode: "insensitive" as const } },
        { searchableText: { contains: rawQuery, mode: "insensitive" as const } },
        ...(queryTokens.slice(0, 3).map((t) => ({
          searchableText: { contains: t, mode: "insensitive" as const },
        }))),
      ],
      archivedAt: null,
    },
    take: max * 2,
    orderBy: [{ publishedDate: "desc" }, { createdAt: "desc" }],
  });

  return articles
    .map((a) => {
      const titleScore = scoreMatch(a.headline, queryTokens, rawQuery);
      const loglineScore = scoreMatch(a.extractedLogline ?? "", queryTokens, rawQuery);
      const searchScore = scoreMatch(a.searchableText ?? "", queryTokens, rawQuery);
      const best = Math.max(titleScore, loglineScore, searchScore);

      return {
        id: a.id,
        kind: "article" as const,
        title: a.headline,
        subtitle: `${a.publication ?? "Unknown"} · ${a.publishedDate ? new Date(a.publishedDate).toLocaleDateString() : "Unknown date"}`,
        matchType: "logline_topic" as const,
        matchScore: best,
        confidenceScore: a.confidenceScore,
        confidenceLevel: null,
        status: a.extractionStatus,
        genre: a.extractedGenre,
        buyer: a.extractedBuyer,
        sourceUrl: a.url,
        publication: a.publication,
        publishedDate: a.publishedDate,
        needsReview: a.needsReview,
        snippet: buildSnippet(a.searchableText ?? a.summary, rawQuery),
      };
    })
    .filter((r) => r.matchScore > 0.1)
    .sort((a, b) => b.matchScore - a.matchScore)
    .slice(0, max);
}

// ─── Main search entry point ──────────────────────────────────────────────────

export async function marketSearch(options: SearchOptions): Promise<SearchResult[]> {
  const {
    query,
    includeProjects = true,
    includeShows = true,
    includeArticles = true,
    maxResults = 40,
    minScore = 0.05,
  } = options;

  if (!query.trim()) return [];

  const rawQuery = query.trim();
  const queryTokens = tokenize(rawQuery);
  const perType = Math.ceil(maxResults / 3);

  // Mock mode
  if (canUseMockPreview()) {
    try {
      const db = await prisma.project.count().catch(() => -1);
      if (db === 0 || db === -1) {
        return mockSemanticSearchResults(rawQuery);
      }
    } catch {
      return mockSemanticSearchResults(rawQuery);
    }
  }

  try {
    const [projectResults, showResults, articleResults] = await Promise.all([
      includeProjects ? searchProjects(queryTokens, rawQuery, perType) : Promise.resolve([]),
      includeShows ? searchCurrentShows(queryTokens, rawQuery, perType) : Promise.resolve([]),
      includeArticles ? searchArticles(queryTokens, rawQuery, perType) : Promise.resolve([]),
    ]);

    const combined = [...projectResults, ...showResults, ...articleResults]
      .filter((r) => r.matchScore >= minScore)
      .sort((a, b) => {
        // Projects and shows first, then articles
        const kindOrder = { project: 0, current_show: 1, article: 2 };
        const kindDiff = kindOrder[a.kind] - kindOrder[b.kind];
        if (Math.abs(kindDiff) > 0 && Math.abs(a.matchScore - b.matchScore) < 0.15) return kindDiff;
        return b.matchScore - a.matchScore;
      })
      .slice(0, maxResults);

    // Log the search query
    await prisma.searchLog.create({
      data: {
        query: rawQuery,
        resultCount: combined.length,
        filters: JSON.stringify({ includeProjects, includeShows, includeArticles }),
      },
    }).catch(() => undefined);

    logOperationalEvent("info", `Market search: "${rawQuery}" → ${combined.length} results`);
    return combined;
  } catch (err) {
    logOperationalEvent("error", "Market search failed, falling back to mock", { error: String(err) });
    return mockSemanticSearchResults(rawQuery);
  }
}

// ─── Rebuild all searchable text (admin / cron) ───────────────────────────────

export async function rebuildAllSearchableText(): Promise<{
  projects: number;
  shows: number;
  articles: number;
}> {
  let projects = 0;
  let shows = 0;
  let articles = 0;

  // Process in batches of 100
  let cursor: string | undefined;
  while (true) {
    let projectBatch: Awaited<ReturnType<typeof prisma.project.findMany>>;
    if (cursor) {
      projectBatch = await prisma.project.findMany({ take: 100, skip: 1, cursor: { id: cursor }, include: { buyer: true, studio: true, productionCompanies: true, people: true }, orderBy: { id: "asc" } });
    } else {
      projectBatch = await prisma.project.findMany({ take: 100, include: { buyer: true, studio: true, productionCompanies: true, people: true }, orderBy: { id: "asc" } });
    }
    if (!projectBatch.length) break;

    for (const p of projectBatch) {
      const text = buildProjectSearchableText(p);
      await prisma.project.update({
        where: { id: p.id },
        data: { searchableText: text, embeddingStatus: "indexed", lastIndexedAt: new Date() },
      });
      projects++;
    }
    cursor = projectBatch[projectBatch.length - 1].id;
  }

  cursor = undefined;
  while (true) {
    let showBatch: Awaited<ReturnType<typeof prisma.currentShow.findMany>>;
    if (cursor) {
      showBatch = await prisma.currentShow.findMany({ take: 100, skip: 1, cursor: { id: cursor }, orderBy: { id: "asc" } });
    } else {
      showBatch = await prisma.currentShow.findMany({ take: 100, orderBy: { id: "asc" } });
    }
    if (!showBatch.length) break;

    for (const s of showBatch) {
      const text = buildCurrentShowSearchableText(s);
      await prisma.currentShow.update({
        where: { id: s.id },
        data: { searchableText: text, embeddingStatus: "indexed", lastIndexedAt: new Date() },
      });
      shows++;
    }
    cursor = showBatch[showBatch.length - 1].id;
  }

  cursor = undefined;
  while (true) {
    let articleBatch: Awaited<ReturnType<typeof prisma.article.findMany>>;
    if (cursor) {
      articleBatch = await prisma.article.findMany({ take: 100, skip: 1, cursor: { id: cursor }, orderBy: { id: "asc" } });
    } else {
      articleBatch = await prisma.article.findMany({ take: 100, orderBy: { id: "asc" } });
    }
    if (!articleBatch.length) break;

    for (const a of articleBatch) {
      const text = buildArticleSearchableText(a);
      await prisma.article.update({
        where: { id: a.id },
        data: { searchableText: text, embeddingStatus: "indexed", lastIndexedAt: new Date() },
      });
      articles++;
    }
    cursor = articleBatch[articleBatch.length - 1].id;
  }

  logOperationalEvent("info", "Rebuilt all searchable text", { projects, shows, articles });
  return { projects, shows, articles };
}
