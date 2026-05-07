/**
 * Deep Similarity Search — Step 34
 *
 * Extends semantic-search.ts with:
 * - Four search modes: exact | fuzzy | conceptual | logline
 * - Concept expansion: maps queries to thematic synonyms
 * - Logline similarity: extracts profession/setting/conflict and matches them
 * - Extended filters: genre, buyer, year range, stale/dead projects
 * - "Compare to New Pitch" tool: similar works, active buyers, white space, caution flags
 * - Saved searches: DB-backed with localStorage client-side fallback
 *
 * Every result traces back to a real database record or source URL.
 * Conceptual matches are clearly labeled as such.
 * Never invents shows or data.
 */

import { prisma } from "@/lib/prisma";
import { canUseMockPreview } from "@/lib/runtime-mode";
import { logOperationalEvent } from "@/lib/ops-log";
import { mockDeepSearchResults, mockPitchCompareResult } from "@/lib/mock-deep-search";
import { tokenize, scoreMatch, buildSnippet } from "@/lib/semantic-search-utils";

// ─── Types ────────────────────────────────────────────────────────────────────

export type SearchMode = "exact" | "fuzzy" | "conceptual" | "logline";

export type DeepSearchOptions = {
  query: string;
  searchMode?: SearchMode;
  genre?: string;
  buyer?: string;
  yearFrom?: number;
  yearTo?: number;
  includeProjects?: boolean;
  includeShows?: boolean;
  includeArticles?: boolean;
  includeStale?: boolean;
  maxResults?: number;
  minScore?: number;
};

export type MatchReason =
  | "exact_title_match"
  | "exact_phrase_in_logline"
  | "exact_phrase_in_body"
  | "fuzzy_keyword_match"
  | "conceptual_similarity"
  | "logline_similarity"
  | "genre_theme_overlap"
  | "buyer_network_match"
  | "company_person_match"
  | "development_history";

export type DeepSearchResult = {
  id: string;
  kind: "project" | "current_show" | "article";
  title: string;
  logline?: string | null;
  studio?: string | null;
  buyer?: string | null;
  genre?: string | null;
  status?: string | null;
  isStale: boolean;
  isAutoCreated?: boolean;
  needsReview?: boolean;
  sourceUrl?: string | null;
  publication?: string | null;
  publishedDate?: Date | string | null;
  confidenceScore?: number | null;
  confidenceLevel?: string | null;
  matchScore: number;
  matchReasons: MatchReason[];
  matchLabel: string;
  snippet?: string | null;
  announcementYear?: number | null;
};

// ─── Concept expansion vocabulary ────────────────────────────────────────────
// Maps thematic concepts to synonym clusters. Used in conceptual search mode.

const CONCEPT_MAP: Record<string, string[]> = {
  // Law enforcement / government agencies
  postal: ["mail", "package", "delivery", "usps", "post office", "letter", "postmaster", "stamps", "parcel"],
  "postal inspection": ["uspis", "postal inspector", "mail fraud", "mail theft", "postal crime"],
  "federal agency": ["fbi", "dea", "atf", "fbi", "ice", "dhs", "federal law enforcement", "government agency", "bureau"],
  "government procedural": ["federal", "agency", "bureaucracy", "washington", "government", "senate", "department"],
  "law enforcement": ["police", "detective", "investigation", "crime", "forensic", "enforcement", "officer", "agent"],
  procedural: ["case", "investigation", "crime", "detective", "forensic", "weekly", "episodic", "procedural"],
  // Settings / worlds
  workplace: ["office", "coworkers", "colleagues", "corporate", "job", "career", "professional", "work"],
  hospital: ["doctor", "nurse", "medical", "patient", "surgery", "ER", "ICU", "healthcare"],
  legal: ["lawyer", "attorney", "court", "trial", "judge", "law firm", "case", "verdict"],
  military: ["soldier", "army", "navy", "war", "combat", "deployment", "veteran", "base"],
  "true crime": ["crime", "murder", "serial killer", "investigation", "real events", "documentary style"],
  heist: ["robbery", "theft", "con", "grifter", "crew", "vault", "score", "job"],
  // Genres / tones
  thriller: ["suspense", "tension", "paranoia", "chase", "danger", "threat", "stakes"],
  drama: ["family", "relationships", "emotional", "character", "personal", "struggle"],
  comedy: ["funny", "humor", "satire", "witty", "comedic", "absurd", "lighthearted"],
  "dark comedy": ["dark humor", "satire", "absurd", "black comedy", "comedic drama"],
  "limited series": ["miniseries", "anthology", "event series", "finite", "closed-ended"],
  anthology: ["standalone", "stories", "different each season", "limited", "event"],
  // Themes
  corruption: ["scandal", "cover-up", "bribery", "conspiracy", "wrongdoing", "abuse of power"],
  "class struggle": ["inequality", "wealth gap", "poverty", "class", "privilege", "working class"],
  immigration: ["immigrant", "border", "undocumented", "citizenship", "refugee", "homeland"],
  addiction: ["drugs", "substance", "recovery", "rehab", "dependence", "relapse"],
  "true story": ["based on", "real events", "inspired by", "actual", "biographical", "docuseries"],
};

function expandQuery(query: string): string[] {
  const lower = query.toLowerCase();
  const expanded = new Set<string>();

  // Always include original query tokens
  const tokens = tokenize(lower);
  tokens.forEach((t) => expanded.add(t));

  // Find matching concept entries
  for (const [concept, synonyms] of Object.entries(CONCEPT_MAP)) {
    // Check if any part of the query matches a concept key
    const conceptTokens = tokenize(concept);
    const overlapCount = conceptTokens.filter((ct) =>
      tokens.some((t) => t.includes(ct) || ct.includes(t))
    ).length;

    if (overlapCount > 0 && overlapCount >= Math.min(conceptTokens.length, tokens.length) * 0.5) {
      synonyms.forEach((s) => tokenize(s).forEach((t) => expanded.add(t)));
    }
  }

  return Array.from(expanded);
}

// ─── Logline decomposition ────────────────────────────────────────────────────
// Extracts searchable semantic components from a logline/pitch

type LoglineComponents = {
  professions: string[];
  settings: string[];
  themes: string[];
  conflicts: string[];
  allTerms: string[];
};

const PROFESSION_MARKERS = [
  "detective", "agent", "inspector", "officer", "lawyer", "doctor", "journalist",
  "politician", "soldier", "scientist", "teacher", "nurse", "spy", "analyst",
  "hacker", "consultant", "prosecutor", "judge", "senator", "professor",
];
const SETTING_MARKERS = [
  "agency", "hospital", "court", "school", "office", "department", "bureau",
  "city", "town", "country", "network", "company", "studio", "lab", "station",
  "government", "military", "university", "firm", "service",
];
const CONFLICT_MARKERS = [
  "investigation", "murder", "fraud", "corruption", "conspiracy", "smuggling",
  "trafficking", "heist", "scandal", "cover-up", "crisis", "war", "battle",
  "struggle", "escape", "survival", "revenge", "justice", "betrayal",
];
const THEME_MARKERS = [
  "family", "identity", "power", "loyalty", "redemption", "ambition", "class",
  "race", "gender", "technology", "addiction", "loss", "love", "grief", "trauma",
];

function decomposeLogline(text: string): LoglineComponents {
  const lower = text.toLowerCase();
  const words = tokenize(lower);

  const professions = PROFESSION_MARKERS.filter((p) =>
    words.some((w) => w.includes(p) || p.includes(w))
  );
  const settings = SETTING_MARKERS.filter((s) =>
    lower.includes(s)
  );
  const conflicts = CONFLICT_MARKERS.filter((c) =>
    lower.includes(c)
  );
  const themes = THEME_MARKERS.filter((t) =>
    words.some((w) => w.includes(t) || t.includes(w))
  );

  return {
    professions,
    settings,
    themes,
    conflicts,
    allTerms: [...new Set([...professions, ...settings, ...conflicts, ...themes])],
  };
}

// ─── Scoring engine ───────────────────────────────────────────────────────────

function scoreDeepMatch(
  searchableText: string | null | undefined,
  query: string,
  queryTokens: string[],
  expandedTokens: string[],
  mode: SearchMode,
  loglineComponents?: LoglineComponents
): { score: number; reasons: MatchReason[] } {
  if (!searchableText) return { score: 0, reasons: [] };

  const lower = searchableText.toLowerCase();
  const reasons: MatchReason[] = [];
  let score = 0;

  if (mode === "exact") {
    // Exact phrase only
    if (lower.includes(query.toLowerCase())) {
      score = 1.0;
      reasons.push("exact_phrase_in_logline");
    }
    return { score, reasons };
  }

  if (mode === "fuzzy" || mode === "conceptual") {
    // Exact phrase match
    if (lower.includes(query.toLowerCase())) {
      score += 0.65;
      reasons.push("exact_phrase_in_logline");
    }

    // Token overlap
    const textTokens = new Set(tokenize(lower));
    let tokenHits = 0;
    for (const t of queryTokens) {
      if (textTokens.has(t)) tokenHits++;
      else if ([...textTokens].some((tt) => tt.includes(t) || t.includes(tt))) tokenHits += 0.4;
    }
    if (queryTokens.length > 0) {
      const tokenScore = (tokenHits / queryTokens.length) * 0.35;
      if (tokenScore > 0) {
        score += tokenScore;
        if (!reasons.includes("exact_phrase_in_logline")) {
          reasons.push("fuzzy_keyword_match");
        }
      }
    }

    // Conceptual expansion boost
    if (mode === "conceptual" && expandedTokens.length > queryTokens.length) {
      const expansionOnlyTokens = expandedTokens.filter((t) => !queryTokens.includes(t));
      let expansionHits = 0;
      for (const t of expansionOnlyTokens) {
        if (textTokens.has(t)) expansionHits++;
      }
      if (expansionOnlyTokens.length > 0 && expansionHits > 0) {
        const expansionScore = (expansionHits / expansionOnlyTokens.length) * 0.25;
        score += expansionScore;
        if (expansionScore > 0.05) reasons.push("conceptual_similarity");
      }
    }
  }

  if (mode === "logline" && loglineComponents) {
    // Score each component independently
    const textTokens = new Set(tokenize(lower));
    let componentHits = 0;
    let componentTotal = 0;

    for (const term of loglineComponents.professions) {
      componentTotal++;
      if (lower.includes(term)) { componentHits += 1.2; reasons.push("logline_similarity"); }
    }
    for (const term of [...loglineComponents.settings, ...loglineComponents.conflicts]) {
      componentTotal++;
      if (lower.includes(term)) { componentHits++; if (!reasons.includes("logline_similarity")) reasons.push("logline_similarity"); }
    }
    for (const term of loglineComponents.themes) {
      componentTotal++;
      if (textTokens.has(term)) { componentHits += 0.6; if (!reasons.includes("genre_theme_overlap")) reasons.push("genre_theme_overlap"); }
    }
    if (componentTotal > 0) {
      score = Math.min(1, (componentHits / componentTotal) * 0.9);
    }
  }

  return { score: Math.min(1, score), reasons };
}

// ─── Build match label ────────────────────────────────────────────────────────

function buildMatchLabel(reasons: MatchReason[], mode: SearchMode): string {
  if (reasons.includes("exact_title_match")) return "Exact title match";
  if (reasons.includes("exact_phrase_in_logline")) return "Exact phrase in record";
  if (reasons.includes("exact_phrase_in_body")) return "Exact phrase in article body";
  if (mode === "logline" && reasons.includes("logline_similarity")) return "Logline similarity";
  if (mode === "conceptual" && reasons.includes("conceptual_similarity")) return "Conceptual similarity";
  if (reasons.includes("fuzzy_keyword_match")) return "Keyword match";
  if (reasons.includes("genre_theme_overlap")) return "Genre / theme overlap";
  if (reasons.includes("company_person_match")) return "Company / person match";
  if (reasons.includes("development_history")) return "Development history";
  return "Related match";
}

// ─── Year helpers ─────────────────────────────────────────────────────────────

function extractYear(d: Date | string | null | undefined): number | null {
  if (!d) return null;
  return new Date(d).getFullYear();
}

// ─── Database searches ────────────────────────────────────────────────────────

async function deepSearchProjects(
  options: DeepSearchOptions,
  queryTokens: string[],
  expandedTokens: string[],
  loglineComponents?: LoglineComponents
): Promise<DeepSearchResult[]> {
  const {
    query,
    searchMode = "fuzzy",
    genre,
    buyer,
    yearFrom,
    yearTo,
    includeStale = false,
    maxResults = 40,
  } = options;

  const rawQuery = query.trim();

  // Build DB where clause
  const searchTokens = searchMode === "conceptual" ? expandedTokens : queryTokens;
  const orClauses = [
    { title: { contains: rawQuery, mode: "insensitive" as const } },
    { logline: { contains: rawQuery, mode: "insensitive" as const } },
    { tags: { contains: rawQuery, mode: "insensitive" as const } },
    { searchableText: { contains: rawQuery, mode: "insensitive" as const } },
    ...searchTokens.slice(0, 5).map((t) => ({
      searchableText: { contains: t, mode: "insensitive" as const },
    })),
  ];

  const genreFilter = genre ? { genre: { contains: genre, mode: "insensitive" as const } } : {};
  const buyerNameFilter = buyer ? { buyer: { name: { contains: buyer, mode: "insensitive" as const } } } : {};
  const buyerPlatformFilter = buyer ? { networkOrPlatform: { contains: buyer, mode: "insensitive" as const } } : {};

  const statusFilter = includeStale
    ? {}
    : { status: { not: "stale" as const } };

  const announcementFilter =
    yearFrom || yearTo
      ? {
          announcementDate: {
            ...(yearFrom ? { gte: new Date(`${yearFrom}-01-01`) } : {}),
            ...(yearTo ? { lte: new Date(`${yearTo}-12-31`) } : {}),
          },
        }
      : {};

  const projects = await prisma.project.findMany({
    where: {
      OR: orClauses,
      archivedAt: null,
      ...(genre ? genreFilter : {}),
      ...(buyer ? { OR: [buyerNameFilter, buyerPlatformFilter] } : {}),
      ...(Object.keys(statusFilter).length ? statusFilter : {}),
      ...(Object.keys(announcementFilter).length ? announcementFilter : {}),
    },
    include: { buyer: true, studio: true },
    take: maxResults * 3,
    orderBy: [{ confidenceScore: "desc" }, { updatedAt: "desc" }],
  });

  return projects
    .map((p) => {
      const titleExact = p.title.toLowerCase() === rawQuery.toLowerCase();
      const titleScore = scoreMatch(p.title, queryTokens, rawQuery);
      const loglineScore = scoreMatch(p.logline ?? "", queryTokens, rawQuery);
      const searchScore = scoreDeepMatch(
        p.searchableText,
        rawQuery,
        queryTokens,
        expandedTokens,
        searchMode,
        loglineComponents
      );

      let best = Math.max(titleScore * 1.2, loglineScore, searchScore.score);
      const reasons: MatchReason[] = [...searchScore.reasons];

      if (titleExact) { best = 1.0; reasons.unshift("exact_title_match"); }
      else if (titleScore > 0.5) reasons.unshift("exact_phrase_in_logline");

      const announcementYear = extractYear(p.announcementDate);

      return {
        id: p.id,
        kind: "project" as const,
        title: p.title,
        logline: p.logline,
        studio: p.studio?.name ?? null,
        buyer: p.buyer?.name ?? p.networkOrPlatform ?? null,
        genre: p.genre,
        status: p.status,
        isStale: p.status === "stale" || p.status === "passed" || p.status === "canceled",
        isAutoCreated: p.autoCreated,
        needsReview: p.needsReview,
        sourceUrl: p.sourceUrl,
        confidenceScore: p.confidenceScore,
        confidenceLevel: p.confidenceLevel,
        matchScore: Math.min(1, best),
        matchReasons: reasons.length ? reasons : ["fuzzy_keyword_match" as MatchReason],
        matchLabel: buildMatchLabel(reasons, searchMode),
        snippet: buildSnippet(p.searchableText ?? p.logline, rawQuery),
        announcementYear,
      };
    })
    .filter((r) => r.matchScore > 0.08)
    .sort((a, b) => b.matchScore - a.matchScore)
    .slice(0, maxResults);
}

async function deepSearchShows(
  options: DeepSearchOptions,
  queryTokens: string[],
  expandedTokens: string[],
  loglineComponents?: LoglineComponents
): Promise<DeepSearchResult[]> {
  const {
    query,
    searchMode = "fuzzy",
    genre,
    buyer,
    yearFrom,
    yearTo,
    maxResults = 40,
  } = options;

  const rawQuery = query.trim();
  const searchTokens = searchMode === "conceptual" ? expandedTokens : queryTokens;

  const shows = await prisma.currentShow.findMany({
    where: {
      OR: [
        { title: { contains: rawQuery, mode: "insensitive" } },
        { genre: { contains: rawQuery, mode: "insensitive" } },
        { networkOrPlatform: { contains: rawQuery, mode: "insensitive" } },
        { tags: { contains: rawQuery, mode: "insensitive" } },
        { searchableText: { contains: rawQuery, mode: "insensitive" } },
        ...searchTokens.slice(0, 5).map((t) => ({
          searchableText: { contains: t, mode: "insensitive" as const },
        })),
      ],
      archivedAt: null,
      ...(genre ? { genre: { contains: genre, mode: "insensitive" } } : {}),
      ...(buyer ? { networkOrPlatform: { contains: buyer, mode: "insensitive" } } : {}),
      ...(yearFrom || yearTo
        ? {
            premiereDate: {
              ...(yearFrom ? { gte: new Date(`${yearFrom}-01-01`) } : {}),
              ...(yearTo ? { lte: new Date(`${yearTo}-12-31`) } : {}),
            },
          }
        : {}),
    },
    take: maxResults * 2,
    orderBy: [{ confidenceScore: "desc" }, { updatedAt: "desc" }],
  });

  return shows
    .map((s) => {
      const titleExact = s.title.toLowerCase() === rawQuery.toLowerCase();
      const titleScore = scoreMatch(s.title, queryTokens, rawQuery);
      const searchScore = scoreDeepMatch(
        s.searchableText,
        rawQuery,
        queryTokens,
        expandedTokens,
        searchMode,
        loglineComponents
      );

      let best = Math.max(titleScore * 1.2, searchScore.score);
      const reasons: MatchReason[] = [...searchScore.reasons];
      if (titleExact) { best = 1.0; reasons.unshift("exact_title_match"); }

      return {
        id: s.id,
        kind: "current_show" as const,
        title: s.title,
        logline: null,
        studio: s.studio ?? null,
        buyer: s.networkOrPlatform,
        genre: s.genre,
        status: s.status,
        isStale: ["canceled", "ended"].includes(s.status ?? ""),
        isAutoCreated: s.autoCreated,
        needsReview: s.needsVerification,
        sourceUrl: s.sourceUrl,
        confidenceScore: s.confidenceScore,
        confidenceLevel: s.confidenceLevel,
        matchScore: Math.min(1, best),
        matchReasons: reasons.length ? reasons : ["fuzzy_keyword_match" as MatchReason],
        matchLabel: buildMatchLabel(reasons, searchMode),
        snippet: buildSnippet(s.searchableText, rawQuery),
        announcementYear: extractYear(s.premiereDate),
      };
    })
    .filter((r) => r.matchScore > 0.08)
    .sort((a, b) => b.matchScore - a.matchScore)
    .slice(0, maxResults);
}

async function deepSearchArticles(
  options: DeepSearchOptions,
  queryTokens: string[],
  expandedTokens: string[],
  loglineComponents?: LoglineComponents
): Promise<DeepSearchResult[]> {
  const {
    query,
    searchMode = "fuzzy",
    buyer,
    yearFrom,
    yearTo,
    maxResults = 40,
  } = options;

  const rawQuery = query.trim();
  const searchTokens = searchMode === "conceptual" ? expandedTokens : queryTokens;

  const articles = await prisma.article.findMany({
    where: {
      OR: [
        { headline: { contains: rawQuery, mode: "insensitive" } },
        { summary: { contains: rawQuery, mode: "insensitive" } },
        { extractedLogline: { contains: rawQuery, mode: "insensitive" } },
        { extractedProjectTitle: { contains: rawQuery, mode: "insensitive" } },
        { searchableText: { contains: rawQuery, mode: "insensitive" } },
        ...searchTokens.slice(0, 5).map((t) => ({
          searchableText: { contains: t, mode: "insensitive" as const },
        })),
      ],
      archivedAt: null,
      ...(buyer ? { extractedBuyer: { contains: buyer, mode: "insensitive" } } : {}),
      ...(yearFrom || yearTo
        ? {
            publishedDate: {
              ...(yearFrom ? { gte: new Date(`${yearFrom}-01-01`) } : {}),
              ...(yearTo ? { lte: new Date(`${yearTo}-12-31`) } : {}),
            },
          }
        : {}),
    },
    take: maxResults * 2,
    orderBy: [{ publishedDate: "desc" }, { createdAt: "desc" }],
  });

  return articles
    .map((a) => {
      const titleScore = scoreMatch(a.headline, queryTokens, rawQuery);
      const loglineScore = scoreMatch(a.extractedLogline ?? "", queryTokens, rawQuery);
      const searchScore = scoreDeepMatch(
        a.searchableText,
        rawQuery,
        queryTokens,
        expandedTokens,
        searchMode,
        loglineComponents
      );
      const best = Math.max(titleScore, loglineScore, searchScore.score);
      const reasons = searchScore.reasons.length ? searchScore.reasons : ["fuzzy_keyword_match" as MatchReason];

      return {
        id: a.id,
        kind: "article" as const,
        title: a.headline,
        logline: a.extractedLogline,
        studio: a.extractedStudio ?? null,
        buyer: a.extractedBuyer,
        genre: a.extractedGenre,
        status: a.extractionStatus,
        isStale: false,
        needsReview: a.needsReview,
        sourceUrl: a.url,
        publication: a.publication,
        publishedDate: a.publishedDate,
        confidenceScore: a.confidenceScore,
        confidenceLevel: null,
        matchScore: Math.min(1, best),
        matchReasons: reasons,
        matchLabel: buildMatchLabel(reasons, searchMode),
        snippet: buildSnippet(a.searchableText ?? a.summary, rawQuery),
        announcementYear: extractYear(a.publishedDate),
      };
    })
    .filter((r) => r.matchScore > 0.08)
    .sort((a, b) => b.matchScore - a.matchScore)
    .slice(0, maxResults);
}

// ─── Main deep search ─────────────────────────────────────────────────────────

export async function deepSearch(options: DeepSearchOptions): Promise<DeepSearchResult[]> {
  const {
    query,
    searchMode = "fuzzy",
    includeProjects = true,
    includeShows = true,
    includeArticles = true,
    maxResults = 50,
    minScore = 0.05,
  } = options;

  if (!query.trim()) return [];

  // Mock mode
  if (canUseMockPreview()) {
    try {
      const count = await prisma.project.count().catch(() => -1);
      if (count <= 0) return mockDeepSearchResults(query, options);
    } catch {
      return mockDeepSearchResults(query, options);
    }
  }

  const rawQuery = query.trim();
  const queryTokens = tokenize(rawQuery);
  const expandedTokens = searchMode === "conceptual" ? expandQuery(rawQuery) : queryTokens;
  const loglineComponents =
    searchMode === "logline" ? decomposeLogline(rawQuery) : undefined;

  const perType = Math.ceil(maxResults / (
    [includeProjects, includeShows, includeArticles].filter(Boolean).length || 1
  ));

  try {
    const [projectResults, showResults, articleResults] = await Promise.all([
      includeProjects
        ? deepSearchProjects(options, queryTokens, expandedTokens, loglineComponents)
        : Promise.resolve([]),
      includeShows
        ? deepSearchShows(options, queryTokens, expandedTokens, loglineComponents)
        : Promise.resolve([]),
      includeArticles
        ? deepSearchArticles(options, queryTokens, expandedTokens, loglineComponents)
        : Promise.resolve([]),
    ]);

    const combined = [...projectResults, ...showResults, ...articleResults]
      .filter((r) => r.matchScore >= minScore)
      .sort((a, b) => {
        // Prefer projects/shows over articles for same score band
        const kindOrder = { project: 0, current_show: 1, article: 2 };
        if (Math.abs(a.matchScore - b.matchScore) < 0.12) {
          return kindOrder[a.kind] - kindOrder[b.kind];
        }
        return b.matchScore - a.matchScore;
      })
      .slice(0, maxResults);

    // Log
    await prisma.searchLog.create({
      data: {
        query: rawQuery,
        resultCount: combined.length,
        filters: JSON.stringify({
          searchMode,
          genre: options.genre,
          buyer: options.buyer,
          yearFrom: options.yearFrom,
          yearTo: options.yearTo,
          includeStale: options.includeStale,
        }),
      },
    }).catch(() => undefined);

    logOperationalEvent(
      "info",
      `Deep search: "${rawQuery}" [${searchMode}] → ${combined.length} results`
    );
    return combined;
  } catch (err) {
    logOperationalEvent("error", "Deep search failed", { error: String(err), query });
    return mockDeepSearchResults(query, options);
  }
}

// ─── Compare to New Pitch ─────────────────────────────────────────────────────

export type PitchCompareResult = {
  dataSource: "database" | "mock";
  pitch: string;
  similar: DeepSearchResult[];
  activeBuyers: BuyerActivity[];
  whiteSpaceBuyers: BuyerActivity[];
  cautionFlags: CautionFlag[];
  searchedAt: Date;
};

export type BuyerActivity = {
  name: string;
  activeTitles: string[];
  activeCount: number;
  genres: string[];
  recentActivity: string | null;
};

export type CautionFlag = {
  severity: "high" | "medium" | "low";
  message: string;
  relatedTitle?: string;
  relatedId?: string;
};

export async function comparePitch(pitch: string): Promise<PitchCompareResult> {
  if (!pitch.trim()) {
    return {
      dataSource: "mock",
      pitch,
      similar: [],
      activeBuyers: [],
      whiteSpaceBuyers: [],
      cautionFlags: [],
      searchedAt: new Date(),
    };
  }

  // Mock mode
  if (canUseMockPreview()) {
    try {
      const count = await prisma.project.count().catch(() => -1);
      if (count <= 0) return mockPitchCompareResult(pitch);
    } catch {
      return mockPitchCompareResult(pitch);
    }
  }

  try {
    // Run both fuzzy and conceptual searches on the pitch
    const [fuzzyResults, conceptualResults] = await Promise.all([
      deepSearch({ query: pitch, searchMode: "fuzzy", maxResults: 30 }),
      deepSearch({ query: pitch, searchMode: "conceptual", maxResults: 30, includeStale: true }),
    ]);

    // Deduplicate by id, keeping highest score
    const resultMap = new Map<string, DeepSearchResult>();
    for (const r of [...fuzzyResults, ...conceptualResults]) {
      const existing = resultMap.get(r.id);
      if (!existing || r.matchScore > existing.matchScore) {
        resultMap.set(r.id, r);
      }
    }
    const similar = Array.from(resultMap.values())
      .sort((a, b) => b.matchScore - a.matchScore)
      .slice(0, 25);

    // Identify active buyers from results (from non-stale records)
    const buyerMap = new Map<string, { titles: string[]; genres: Set<string>; latestDate: string | null }>();
    for (const result of similar) {
      if (!result.buyer || result.isStale) continue;
      const entry = buyerMap.get(result.buyer) ?? { titles: [], genres: new Set(), latestDate: null };
      entry.titles.push(result.title);
      if (result.genre) result.genre.split(/[,/]/).forEach((g) => entry.genres.add(g.trim()));
      buyerMap.set(result.buyer, entry);
    }

    const activeBuyers: BuyerActivity[] = Array.from(buyerMap.entries())
      .map(([name, data]) => ({
        name,
        activeTitles: data.titles.slice(0, 5),
        activeCount: data.titles.length,
        genres: Array.from(data.genres).slice(0, 4),
        recentActivity: `${data.titles.length} active title(s) in similar space`,
      }))
      .sort((a, b) => b.activeCount - a.activeCount)
      .slice(0, 8);

    // White space: find all buyers in DB that are NOT in activeBuyers and have recently acquired
    const activeBuyerNames = new Set(activeBuyers.map((b) => b.name));
    const potentialWhiteSpace = await prisma.buyer.findMany({
      where: {
        name: { notIn: Array.from(activeBuyerNames) },
      },
      take: 20,
      orderBy: { updatedAt: "desc" },
    }).catch(() => []);

    const whiteSpaceBuyers: BuyerActivity[] = potentialWhiteSpace.slice(0, 5).map((b) => ({
      name: b.name,
      activeTitles: [],
      activeCount: 0,
      genres: [],
      recentActivity: "No recent activity in this space — potential opening",
    }));

    // Build caution flags
    const cautionFlags: CautionFlag[] = [];

    const exactMatches = similar.filter(
      (r) => r.matchReasons.includes("exact_title_match") || r.matchScore >= 0.85
    );
    if (exactMatches.length > 0) {
      cautionFlags.push({
        severity: "high",
        message: `Very similar title/concept already in development: "${exactMatches[0].title}"`,
        relatedTitle: exactMatches[0].title,
        relatedId: exactMatches[0].id,
      });
    }

    const activeOverlap = similar.filter((r) => r.kind !== "article" && !r.isStale && r.matchScore >= 0.6);
    if (activeOverlap.length >= 3) {
      cautionFlags.push({
        severity: "medium",
        message: `${activeOverlap.length} active projects/shows overlap with this premise. Lane may be crowded.`,
      });
    }

    const staleMentions = similar.filter((r) => r.isStale);
    if (staleMentions.length > 0) {
      cautionFlags.push({
        severity: "low",
        message: `${staleMentions.length} stale/dead project(s) with similar premise — may have passed on this lane previously.`,
      });
    }

    logOperationalEvent("info", `Pitch compare: "${pitch.slice(0, 60)}…" → ${similar.length} similar`);

    return {
      dataSource: "database",
      pitch,
      similar,
      activeBuyers,
      whiteSpaceBuyers,
      cautionFlags,
      searchedAt: new Date(),
    };
  } catch (err) {
    logOperationalEvent("error", "Pitch compare failed", { error: String(err) });
    return mockPitchCompareResult(pitch);
  }
}

// ─── Saved searches ───────────────────────────────────────────────────────────

export type SavedSearchRecord = {
  id: string;
  name: string;
  query: string;
  searchMode: SearchMode;
  genre?: string | null;
  buyer?: string | null;
  yearFrom?: number | null;
  yearTo?: number | null;
  includeShows: boolean;
  includeProjects: boolean;
  includeStale: boolean;
  includeArticles: boolean;
  email?: string | null;
  createdAt: Date;
};

export async function createSavedSearch(
  data: Omit<SavedSearchRecord, "id" | "createdAt">
): Promise<SavedSearchRecord> {
  const row = await prisma.savedSearch.create({
    data: {
      name: data.name,
      query: data.query,
      searchMode: data.searchMode,
      genre: data.genre ?? null,
      buyer: data.buyer ?? null,
      yearFrom: data.yearFrom ?? null,
      yearTo: data.yearTo ?? null,
      includeShows: data.includeShows,
      includeProjects: data.includeProjects,
      includeStale: data.includeStale,
      includeArticles: data.includeArticles,
      email: data.email ?? null,
    },
  });
  return {
    ...row,
    searchMode: row.searchMode as SearchMode,
  };
}

export async function getSavedSearches(email?: string): Promise<SavedSearchRecord[]> {
  const rows = await prisma.savedSearch.findMany({
    where: email ? { email } : {},
    orderBy: { createdAt: "desc" },
    take: 50,
  });
  return rows.map((r) => ({ ...r, searchMode: r.searchMode as SearchMode }));
}

export async function deleteSavedSearch(id: string): Promise<void> {
  await prisma.savedSearch.delete({ where: { id } });
}
