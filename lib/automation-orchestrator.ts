/**
 * Automation Orchestrator — Step 33
 *
 * Runs the full ingestion pipeline on a schedule:
 *   1. RSS ingestion (new articles)
 *   2. Backfill (one job at a time)
 *   3. Article body fetch (up to maxBodyFetchesPerRun)
 *   4. AI extraction (up to maxAIExtractionsPerRun)
 *   5. Auto-create draft records (if autoCreateDraftRecordsEnabled)
 *
 * Safety constraints:
 * - Strict per-step limits; never runs unlimited.
 * - Job locking via JobRun prevents parallel runs.
 * - Never auto-verifies records — only drafts.
 * - Never bypasses robots.txt.
 * - One source failure does NOT abort the full run.
 * - Mock/demo mode returns canned data instantly.
 */

import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { canUseMockPreview } from "@/lib/runtime-mode";
import { logOperationalEvent } from "@/lib/ops-log";
import { ingestRSSFeeds } from "@/lib/rss-ingestion";
import { runNextBackfillJob } from "@/lib/backfill";
import { fetchArticleBody } from "@/lib/article-body";
import { extractStructuredTVDataWithAI } from "@/lib/extraction";
import { runAutonomousPopulation } from "@/lib/autonomous-population";
import { mockAutomationRun, mockAutomationSettings } from "@/lib/mock-automation";

// ─── Types ────────────────────────────────────────────────────────────────────

export type AutomationMode = "off" | "cautious" | "aggressive";

export type AutomationStepKey =
  | "all"
  | "rss"
  | "backfill"
  | "body"
  | "extraction"
  | "autodraft";

export type AutomationSettings = {
  rssEnabled: boolean;
  backfillEnabled: boolean;
  bodyExtractionEnabled: boolean;
  aiExtractionEnabled: boolean;
  autoCreateDraftRecordsEnabled: boolean;
  maxArticlesPerRun: number;
  maxBodyFetchesPerRun: number;
  maxAIExtractionsPerRun: number;
  maxBackfillJobsPerRun: number;
  automationMode: AutomationMode;
  isPaused: boolean;
};

export const DEFAULT_AUTOMATION_SETTINGS: AutomationSettings = {
  rssEnabled: true,
  backfillEnabled: true,
  bodyExtractionEnabled: true,
  aiExtractionEnabled: true,
  autoCreateDraftRecordsEnabled: false,
  maxArticlesPerRun: 10,
  maxBodyFetchesPerRun: 5,
  maxAIExtractionsPerRun: 3,
  maxBackfillJobsPerRun: 1,
  automationMode: "cautious",
  isPaused: false,
};

export type AutomationRunResult = {
  runId: string;
  dataSource: "database" | "mock";
  triggeredBy: string;
  steps: AutomationStepKey;
  mode: AutomationMode;
  isPaused: boolean;

  // Per-step counts
  rssArticlesFetched: number;
  rssArticlesSaved: number;
  backfillJobsRun: number;
  backfillArticles: number;
  bodiesFetched: number;
  bodiesSkipped: number;
  aiExtractionsRun: number;
  draftsCreated: number;
  deduplicatesFound: number;
  errors: number;
  errorMessages: string[];

  startedAt: Date;
  completedAt: Date;
  durationMs: number;
  message: string;
};

// ─── Settings CRUD ────────────────────────────────────────────────────────────

export async function getAutomationSettings(): Promise<AutomationSettings> {
  try {
    const row = await prisma.automationSettings.findFirst({
      orderBy: { createdAt: "asc" },
    });
    if (!row) return { ...DEFAULT_AUTOMATION_SETTINGS };

    return {
      rssEnabled: row.rssEnabled,
      backfillEnabled: row.backfillEnabled,
      bodyExtractionEnabled: row.bodyExtractionEnabled,
      aiExtractionEnabled: row.aiExtractionEnabled,
      autoCreateDraftRecordsEnabled: row.autoCreateDraftRecordsEnabled,
      maxArticlesPerRun: row.maxArticlesPerRun,
      maxBodyFetchesPerRun: row.maxBodyFetchesPerRun,
      maxAIExtractionsPerRun: row.maxAIExtractionsPerRun,
      maxBackfillJobsPerRun: row.maxBackfillJobsPerRun,
      automationMode: row.automationMode as AutomationMode,
      isPaused: row.isPaused,
    };
  } catch {
    return { ...DEFAULT_AUTOMATION_SETTINGS };
  }
}

export async function upsertAutomationSettings(
  updates: Partial<AutomationSettings>
): Promise<AutomationSettings> {
  const existing = await prisma.automationSettings
    .findFirst({ orderBy: { createdAt: "asc" } })
    .catch(() => null);

  if (existing) {
    const row = await prisma.automationSettings.update({
      where: { id: existing.id },
      data: {
        ...(updates.rssEnabled !== undefined && { rssEnabled: updates.rssEnabled }),
        ...(updates.backfillEnabled !== undefined && { backfillEnabled: updates.backfillEnabled }),
        ...(updates.bodyExtractionEnabled !== undefined && { bodyExtractionEnabled: updates.bodyExtractionEnabled }),
        ...(updates.aiExtractionEnabled !== undefined && { aiExtractionEnabled: updates.aiExtractionEnabled }),
        ...(updates.autoCreateDraftRecordsEnabled !== undefined && { autoCreateDraftRecordsEnabled: updates.autoCreateDraftRecordsEnabled }),
        ...(updates.maxArticlesPerRun !== undefined && { maxArticlesPerRun: Math.min(updates.maxArticlesPerRun, 50) }),
        ...(updates.maxBodyFetchesPerRun !== undefined && { maxBodyFetchesPerRun: Math.min(updates.maxBodyFetchesPerRun, 20) }),
        ...(updates.maxAIExtractionsPerRun !== undefined && { maxAIExtractionsPerRun: Math.min(updates.maxAIExtractionsPerRun, 10) }),
        ...(updates.maxBackfillJobsPerRun !== undefined && { maxBackfillJobsPerRun: Math.min(updates.maxBackfillJobsPerRun, 3) }),
        ...(updates.automationMode !== undefined && { automationMode: updates.automationMode as never }),
        ...(updates.isPaused !== undefined && { isPaused: updates.isPaused }),
      },
    });
    return {
      rssEnabled: row.rssEnabled,
      backfillEnabled: row.backfillEnabled,
      bodyExtractionEnabled: row.bodyExtractionEnabled,
      aiExtractionEnabled: row.aiExtractionEnabled,
      autoCreateDraftRecordsEnabled: row.autoCreateDraftRecordsEnabled,
      maxArticlesPerRun: row.maxArticlesPerRun,
      maxBodyFetchesPerRun: row.maxBodyFetchesPerRun,
      maxAIExtractionsPerRun: row.maxAIExtractionsPerRun,
      maxBackfillJobsPerRun: row.maxBackfillJobsPerRun,
      automationMode: row.automationMode as AutomationMode,
      isPaused: row.isPaused,
    };
  }

  const row = await prisma.automationSettings.create({
    data: {
      rssEnabled: updates.rssEnabled ?? DEFAULT_AUTOMATION_SETTINGS.rssEnabled,
      backfillEnabled: updates.backfillEnabled ?? DEFAULT_AUTOMATION_SETTINGS.backfillEnabled,
      bodyExtractionEnabled: updates.bodyExtractionEnabled ?? DEFAULT_AUTOMATION_SETTINGS.bodyExtractionEnabled,
      aiExtractionEnabled: updates.aiExtractionEnabled ?? DEFAULT_AUTOMATION_SETTINGS.aiExtractionEnabled,
      autoCreateDraftRecordsEnabled: updates.autoCreateDraftRecordsEnabled ?? DEFAULT_AUTOMATION_SETTINGS.autoCreateDraftRecordsEnabled,
      maxArticlesPerRun: Math.min(updates.maxArticlesPerRun ?? DEFAULT_AUTOMATION_SETTINGS.maxArticlesPerRun, 50),
      maxBodyFetchesPerRun: Math.min(updates.maxBodyFetchesPerRun ?? DEFAULT_AUTOMATION_SETTINGS.maxBodyFetchesPerRun, 20),
      maxAIExtractionsPerRun: Math.min(updates.maxAIExtractionsPerRun ?? DEFAULT_AUTOMATION_SETTINGS.maxAIExtractionsPerRun, 10),
      maxBackfillJobsPerRun: Math.min(updates.maxBackfillJobsPerRun ?? DEFAULT_AUTOMATION_SETTINGS.maxBackfillJobsPerRun, 3),
      automationMode: (updates.automationMode ?? DEFAULT_AUTOMATION_SETTINGS.automationMode) as never,
      isPaused: updates.isPaused ?? DEFAULT_AUTOMATION_SETTINGS.isPaused,
    },
  });

  return {
    rssEnabled: row.rssEnabled,
    backfillEnabled: row.backfillEnabled,
    bodyExtractionEnabled: row.bodyExtractionEnabled,
    aiExtractionEnabled: row.aiExtractionEnabled,
    autoCreateDraftRecordsEnabled: row.autoCreateDraftRecordsEnabled,
    maxArticlesPerRun: row.maxArticlesPerRun,
    maxBodyFetchesPerRun: row.maxBodyFetchesPerRun,
    maxAIExtractionsPerRun: row.maxAIExtractionsPerRun,
    maxBackfillJobsPerRun: row.maxBackfillJobsPerRun,
    automationMode: row.automationMode as AutomationMode,
    isPaused: row.isPaused,
  };
}

// ─── Run History ──────────────────────────────────────────────────────────────

export type AutomationRunRecord = {
  id: string;
  triggeredBy: string;
  steps: string;
  mode: string;
  isPaused: boolean;
  rssArticlesFetched: number;
  rssArticlesSaved: number;
  backfillJobsRun: number;
  backfillArticles: number;
  bodiesFetched: number;
  bodiesSkipped: number;
  aiExtractionsRun: number;
  draftsCreated: number;
  deduplicatesFound: number;
  errors: number;
  errorMessages: string | null;
  durationMs: number | null;
  completedAt: Date | null;
  createdAt: Date;
};

export async function getRecentAutomationRuns(limit = 20): Promise<AutomationRunRecord[]> {
  try {
    const rows = await prisma.automationRun.findMany({
      orderBy: { createdAt: "desc" },
      take: limit,
    });
    return rows as AutomationRunRecord[];
  } catch {
    return [];
  }
}

export async function getAutomationDashboardData() {
  if (canUseMockPreview()) {
    try {
      const count = await prisma.automationRun.count().catch(() => -1);
      if (count <= 0) {
        return mockAutomationDashboardData();
      }
    } catch {
      return mockAutomationDashboardData();
    }
  }

  const [settings, runs] = await Promise.all([
    getAutomationSettings(),
    getRecentAutomationRuns(25),
  ]);

  const lastRun = runs[0] ?? null;
  const thisWeek = runs.filter(
    (r) => r.createdAt > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
  );

  return {
    dataSource: "database" as const,
    settings,
    lastRun,
    recentRuns: runs.slice(0, 10),
    stats: {
      runsThisWeek: thisWeek.length,
      articlesThisWeek: thisWeek.reduce((s, r) => s + r.rssArticlesSaved + r.backfillArticles, 0),
      bodiesThisWeek: thisWeek.reduce((s, r) => s + r.bodiesFetched, 0),
      extractionsThisWeek: thisWeek.reduce((s, r) => s + r.aiExtractionsRun, 0),
      draftsThisWeek: thisWeek.reduce((s, r) => s + r.draftsCreated, 0),
      errorsThisWeek: thisWeek.reduce((s, r) => s + r.errors, 0),
    },
  };
}

function mockAutomationDashboardData() {
  const { settings, runs, stats } = mockAutomationSettings();
  return {
    dataSource: "mock" as const,
    settings,
    lastRun: runs[0] ?? null,
    recentRuns: runs.slice(0, 10),
    stats,
  };
}

// ─── Step runners (each isolated — one failure ≠ run abort) ───────────────────

async function runRSSStep(
  settings: AutomationSettings,
  errors: string[]
): Promise<{ fetched: number; saved: number }> {
  if (!settings.rssEnabled) return { fetched: 0, saved: 0 };
  try {
    const result = await ingestRSSFeeds("real");
    return { fetched: result.fetched, saved: result.saved };
  } catch (err) {
    errors.push(`RSS: ${String(err)}`);
    logOperationalEvent("error", "Automation: RSS step failed", { error: String(err) });
    return { fetched: 0, saved: 0 };
  }
}

async function runBackfillStep(
  settings: AutomationSettings,
  errors: string[]
): Promise<{ jobsRun: number; articles: number }> {
  if (!settings.backfillEnabled) return { jobsRun: 0, articles: 0 };

  let jobsRun = 0;
  let articles = 0;
  const limit = Math.min(settings.maxBackfillJobsPerRun, 3);

  for (let i = 0; i < limit; i++) {
    try {
      const result = await runNextBackfillJob("auto");
      if (result.status === "idle") break; // no more queued jobs
      jobsRun++;
      articles += result.articlesSaved;
    } catch (err) {
      errors.push(`Backfill job ${i + 1}: ${String(err)}`);
      logOperationalEvent("error", "Automation: backfill step failed", { error: String(err) });
      break;
    }
  }

  return { jobsRun, articles };
}

async function runBodyFetchStep(
  settings: AutomationSettings,
  errors: string[]
): Promise<{ fetched: number; skipped: number }> {
  if (!settings.bodyExtractionEnabled) return { fetched: 0, skipped: 0 };

  const limit = Math.min(settings.maxBodyFetchesPerRun, 20);
  let fetched = 0;
  let skipped = 0;

  try {
    // Find articles that need body fetch: have a sourceUrl, no body text yet
    const candidates = await prisma.article.findMany({
      where: {
        sourceUrl: { not: null },
        bodyText: null,
        bodyFetchStatus: { in: ["not_fetched", null] as never[] },
      },
      orderBy: { publishedDate: "desc" },
      take: limit,
      select: { id: true, sourceUrl: true },
    });

    for (const article of candidates) {
      if (!article.sourceUrl) { skipped++; continue; }
      try {
        const result = await fetchArticleBody(article.sourceUrl);
        await prisma.article.update({
          where: { id: article.id },
          data: {
            bodyText: result.extractedText,
            bodyFetchStatus: result.status as never,
            bodyFetchedAt: result.fetchedAt,
            paywallLikely: result.paywallLikely,
          },
        });
        if (result.status === "success") fetched++;
        else skipped++;
      } catch (err) {
        errors.push(`Body fetch for ${article.id}: ${String(err)}`);
        skipped++;
      }
    }
  } catch (err) {
    errors.push(`Body fetch step: ${String(err)}`);
    logOperationalEvent("error", "Automation: body fetch step failed", { error: String(err) });
  }

  return { fetched, skipped };
}

async function runAIExtractionStep(
  settings: AutomationSettings,
  errors: string[]
): Promise<{ ran: number }> {
  if (!settings.aiExtractionEnabled) return { ran: 0 };

  const limit = Math.min(settings.maxAIExtractionsPerRun, 10);
  let ran = 0;

  try {
    // Articles with body text but no AI extraction attempt yet
    const candidates = await prisma.article.findMany({
      where: {
        OR: [
          { bodyText: { not: null } },
          { summary: { not: null } },
        ],
        extractedData: null,
        isProcessed: { not: true },
      },
      orderBy: { publishedDate: "desc" },
      take: limit,
      select: {
        id: true,
        headline: true,
        summary: true,
        bodyText: true,
        sourceUrl: true,
        publication: true,
        publishedDate: true,
      },
    });

    for (const article of candidates) {
      try {
        const extraction = await extractStructuredTVDataWithAI(article as never);
        await prisma.article.update({
          where: { id: article.id },
          data: {
            extractedData: extraction as never,
            confidenceScore: extraction.confidenceScore,
            confidenceLevel: extraction.confidenceLevel,
            isProcessed: true,
          },
        });
        ran++;
      } catch (err) {
        errors.push(`AI extraction for ${article.id}: ${String(err)}`);
        // Mark as attempted to avoid infinite retry loops
        await prisma.article.update({
          where: { id: article.id },
          data: { isProcessed: true },
        }).catch(() => undefined);
      }
    }
  } catch (err) {
    errors.push(`AI extraction step: ${String(err)}`);
    logOperationalEvent("error", "Automation: AI extraction step failed", { error: String(err) });
  }

  return { ran };
}

async function runAutoDraftStep(
  settings: AutomationSettings,
  errors: string[]
): Promise<{ draftsCreated: number; deduplicatesFound: number }> {
  if (!settings.autoCreateDraftRecordsEnabled || settings.automationMode === "off") {
    return { draftsCreated: 0, deduplicatesFound: 0 };
  }

  try {
    const limit = Math.min(settings.maxAIExtractionsPerRun * 2, 20);
    const summary = await runAutonomousPopulation({
      forceMode: settings.automationMode,
      limit,
    });

    return {
      draftsCreated: summary.projectsCreated + summary.showsCreated,
      deduplicatesFound: summary.skipped,
    };
  } catch (err) {
    errors.push(`Auto-draft step: ${String(err)}`);
    logOperationalEvent("error", "Automation: auto-draft step failed", { error: String(err) });
    return { draftsCreated: 0, deduplicatesFound: 0 };
  }
}

// ─── Main orchestrator ────────────────────────────────────────────────────────

const LOCK_KEY = "automation_orchestrator";

export async function runAutomation(options: {
  triggeredBy?: string;
  steps?: AutomationStepKey;
  overrideSettings?: Partial<AutomationSettings>;
} = {}): Promise<AutomationRunResult> {
  const startedAt = new Date();
  const runId = randomUUID();
  const triggeredBy = options.triggeredBy ?? "manual";
  const steps = options.steps ?? "all";

  // ── Mock mode ──────────────────────────────────────────────────────────────
  if (canUseMockPreview()) {
    try {
      const count = await prisma.automationRun.count().catch(() => -1);
      if (count <= 0) {
        return mockAutomationRun({ triggeredBy, steps });
      }
    } catch {
      return mockAutomationRun({ triggeredBy, steps });
    }
  }

  // ── Load settings ──────────────────────────────────────────────────────────
  const baseSettings = await getAutomationSettings();
  const settings: AutomationSettings = { ...baseSettings, ...options.overrideSettings };

  // ── Paused check ───────────────────────────────────────────────────────────
  if (settings.isPaused && triggeredBy === "cron") {
    const completedAt = new Date();
    return {
      runId,
      dataSource: "database",
      triggeredBy,
      steps,
      mode: settings.automationMode,
      isPaused: true,
      rssArticlesFetched: 0, rssArticlesSaved: 0,
      backfillJobsRun: 0, backfillArticles: 0,
      bodiesFetched: 0, bodiesSkipped: 0,
      aiExtractionsRun: 0, draftsCreated: 0,
      deduplicatesFound: 0, errors: 0, errorMessages: [],
      startedAt, completedAt,
      durationMs: completedAt.getTime() - startedAt.getTime(),
      message: "Automation is paused — skipping cron run.",
    };
  }

  // ── Job lock ───────────────────────────────────────────────────────────────
  let lockId: string | null = null;
  try {
    const lock = await prisma.jobRun.create({
      data: {
        id: randomUUID(),
        jobType: "automation_orchestrator",
        lockKey: LOCK_KEY,
        status: "running",
        triggeredBy,
      },
    });
    lockId = lock.id;
  } catch {
    // Lock already held — another run in progress
    const completedAt = new Date();
    return {
      runId,
      dataSource: "database",
      triggeredBy,
      steps,
      mode: settings.automationMode,
      isPaused: false,
      rssArticlesFetched: 0, rssArticlesSaved: 0,
      backfillJobsRun: 0, backfillArticles: 0,
      bodiesFetched: 0, bodiesSkipped: 0,
      aiExtractionsRun: 0, draftsCreated: 0,
      deduplicatesFound: 0, errors: 0, errorMessages: [],
      startedAt, completedAt,
      durationMs: completedAt.getTime() - startedAt.getTime(),
      message: "Another automation run is already in progress — skipping.",
    };
  }

  // ── Run steps ──────────────────────────────────────────────────────────────
  const errorMessages: string[] = [];
  let rssArticlesFetched = 0, rssArticlesSaved = 0;
  let backfillJobsRun = 0, backfillArticles = 0;
  let bodiesFetched = 0, bodiesSkipped = 0;
  let aiExtractionsRun = 0;
  let draftsCreated = 0, deduplicatesFound = 0;

  const runStep = steps === "all";

  if (runStep || steps === "rss") {
    const r = await runRSSStep(settings, errorMessages);
    rssArticlesFetched = r.fetched;
    rssArticlesSaved = r.saved;
  }

  if (runStep || steps === "backfill") {
    const r = await runBackfillStep(settings, errorMessages);
    backfillJobsRun = r.jobsRun;
    backfillArticles = r.articles;
  }

  if (runStep || steps === "body") {
    const r = await runBodyFetchStep(settings, errorMessages);
    bodiesFetched = r.fetched;
    bodiesSkipped = r.skipped;
  }

  if (runStep || steps === "extraction") {
    const r = await runAIExtractionStep(settings, errorMessages);
    aiExtractionsRun = r.ran;
  }

  if (runStep || steps === "autodraft") {
    const r = await runAutoDraftStep(settings, errorMessages);
    draftsCreated = r.draftsCreated;
    deduplicatesFound = r.deduplicatesFound;
  }

  const completedAt = new Date();
  const durationMs = completedAt.getTime() - startedAt.getTime();

  // ── Persist run record ─────────────────────────────────────────────────────
  try {
    await prisma.automationRun.create({
      data: {
        id: runId,
        triggeredBy,
        steps,
        mode: settings.automationMode,
        isPaused: settings.isPaused,
        rssArticlesFetched,
        rssArticlesSaved,
        backfillJobsRun,
        backfillArticles,
        bodiesFetched,
        bodiesSkipped,
        aiExtractionsRun,
        draftsCreated,
        deduplicatesFound,
        errors: errorMessages.length,
        errorMessages: errorMessages.length > 0 ? errorMessages.join("\n") : null,
        durationMs,
        completedAt,
      },
    });
  } catch (err) {
    logOperationalEvent("error", "Automation: failed to persist run record", { error: String(err) });
  }

  // ── Release lock ───────────────────────────────────────────────────────────
  if (lockId) {
    await prisma.jobRun.update({
      where: { id: lockId },
      data: { status: "completed", completedAt },
    }).catch(() => undefined);
  }

  logOperationalEvent("info", "Automation run completed", {
    triggeredBy,
    steps,
    rssArticlesSaved,
    bodiesFetched,
    aiExtractionsRun,
    draftsCreated,
    errors: errorMessages.length,
    durationMs,
  });

  const totalProcessed =
    rssArticlesSaved + backfillArticles + bodiesFetched + aiExtractionsRun + draftsCreated;

  return {
    runId,
    dataSource: "database",
    triggeredBy,
    steps,
    mode: settings.automationMode,
    isPaused: settings.isPaused,
    rssArticlesFetched,
    rssArticlesSaved,
    backfillJobsRun,
    backfillArticles,
    bodiesFetched,
    bodiesSkipped,
    aiExtractionsRun,
    draftsCreated,
    deduplicatesFound,
    errors: errorMessages.length,
    errorMessages,
    startedAt,
    completedAt,
    durationMs,
    message: errorMessages.length > 0
      ? `Run complete with ${errorMessages.length} error(s). ${totalProcessed} items processed.`
      : `Run complete. ${totalProcessed} items processed in ${Math.round(durationMs / 1000)}s.`,
  };
}
