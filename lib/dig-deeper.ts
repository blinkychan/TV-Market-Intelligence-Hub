/**
 * "Dig Deeper" Action
 *
 * Given an entity (Project, CurrentShow, or Article), searches for:
 * - Related articles / follow-up coverage
 * - Status updates (development → pilot → series / dead)
 * - Buyer / studio / talent changes
 * - Similar projects
 *
 * Always returns findings for human approval.
 * NEVER applies changes without explicit approval.
 */

import { prisma } from "@/lib/prisma";
import { logOperationalEvent } from "@/lib/ops-log";
import { canUseMockPreview } from "@/lib/runtime-mode";
import { mockDigDeeperResult } from "@/lib/mock-autonomous-population";

// ─── Types ────────────────────────────────────────────────────────────────────

export type DigDeeperEntityType = "Project" | "CurrentShow" | "Article";

export type DigDeeperFinding = {
  type:
    | "status_change"
    | "buyer_update"
    | "talent_update"
    | "related_article"
    | "similar_project"
    | "development_update";
  title: string;
  description: string;
  sourceUrl?: string | null;
  confidence: number;
  suggestedFieldUpdates?: Record<string, unknown>;
};

export type DigDeeperResult = {
  runId: string;
  entityType: DigDeeperEntityType;
  entityId: string;
  entityTitle: string;
  status: "completed" | "no_findings" | "error";
  findings: DigDeeperFinding[];
  summary: string;
  dataSource: "database" | "mock";
  requiresApproval: boolean;
  createdAt: Date;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function buildProjectQuery(project: {
  title: string;
  buyer?: { name: string } | null;
  studio?: { name: string } | null;
  genre?: string | null;
}): string[] {
  const terms: string[] = [project.title];
  if (project.buyer?.name) terms.push(project.buyer.name);
  if (project.studio?.name) terms.push(project.studio.name);
  if (project.genre) terms.push(project.genre);
  return terms;
}

async function findRelatedArticles(
  terms: string[],
  excludeIds: string[] = [],
  limit = 8
): Promise<
  {
    id: string;
    headline: string;
    url: string;
    publication: string | null;
    publishedDate: Date | null;
    summary: string | null;
    extractedStatus: string;
    confidenceScore: number | null;
  }[]
> {
  if (!terms.length) return [];

  const primaryTerm = terms[0];
  const articles = await prisma.article.findMany({
    where: {
      AND: [
        {
          OR: [
            { headline: { contains: primaryTerm, mode: "insensitive" } },
            { summary: { contains: primaryTerm, mode: "insensitive" } },
            { extractedProjectTitle: { contains: primaryTerm, mode: "insensitive" } },
            { searchableText: { contains: primaryTerm, mode: "insensitive" } },
          ],
        },
        { id: { notIn: excludeIds } },
        { archivedAt: null },
      ],
    },
    select: {
      id: true,
      headline: true,
      url: true,
      publication: true,
      publishedDate: true,
      summary: true,
      extractedStatus: true,
      confidenceScore: true,
    },
    orderBy: { publishedDate: "desc" },
    take: limit,
  });

  return articles;
}

async function findSimilarProjects(
  title: string,
  genre: string | null,
  excludeId: string
): Promise<{ id: string; title: string; status: string; genre: string | null; confidenceScore: number }[]> {
  const matches = await prisma.project.findMany({
    where: {
      AND: [
        { id: { not: excludeId } },
        { archivedAt: null },
        {
          OR: [
            genre ? { genre: { equals: genre, mode: "insensitive" } } : {},
            { searchableText: { contains: title.split(" ")[0], mode: "insensitive" } },
          ].filter((c) => Object.keys(c).length > 0),
        },
      ],
    },
    select: { id: true, title: true, status: true, genre: true, confidenceScore: true },
    take: 6,
    orderBy: { confidenceScore: "desc" },
  });
  return matches;
}

function detectStatusProgression(
  currentStatus: string,
  articles: { headline: string; extractedStatus: string }[]
): DigDeeperFinding | null {
  const statusKeywords: Record<string, string> = {
    pilot: "pilot_order",
    "series order": "series_order",
    "picked up": "series_order",
    cancel: "canceled",
    dead: "canceled",
    "no longer": "canceled",
    renew: "renewed",
    premiere: "airing",
  };

  for (const article of articles) {
    const lower = article.headline.toLowerCase();
    for (const [keyword, newStatus] of Object.entries(statusKeywords)) {
      if (lower.includes(keyword) && newStatus !== currentStatus) {
        return {
          type: "status_change",
          title: `Possible status change detected: ${currentStatus} → ${newStatus}`,
          description: `Article headline suggests status may have changed: "${article.headline}"`,
          confidence: 0.65,
          suggestedFieldUpdates: { status: newStatus },
        };
      }
    }
  }
  return null;
}

function detectBuyerUpdate(
  currentBuyer: string | null,
  articles: { headline: string; extractedBuyer: string | null }[]
): DigDeeperFinding | null {
  const knownBuyers = ["Netflix", "HBO", "ABC", "FX", "Peacock", "Apple TV+", "BBC", "Amazon", "Hulu", "Paramount+", "Disney+"];
  for (const article of articles) {
    for (const buyer of knownBuyers) {
      if (article.headline.includes(buyer) && buyer !== currentBuyer) {
        return {
          type: "buyer_update",
          title: `Possible buyer update: ${buyer}`,
          description: `A newer article mentions "${buyer}" which differs from current buyer "${currentBuyer ?? "unknown"}": "${article.headline}"`,
          confidence: 0.60,
          suggestedFieldUpdates: { networkOrPlatform: buyer },
        };
      }
    }
  }
  return null;
}

// ─── AI-powered Dig Deeper ────────────────────────────────────────────────────

async function aiDigDeeper(
  entityTitle: string,
  contextText: string,
  relatedArticles: { headline: string; summary: string | null; url: string }[]
): Promise<string | null> {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) return null;

  const articleContext = relatedArticles
    .slice(0, 5)
    .map((a, i) => `Article ${i + 1}: "${a.headline}"\n${a.summary ?? "(no summary)"}`)
    .join("\n\n");

  const prompt = JSON.stringify({
    task: "Analyze related articles for a TV development project and summarize key findings.",
    project: entityTitle,
    context: contextText.slice(0, 1000),
    relatedArticles: articleContext,
    instructions: [
      "Identify any status changes (development → pilot → series / dead).",
      "Note buyer, studio, or talent changes.",
      "Summarize the current development trajectory.",
      "Flag uncertainty with 'possibly' or 'may have'.",
      "Return a 2-4 sentence plain-text summary. No JSON.",
    ],
  });

  try {
    const model = process.env.OPENAI_MODEL?.trim() || "gpt-4o-mini";
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        temperature: 0.3,
        messages: [
          { role: "system", content: "You are a TV industry analyst. Be concise and factual." },
          { role: "user", content: prompt },
        ],
      }),
    });

    if (!response.ok) return null;
    const data = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    return data.choices?.[0]?.message?.content?.trim() ?? null;
  } catch {
    return null;
  }
}

// ─── Main entry point ─────────────────────────────────────────────────────────

export async function runDigDeeper(
  entityType: DigDeeperEntityType,
  entityId: string,
  requestedByEmail?: string
): Promise<DigDeeperResult> {
  const startedAt = new Date();

  // Mock mode
  if (canUseMockPreview()) {
    try {
      const count = await prisma.project.count().catch(() => -1);
      if (count <= 0) {
        const mockResult = mockDigDeeperResult(entityType, entityId);
        await saveDigDeeperRun(mockResult, requestedByEmail);
        return mockResult;
      }
    } catch {
      const mockResult = mockDigDeeperResult(entityType, entityId);
      await saveDigDeeperRun(mockResult, requestedByEmail);
      return mockResult;
    }
  }

  try {
    let entityTitle = "Unknown";
    let contextText = "";
    let currentStatus = "unknown";
    let currentBuyer: string | null = null;
    let genre: string | null = null;
    let linkedArticleIds: string[] = [];
    const findings: DigDeeperFinding[] = [];

    if (entityType === "Project") {
      const project = await prisma.project.findUnique({
        where: { id: entityId },
        include: {
          buyer: true,
          studio: true,
          linkedArticles: { select: { id: true, headline: true, extractedStatus: true, extractedBuyer: true } },
        },
      });
      if (!project) throw new Error(`Project ${entityId} not found`);

      entityTitle = project.title;
      contextText = [project.logline, project.genre, project.format, project.notes].filter(Boolean).join(". ");
      currentStatus = project.status;
      currentBuyer = project.buyer?.name ?? project.networkOrPlatform ?? null;
      genre = project.genre;
      linkedArticleIds = project.linkedArticles.map((a) => a.id);

      const terms = buildProjectQuery({ title: project.title, buyer: project.buyer, studio: project.studio, genre });
      const relatedArticles = await findRelatedArticles(terms, linkedArticleIds);

      // Status progression check
      const statusFinding = detectStatusProgression(
        currentStatus,
        relatedArticles.map((a) => ({ headline: a.headline, extractedStatus: a.extractedStatus }))
      );
      if (statusFinding) findings.push(statusFinding);

      // Buyer update check
      const buyerFinding = detectBuyerUpdate(
        currentBuyer,
        relatedArticles.map((a) => ({
          headline: a.headline,
          extractedBuyer: null,
        }))
      );
      if (buyerFinding) findings.push(buyerFinding);

      // Related articles as findings
      for (const article of relatedArticles.slice(0, 5)) {
        findings.push({
          type: "related_article",
          title: article.headline,
          description: article.summary ?? `From ${article.publication ?? "unknown publication"} on ${article.publishedDate ? new Date(article.publishedDate).toLocaleDateString() : "unknown date"}`,
          sourceUrl: article.url,
          confidence: article.confidenceScore ?? 0.5,
        });
      }

      // Similar projects
      const similarProjects = await findSimilarProjects(project.title, genre, entityId);
      for (const similar of similarProjects.slice(0, 3)) {
        findings.push({
          type: "similar_project",
          title: `Similar project: ${similar.title}`,
          description: `Status: ${similar.status}, Genre: ${similar.genre ?? "unknown"}, Confidence: ${Math.round(similar.confidenceScore * 100)}%`,
          confidence: 0.7,
        });
      }

      // AI summary
      const aiSummary = await aiDigDeeper(
        entityTitle,
        contextText,
        relatedArticles.map((a) => ({ headline: a.headline, summary: a.summary, url: a.url }))
      );
      if (aiSummary) {
        findings.unshift({
          type: "development_update",
          title: "AI Summary of Related Coverage",
          description: aiSummary,
          confidence: 0.7,
        });
      }
    } else if (entityType === "CurrentShow") {
      const show = await prisma.currentShow.findUnique({ where: { id: entityId } });
      if (!show) throw new Error(`CurrentShow ${entityId} not found`);

      entityTitle = show.title;
      contextText = [show.genre, show.studio, show.notes].filter(Boolean).join(". ");
      currentStatus = show.status;
      genre = show.genre;

      const relatedArticles = await findRelatedArticles([show.title, show.networkOrPlatform], []);
      for (const article of relatedArticles.slice(0, 5)) {
        findings.push({
          type: "related_article",
          title: article.headline,
          description: article.summary ?? `From ${article.publication ?? "unknown"} on ${article.publishedDate ? new Date(article.publishedDate).toLocaleDateString() : "unknown date"}`,
          sourceUrl: article.url,
          confidence: article.confidenceScore ?? 0.5,
        });
      }

      const aiSummary = await aiDigDeeper(entityTitle, contextText, relatedArticles);
      if (aiSummary) {
        findings.unshift({
          type: "development_update",
          title: "AI Summary of Related Coverage",
          description: aiSummary,
          confidence: 0.7,
        });
      }
    } else if (entityType === "Article") {
      const article = await prisma.article.findUnique({ where: { id: entityId } });
      if (!article) throw new Error(`Article ${entityId} not found`);

      entityTitle = article.headline;
      contextText = article.summary ?? article.extractedExcerpt ?? "";
      genre = article.extractedGenre;

      const relatedArticles = await findRelatedArticles(
        [article.extractedProjectTitle ?? article.headline.split(" ").slice(0, 4).join(" ")],
        [entityId]
      );

      for (const related of relatedArticles.slice(0, 6)) {
        findings.push({
          type: "related_article",
          title: related.headline,
          description: related.summary ?? `From ${related.publication ?? "unknown"}`,
          sourceUrl: related.url,
          confidence: related.confidenceScore ?? 0.5,
        });
      }
    }

    const summary = findings.length > 0
      ? `Found ${findings.length} finding${findings.length === 1 ? "" : "s"} for "${entityTitle}". ${findings.some((f) => f.type === "status_change") ? "Possible status change detected. " : ""}${findings.some((f) => f.type === "similar_project") ? `${findings.filter((f) => f.type === "similar_project").length} similar project(s) identified.` : ""}`
      : `No new findings for "${entityTitle}". Coverage appears up to date.`;

    const result: DigDeeperResult = {
      runId: "", // set by saveDigDeeperRun
      entityType,
      entityId,
      entityTitle,
      status: findings.length > 0 ? "completed" : "no_findings",
      findings,
      summary,
      dataSource: "database",
      requiresApproval: findings.some((f) => f.suggestedFieldUpdates),
      createdAt: startedAt,
    };

    await saveDigDeeperRun(result, requestedByEmail);
    logOperationalEvent("info", `Dig Deeper complete for ${entityType} ${entityId}: ${findings.length} findings`);
    return result;
  } catch (err) {
    logOperationalEvent("error", `Dig Deeper failed for ${entityType} ${entityId}`, { error: String(err) });
    const mockResult = mockDigDeeperResult(entityType, entityId);
    mockResult.status = "error";
    mockResult.summary = `Error: ${String(err).slice(0, 200)}`;
    await saveDigDeeperRun(mockResult, requestedByEmail);
    return mockResult;
  }
}

async function saveDigDeeperRun(
  result: DigDeeperResult,
  requestedByEmail?: string
): Promise<void> {
  try {
    const run = await prisma.digDeeperRun.create({
      data: {
        entityType: result.entityType,
        entityId: result.entityId,
        status: result.status,
        query: result.entityTitle,
        findingsText: result.summary,
        findingsJson: result.findings as never,
        createdByEmail: requestedByEmail ?? null,
      },
    });
    result.runId = run.id;
  } catch {
    result.runId = "unsaved-" + Date.now();
  }
}

// ─── Approve and apply findings ───────────────────────────────────────────────

export async function approveDigDeeperFindings(
  runId: string,
  approvedByEmail: string,
  applyUpdates = false
): Promise<{ success: boolean; message: string; appliedFields?: Record<string, unknown> }> {
  const run = await prisma.digDeeperRun.findUnique({ where: { id: runId } });
  if (!run) return { success: false, message: "Dig Deeper run not found" };
  if (run.approvedAt) return { success: false, message: "Already approved" };

  await prisma.digDeeperRun.update({
    where: { id: runId },
    data: { approvedAt: new Date(), approvedByEmail },
  });

  if (applyUpdates) {
    const findings = (run.findingsJson as DigDeeperFinding[] | null) ?? [];
    const updates: Record<string, unknown> = {};

    for (const finding of findings) {
      if (finding.suggestedFieldUpdates) {
        Object.assign(updates, finding.suggestedFieldUpdates);
      }
    }

    if (Object.keys(updates).length > 0) {
      const entityType = run.entityType as DigDeeperEntityType;

      if (entityType === "Project") {
        await prisma.project.update({
          where: { id: run.entityId },
          data: { ...updates as never, needsReview: true, updatedAt: new Date() },
        });
        await prisma.auditLog.create({
          data: {
            entityType: "Project",
            entityId: run.entityId,
            action: "updated",
            changedByEmail: approvedByEmail,
            reason: `Applied Dig Deeper findings (run ${runId})`,
            source: "dig_deeper",
            newValueJson: updates,
          },
        });
      } else if (entityType === "CurrentShow") {
        await prisma.currentShow.update({
          where: { id: run.entityId },
          data: { ...updates as never, needsVerification: true, updatedAt: new Date() },
        });
      }

      await prisma.digDeeperRun.update({
        where: { id: runId },
        data: { appliedAt: new Date(), appliedByEmail: approvedByEmail },
      });

      return {
        success: true,
        message: `Approved and applied ${Object.keys(updates).length} field update(s). Records marked Needs Review.`,
        appliedFields: updates,
      };
    }
  }

  return { success: true, message: "Findings approved. No field updates were applied." };
}

// ─── Weekly summary ───────────────────────────────────────────────────────────

export async function getDigDeeperWeeklySummary(weekStart: Date, weekEnd: Date) {
  try {
    const runs = await prisma.digDeeperRun.findMany({
      where: { createdAt: { gte: weekStart, lte: weekEnd } },
      orderBy: { createdAt: "desc" },
    });
    const applied = runs.filter((r) => r.appliedAt);
    const withFindings = runs.filter((r) => r.status === "completed");
    return { total: runs.length, withFindings: withFindings.length, applied: applied.length, runs };
  } catch {
    return { total: 0, withFindings: 0, applied: 0, runs: [] };
  }
}
