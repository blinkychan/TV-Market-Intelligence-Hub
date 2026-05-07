/**
 * Mock data for the Automation Orchestrator (Step 33).
 * Used in preview/demo mode when the database is empty or unavailable.
 */

import type {
  AutomationRunResult,
  AutomationSettings,
  AutomationRunRecord,
  AutomationStepKey,
} from "@/lib/automation-orchestrator";

export function mockAutomationRun(options: {
  triggeredBy?: string;
  steps?: AutomationStepKey;
} = {}): AutomationRunResult {
  const now = new Date();
  const startedAt = new Date(now.getTime() - 14_320);
  const completedAt = now;

  return {
    runId: "mock-run-" + Math.random().toString(36).slice(2, 8),
    dataSource: "mock",
    triggeredBy: options.triggeredBy ?? "manual",
    steps: options.steps ?? "all",
    mode: "cautious",
    isPaused: false,
    rssArticlesFetched: 23,
    rssArticlesSaved: 7,
    backfillJobsRun: 1,
    backfillArticles: 4,
    bodiesFetched: 5,
    bodiesSkipped: 1,
    aiExtractionsRun: 3,
    draftsCreated: 1,
    deduplicatesFound: 2,
    errors: 0,
    errorMessages: [],
    startedAt,
    completedAt,
    durationMs: 14_320,
    message: "Run complete. 21 items processed in 14s. (mock)",
  };
}

const MOCK_RUNS: AutomationRunRecord[] = [
  {
    id: "mock-ar-1",
    triggeredBy: "cron",
    steps: "all",
    mode: "cautious",
    isPaused: false,
    rssArticlesFetched: 31,
    rssArticlesSaved: 9,
    backfillJobsRun: 1,
    backfillArticles: 6,
    bodiesFetched: 5,
    bodiesSkipped: 2,
    aiExtractionsRun: 3,
    draftsCreated: 2,
    deduplicatesFound: 1,
    errors: 0,
    errorMessages: null,
    durationMs: 18_450,
    completedAt: new Date(Date.now() - 1 * 60 * 60 * 1000),
    createdAt: new Date(Date.now() - 1 * 60 * 60 * 1000 - 18_450),
  },
  {
    id: "mock-ar-2",
    triggeredBy: "cron",
    steps: "all",
    mode: "cautious",
    isPaused: false,
    rssArticlesFetched: 18,
    rssArticlesSaved: 4,
    backfillJobsRun: 1,
    backfillArticles: 3,
    bodiesFetched: 4,
    bodiesSkipped: 1,
    aiExtractionsRun: 2,
    draftsCreated: 0,
    deduplicatesFound: 3,
    errors: 0,
    errorMessages: null,
    durationMs: 12_100,
    completedAt: new Date(Date.now() - 7 * 60 * 60 * 1000),
    createdAt: new Date(Date.now() - 7 * 60 * 60 * 1000 - 12_100),
  },
  {
    id: "mock-ar-3",
    triggeredBy: "manual",
    steps: "rss",
    mode: "cautious",
    isPaused: false,
    rssArticlesFetched: 14,
    rssArticlesSaved: 3,
    backfillJobsRun: 0,
    backfillArticles: 0,
    bodiesFetched: 0,
    bodiesSkipped: 0,
    aiExtractionsRun: 0,
    draftsCreated: 0,
    deduplicatesFound: 0,
    errors: 0,
    errorMessages: null,
    durationMs: 4_280,
    completedAt: new Date(Date.now() - 24 * 60 * 60 * 1000),
    createdAt: new Date(Date.now() - 24 * 60 * 60 * 1000 - 4_280),
  },
  {
    id: "mock-ar-4",
    triggeredBy: "cron",
    steps: "all",
    mode: "cautious",
    isPaused: false,
    rssArticlesFetched: 27,
    rssArticlesSaved: 11,
    backfillJobsRun: 1,
    backfillArticles: 8,
    bodiesFetched: 5,
    bodiesSkipped: 0,
    aiExtractionsRun: 3,
    draftsCreated: 3,
    deduplicatesFound: 2,
    errors: 1,
    errorMessages: "Body fetch for mock-article-x: fetch timeout after 8000ms",
    durationMs: 21_900,
    completedAt: new Date(Date.now() - 31 * 60 * 60 * 1000),
    createdAt: new Date(Date.now() - 31 * 60 * 60 * 1000 - 21_900),
  },
  {
    id: "mock-ar-5",
    triggeredBy: "cron",
    steps: "all",
    mode: "cautious",
    isPaused: false,
    rssArticlesFetched: 22,
    rssArticlesSaved: 6,
    backfillJobsRun: 0,
    backfillArticles: 0,
    bodiesFetched: 3,
    bodiesSkipped: 2,
    aiExtractionsRun: 2,
    draftsCreated: 1,
    deduplicatesFound: 1,
    errors: 0,
    errorMessages: null,
    durationMs: 9_800,
    completedAt: new Date(Date.now() - 55 * 60 * 60 * 1000),
    createdAt: new Date(Date.now() - 55 * 60 * 60 * 1000 - 9_800),
  },
];

export function mockAutomationSettings(): {
  settings: AutomationSettings;
  runs: AutomationRunRecord[];
  stats: {
    runsThisWeek: number;
    articlesThisWeek: number;
    bodiesThisWeek: number;
    extractionsThisWeek: number;
    draftsThisWeek: number;
    errorsThisWeek: number;
  };
} {
  const settings: AutomationSettings = {
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

  return {
    settings,
    runs: MOCK_RUNS,
    stats: {
      runsThisWeek: 4,
      articlesThisWeek: 28,
      bodiesThisWeek: 17,
      extractionsThisWeek: 10,
      draftsThisWeek: 6,
      errorsThisWeek: 1,
    },
  };
}
