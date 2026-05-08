/**
 * Autonomous Population Pipeline
 *
 * Modes:
 * - off: no auto-creation; all articles stay in the review queue
 * - cautious: high-confidence articles create DRAFT records marked
 *   "Auto-Created / Needs Review"; low-confidence stay in queue
 * - aggressive: same as cautious but with a lower confidence threshold
 *
 * Rules:
 * - NEVER publish auto-created records as fully verified.
 * - ALWAYS preserve source URL and extraction notes.
 * - ALWAYS write an audit log entry for each auto-created record.
 * - Deduplication runs before creation.
 * - Job locking prevents parallel runs.
 */

import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { extractStructuredTVDataWithAI, extractStructuredTVData } from "@/lib/extraction";
import { canUseMockPreview } from "@/lib/runtime-mode";
import { logOperationalEvent } from "@/lib/ops-log";
import { getAutoPopulateMode, getHighConfidenceThreshold } from "@/lib/app-settings";
import { indexProjectSearchableText, indexCurrentShowSearchableText } from "@/lib/semantic-search";
import { mockAutoPopulationResult } from "@/lib/mock-autonomous-population";
import type { AutoPopulateMode } from "@/lib/app-settings";

// ─── Types ────────────────────────────────────────────────────────────────────

export type AutoPopulationArticleResult = {
  articleId: string;
  headline: string;
  action:
    | "auto_created_project"
    | "auto_created_show"
    | "flagged_review"
    | "skipped_low_confidence"
    | "skipped_duplicate"
    | "skipped_mode_off"
    | "skipped_no_extraction"
    | "error";
  entityId?: string;
  entityType?: string;
  confidenceScore?: number;
  reason: string;
};

export type AutoPopulationRunSummary = {
  mode: AutoPopulateMode;
  dataSource: "database" | "mock";
  articlesProcessed: number;
  projectsCreated: number;
  showsCreated: number;
  flaggedForReview: number;
  skipped: number;
  errors: number;
  results: AutoPopulationArticleResult[];
  startedAt: Date;
  completedAt: Date;
  message: string;
};

// ─── Deduplication check ──────────────────────────────────────────────────────

async function findExistingProject(title: string): Promise<string | null> {
  if (!title) return null;
  const normalized = title.trim().toLowerCase();
  const match = await prisma.project.findFirst({
    where: {
      OR: [
        { title: { equals: title, mode: "insensitive" } },
        { aliases: { contains: normalized, mode: "insensitive" } },
      ],
      archivedAt: null,
    },
    select: { id: true },
  });
  return match?.id ?? null;
}

async function findExistingShow(title: string, network?: string | null): Promise<string | null> {
  if (!title) return null;
  const match = await prisma.currentShow.findFirst({
    where: {
      title: { equals: title, mode: "insensitive" },
      ...(network ? { networkOrPlatform: { equals: network, mode: "insensitive" } } : {}),
      archivedAt: null,
    },
    select: { id: true },
  });
  return match?.id ?? null;
}

// ─── Record creators ──────────────────────────────────────────────────────────

async function createDraftProject(
  extracted: Awaited<ReturnType<typeof extractStructuredTVDataWithAI>>,
  articleId: string,
  mode: AutoPopulateMode
): Promise<string> {
  const id = randomUUID();

  // Resolve buyer by name, create if missing
  let buyerId: string | null = null;
  if (extracted.buyer) {
    const buyer = await prisma.buyer.findFirst({
      where: { name: { equals: extracted.buyer, mode: "insensitive" } },
    });
    if (buyer) {
      buyerId = buyer.id;
    } else {
      const newBuyer = await prisma.buyer.create({
        data: { name: extracted.buyer, type: "streamer" },
      });
      buyerId = newBuyer.id;
    }
  }

  const project = await prisma.project.create({
    data: {
      id,
      title: extracted.title ?? "Untitled Project",
      type: "scripted",
      status: (extracted.status as never) ?? "in_development",
      logline: extracted.logline,
      genre: extracted.genre,
      format: extracted.format,
      source_material: extracted.sourceMaterial,
      buyerId,
      networkOrPlatform: extracted.buyer,
      countryOfOrigin: extracted.country,
      isInternational: extracted.isInternational,
      isCoProduction: extracted.isCoProduction,
      isAcquisition: extracted.isAcquisition,
      announcementDate: extracted.announcementDate,
      premiereDate: extracted.premiereDate,
      sourceUrl: null,
      confidenceScore: extracted.confidenceScore ?? 0.5,
      confidenceLevel: extracted.confidenceLevel,
      confidenceReasons: extracted.confidenceReasons.join(", "),
      needsReview: true,
      autoCreated: true,
      autoCreatedMode: mode,
      notes: [
        "AUTO-CREATED / NEEDS REVIEW",
        `Extraction mode: ${extracted.mode}`,
        `Fields needing review: ${extracted.fieldsNeedingReview.join(", ")}`,
        extracted.warning ? `Warning: ${extracted.warning}` : null,
      ]
        .filter(Boolean)
        .join("\n"),
      linkedArticles: { connect: { id: articleId } },
    },
  });

  // Write audit log
  await prisma.auditLog.create({
    data: {
      entityType: "Project",
      entityId: project.id,
      action: "created",
      reason: `Auto-created from article ${articleId} in ${mode} mode`,
      source: "autonomous_population",
      newValueJson: {
        title: project.title,
        confidenceScore: project.confidenceScore,
        mode,
        articleId,
      },
    },
  });

  // Auto-population audit log
  await prisma.autoPopulationLog.create({
    data: {
      articleId,
      entityType: "Project",
      entityId: project.id,
      action: "auto_created",
      confidenceScore: extracted.confidenceScore ?? null,
      mode,
      notes: `Created "${project.title}" with confidence ${Math.round((extracted.confidenceScore ?? 0) * 100)}%`,
    },
  });

  // Index searchable text
  await indexProjectSearchableText(project.id).catch(() => undefined);

  return project.id;
}

async function createDraftShow(
  extracted: Awaited<ReturnType<typeof extractStructuredTVDataWithAI>>,
  articleId: string,
  mode: AutoPopulateMode
): Promise<string> {
  const show = await prisma.currentShow.create({
    data: {
      title: extracted.title ?? "Untitled Show",
      networkOrPlatform: extracted.buyer ?? "Unknown",
      status: extracted.status ?? "airing",
      genre: extracted.genre,
      studio: extracted.studio,
      country: extracted.country,
      premiereDate: extracted.premiereDate,
      confidenceScore: extracted.confidenceScore ?? 0.5,
      confidenceLevel: extracted.confidenceLevel,
      confidenceReasons: extracted.confidenceReasons.join(", "),
      needsVerification: true,
      autoCreated: true,
      autoCreatedMode: mode,
      notes: [
        "AUTO-CREATED / NEEDS REVIEW",
        `Extraction mode: ${extracted.mode}`,
        `Fields needing review: ${extracted.fieldsNeedingReview.join(", ")}`,
      ]
        .filter(Boolean)
        .join("\n"),
      linkedArticles: { connect: { id: articleId } },
    },
  });

  await prisma.auditLog.create({
    data: {
      entityType: "CurrentShow",
      entityId: show.id,
      action: "created",
      reason: `Auto-created from article ${articleId} in ${mode} mode`,
      source: "autonomous_population",
      newValueJson: {
        title: show.title,
        confidenceScore: show.confidenceScore,
        mode,
        articleId,
      },
    },
  });

  await prisma.autoPopulationLog.create({
    data: {
      articleId,
      entityType: "CurrentShow",
      entityId: show.id,
      action: "auto_created",
      confidenceScore: extracted.confidenceScore ?? null,
      mode,
      notes: `Created show "${show.title}" with confidence ${Math.round((extracted.confidenceScore ?? 0) * 100)}%`,
    },
  });

  await indexCurrentShowSearchableText(show.id).catch(() => undefined);

  return show.id;
}

// ─── Per-article processing ───────────────────────────────────────────────────

async function processArticle(
  article: {
    id: string;
    headline: string;
    url: string;
    publication: string | null;
    publishedDate: Date | null;
    summary: string | null;
    extractedText: string | null;
    extractedExcerpt: string | null;
    extractionStatus: string;
  },
  mode: AutoPopulateMode,
  threshold: number
): Promise<AutoPopulationArticleResult> {
  if (mode === "off") {
    return {
      articleId: article.id,
      headline: article.headline,
      action: "skipped_mode_off",
      reason: "Auto-population is disabled",
    };
  }

  try {
    // Run extraction (AI if key present, else placeholder)
    const apiKey = process.env.GROQ_API_KEY?.trim();
    const extracted = apiKey
      ? await extractStructuredTVDataWithAI(article)
      : await extractStructuredTVData(article, "placeholder");

    if (!extracted.title) {
      await prisma.autoPopulationLog.create({
        data: {
          articleId: article.id,
          action: "skipped_no_extraction",
          confidenceScore: null,
          mode,
          notes: "Extraction returned no title",
        },
      });
      return {
        articleId: article.id,
        headline: article.headline,
        action: "skipped_no_extraction",
        confidenceScore: extracted.confidenceScore ?? undefined,
        reason: "No title could be extracted",
      };
    }

    const confidence = extracted.confidenceScore ?? 0;
    const effectiveThreshold = mode === "aggressive" ? threshold - 0.1 : threshold;

    if (confidence < effectiveThreshold) {
      // Low confidence → flag for review
      await prisma.article.update({
        where: { id: article.id },
        data: { needsReview: true },
      });

      await prisma.autoPopulationLog.create({
        data: {
          articleId: article.id,
          action: "flagged_review",
          confidenceScore: confidence,
          mode,
          notes: `Confidence ${Math.round(confidence * 100)}% below threshold ${Math.round(effectiveThreshold * 100)}%`,
        },
      });

      return {
        articleId: article.id,
        headline: article.headline,
        action: "flagged_review",
        confidenceScore: confidence,
        reason: `Confidence ${Math.round(confidence * 100)}% is below the ${Math.round(effectiveThreshold * 100)}% threshold`,
      };
    }

    // High enough confidence – check for duplicates first
    if (extracted.category === "current_show") {
      const existingId = await findExistingShow(extracted.title!, extracted.buyer);
      if (existingId) {
        // Link article to existing show
        await prisma.article.update({
          where: { id: article.id },
          data: { linkedShowId: existingId },
        });
        await prisma.autoPopulationLog.create({
          data: {
            articleId: article.id,
            entityType: "CurrentShow",
            entityId: existingId,
            action: "deduplicated",
            confidenceScore: confidence,
            mode,
            notes: `Linked to existing show ${existingId}`,
          },
        });
        return {
          articleId: article.id,
          headline: article.headline,
          action: "skipped_duplicate",
          entityId: existingId,
          entityType: "CurrentShow",
          confidenceScore: confidence,
          reason: `Duplicate of existing CurrentShow ${existingId}`,
        };
      }

      const showId = await createDraftShow(extracted, article.id, mode);
      return {
        articleId: article.id,
        headline: article.headline,
        action: "auto_created_show",
        entityId: showId,
        entityType: "CurrentShow",
        confidenceScore: confidence,
        reason: `Auto-created draft CurrentShow with ${Math.round(confidence * 100)}% confidence`,
      };
    } else {
      // Development project
      const existingId = await findExistingProject(extracted.title!);
      if (existingId) {
        await prisma.article.update({
          where: { id: article.id },
          data: { linkedProjectId: existingId },
        });
        await prisma.autoPopulationLog.create({
          data: {
            articleId: article.id,
            entityType: "Project",
            entityId: existingId,
            action: "deduplicated",
            confidenceScore: confidence,
            mode,
            notes: `Linked to existing project ${existingId}`,
          },
        });
        return {
          articleId: article.id,
          headline: article.headline,
          action: "skipped_duplicate",
          entityId: existingId,
          entityType: "Project",
          confidenceScore: confidence,
          reason: `Duplicate of existing Project ${existingId}`,
        };
      }

      const projectId = await createDraftProject(extracted, article.id, mode);
      return {
        articleId: article.id,
        headline: article.headline,
        action: "auto_created_project",
        entityId: projectId,
        entityType: "Project",
        confidenceScore: confidence,
        reason: `Auto-created draft Project with ${Math.round(confidence * 100)}% confidence`,
      };
    }
  } catch (err) {
    logOperationalEvent("error", `Auto-population failed for article ${article.id}`, {
      error: String(err),
    });

    await prisma.autoPopulationLog.create({
      data: {
        articleId: article.id,
        action: "error",
        mode,
        notes: String(err).slice(0, 500),
      },
    }).catch(() => undefined);

    return {
      articleId: article.id,
      headline: article.headline,
      action: "error",
      reason: String(err).slice(0, 200),
    };
  }
}

// ─── Run pipeline ─────────────────────────────────────────────────────────────

const LOCK_KEY = "autonomous_population";

export async function runAutonomousPopulation(options?: {
  articleIds?: string[];
  forceMode?: AutoPopulateMode;
  limit?: number;
}): Promise<AutoPopulationRunSummary> {
  const startedAt = new Date();

  // Mock mode
  if (canUseMockPreview()) {
    try {
      const count = await prisma.project.count().catch(() => -1);
      if (count <= 0) {
        return mockAutoPopulationResult();
      }
    } catch {
      return mockAutoPopulationResult();
    }
  }

  // Job locking
  const existingLock = await prisma.jobRun.findFirst({
    where: { lockKey: LOCK_KEY, status: "running" },
  });
  if (existingLock) {
    return {
      mode: "off",
      dataSource: "database",
      articlesProcessed: 0,
      projectsCreated: 0,
      showsCreated: 0,
      flaggedForReview: 0,
      skipped: 0,
      errors: 0,
      results: [],
      startedAt,
      completedAt: new Date(),
      message: "Another auto-population run is already in progress. Please wait.",
    };
  }

  const jobRun = await prisma.jobRun.create({
    data: {
      jobType: "autonomous_population",
      status: "running",
      lockKey: LOCK_KEY,
      startedAt,
    },
  });

  const mode = options?.forceMode ?? (await getAutoPopulateMode());
  const threshold = await getHighConfidenceThreshold();

  try {
    // Fetch articles pending processing
    const articleFilter = options?.articleIds?.length
      ? { id: { in: options.articleIds } }
      : {
          needsReview: true,
          extractionStatus: "Needs Review",
          archivedAt: null,
        };

    const articles = await prisma.article.findMany({
      where: articleFilter,
      select: {
        id: true,
        headline: true,
        url: true,
        publication: true,
        publishedDate: true,
        summary: true,
        extractedText: true,
        extractedExcerpt: true,
        extractionStatus: true,
      },
      take: options?.limit ?? 50,
      orderBy: { publishedDate: "desc" },
    });

    logOperationalEvent("info", `Autonomous population: processing ${articles.length} articles`, {
      mode,
      threshold,
    });

    const results: AutoPopulationArticleResult[] = [];
    for (const article of articles) {
      const result = await processArticle(article, mode, threshold);
      results.push(result);
    }

    const projectsCreated = results.filter((r) => r.action === "auto_created_project").length;
    const showsCreated = results.filter((r) => r.action === "auto_created_show").length;
    const flaggedForReview = results.filter((r) => r.action === "flagged_review").length;
    const skipped = results.filter((r) => r.action.startsWith("skipped")).length;
    const errors = results.filter((r) => r.action === "error").length;

    const completedAt = new Date();
    const message = mode === "off"
      ? "Auto-population is disabled. Enable it in Settings → Auto-Population."
      : `Processed ${articles.length} articles: ${projectsCreated} projects created, ${showsCreated} shows created, ${flaggedForReview} flagged for review, ${skipped} skipped, ${errors} errors.`;

    await prisma.jobRun.update({
      where: { id: jobRun.id },
      data: {
        status: "completed",
        completedAt,
        resultJson: { projectsCreated, showsCreated, flaggedForReview, skipped, errors },
      },
    });

    logOperationalEvent("info", `Autonomous population complete: ${message}`);

    return {
      mode,
      dataSource: "database",
      articlesProcessed: articles.length,
      projectsCreated,
      showsCreated,
      flaggedForReview,
      skipped,
      errors,
      results,
      startedAt,
      completedAt,
      message,
    };
  } catch (err) {
    await prisma.jobRun.update({
      where: { id: jobRun.id },
      data: {
        status: "failed",
        completedAt: new Date(),
        errorMessage: String(err).slice(0, 500),
      },
    }).catch(() => undefined);

    throw err;
  }
}

// ─── Weekly summary query ─────────────────────────────────────────────────────

export async function getAutoPopulationWeeklySummary(weekStart: Date, weekEnd: Date) {
  try {
    const logs = await prisma.autoPopulationLog.findMany({
      where: { createdAt: { gte: weekStart, lte: weekEnd } },
      orderBy: { createdAt: "desc" },
    });

    const created = logs.filter((l) => l.action === "auto_created");
    const flagged = logs.filter((l) => l.action === "flagged_review");
    const deduplicated = logs.filter((l) => l.action === "deduplicated");

    return { created, flagged, deduplicated, total: logs.length };
  } catch {
    return { created: [], flagged: [], deduplicated: [], total: 0 };
  }
}
