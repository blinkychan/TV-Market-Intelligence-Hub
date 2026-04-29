import { randomUUID } from "node:crypto";
import { endOfMonth, format, parse, startOfMonth } from "date-fns";
import { BACKFILL_KEYWORD_SETS, mockHistoricalArticles, type BackfillJobStatus, type MockBackfillJob } from "@/lib/mock-backfill";
import { appendMockIngestionResult, readMockPreviewState, saveMockBackfillJobs } from "@/lib/mock-preview-store";
import { canUseMockPreview, mockPreviewDisabledReason } from "@/lib/runtime-mode";
import { prisma } from "@/lib/prisma";
import type { MockReviewArticle } from "@/lib/mock-review";

export type BackfillMode = "auto" | "real" | "mock";

export type BackfillJobInput = {
  source: string;
  startMonth: string;
  endMonth: string;
  keywordSetId?: string;
  keywords?: string;
  category?: string;
};

export type BackfillJobRecord = {
  id: string;
  source: string;
  year: number;
  month: number;
  keywords: string | null;
  status: BackfillJobStatus;
  articlesFound: number;
  articlesSaved: number;
  duplicatesSkipped: number;
  lastError: string | null;
  createdAt: Date;
  updatedAt: Date;
  completedAt: Date | null;
};

export type BackfillDashboardData = {
  dataSource: "database" | "mock";
  jobs: BackfillJobRecord[];
  logs: {
    id: string;
    sourceType: string;
    sourceName: string | null;
    status: string;
    itemsFetched: number;
    itemsSaved: number;
    itemsSkipped: number;
    startedAt: Date;
    completedAt: Date | null;
    notes: string | null;
  }[];
  statusPanel: {
    queuedJobs: number;
    completedJobs: number;
    failedJobs: number;
    articlesSaved: number;
    estimatedRemainingJobs: number;
  };
  errorMessage?: string;
};

export type RunNextBackfillSummary = {
  dataSource: "database" | "mock";
  jobId?: string;
  status: "idle" | "completed" | "failed";
  source?: string;
  year?: number;
  month?: number;
  articlesFound: number;
  articlesSaved: number;
  duplicatesSkipped: number;
  message: string;
};

type CandidateArticle = {
  url: string;
  headline: string;
  publication: string;
  publishedDate: Date | null;
  summary: string | null;
  suspectedCategory: string | null;
  rawText?: string | null;
};

function parseMonthInput(value: string) {
  return parse(`${value}-01`, "yyyy-MM-dd", new Date());
}

function monthRange(startMonth: string, endMonth: string) {
  const months: Array<{ year: number; month: number }> = [];
  let current = startOfMonth(parseMonthInput(startMonth));
  const end = endOfMonth(parseMonthInput(endMonth));

  while (current <= end) {
    months.push({ year: current.getFullYear(), month: current.getMonth() + 1 });
    current = startOfMonth(new Date(current.getFullYear(), current.getMonth() + 1, 1));
  }

  return months;
}

function combineKeywords(input: BackfillJobInput) {
  const keywordSet = BACKFILL_KEYWORD_SETS.find((item) => item.id === input.keywordSetId);
  const parts = [keywordSet?.label ? `Keyword Set: ${keywordSet.label}` : null, input.keywords?.trim() || null, input.category?.trim() ? `Category: ${input.category.trim()}` : null];
  return parts.filter(Boolean).join(" | ") || null;
}

function summarizeJobSource(job: Pick<BackfillJobRecord, "source" | "year" | "month">) {
  return `${job.source} ${job.year}-${String(job.month).padStart(2, "0")}`;
}

function backfillPriorityScore(status: string) {
  if (status === "running") return 0;
  if (status === "queued") return 1;
  if (status === "paused") return 2;
  if (status === "failed") return 3;
  return 4;
}

function normalizeBackfillJobStatus(status: string): BackfillJobStatus {
  if (status === "queued" || status === "running" || status === "completed" || status === "failed" || status === "paused") {
    return status;
  }

  return "queued";
}

type BackfillJobDraft = Omit<MockBackfillJob, "id" | "createdAt" | "updatedAt" | "completedAt">;

function compareBackfillPriority(
  a: Pick<BackfillJobRecord, "status" | "year" | "month" | "createdAt">,
  b: Pick<BackfillJobRecord, "status" | "year" | "month" | "createdAt">
) {
  const statusDifference = backfillPriorityScore(a.status) - backfillPriorityScore(b.status);
  if (statusDifference !== 0) return statusDifference;
  if (a.year !== b.year) return b.year - a.year;
  if (a.month !== b.month) return b.month - a.month;
  return b.createdAt.getTime() - a.createdAt.getTime();
}

function toStoredRawText(article: CandidateArticle) {
  if (!bodyExtractionAvailable()) return null;
  return article.rawText ?? null;
}

function bodyExtractionAvailable() {
  return false;
}

async function robotsAllowsBodyFetch(_url: string) {
  return false;
}

async function maybeFetchBody(article: CandidateArticle) {
  if (!bodyExtractionAvailable()) return null;
  if (!(await robotsAllowsBodyFetch(article.url))) return null;
  return article.rawText ?? null;
}

function historicalSearchAdapterAvailable() {
  return false;
}

function filterMockArticles(job: Pick<BackfillJobRecord, "source" | "year" | "month" | "keywords">): CandidateArticle[] {
  const monthKey = `${job.year}-${String(job.month).padStart(2, "0")}`;
  const keywordText = (job.keywords ?? "").toLowerCase();

  return mockHistoricalArticles
    .filter((article) => article.source === job.source && article.publishedDate.startsWith(monthKey))
    .filter((article) => {
      if (!keywordText) return true;
      return article.keywords.some((keyword) => keywordText.includes(keyword.toLowerCase())) || article.headline.toLowerCase().includes(keywordText);
    })
    .map((article) => ({
      url: article.url,
      headline: article.headline,
      publication: article.source,
      publishedDate: new Date(article.publishedDate),
      summary: article.summary,
      suspectedCategory: article.category,
      rawText: article.bodyText ?? null
    }));
}

async function fetchHistoricalCandidates(job: BackfillJobRecord, mode: "database" | "mock") {
  if (mode === "mock") {
    return filterMockArticles(job);
  }

  return [] as CandidateArticle[];
}

async function createBackfillLog(data: {
  sourceName: string;
  status: string;
  itemsFetched: number;
  itemsSaved: number;
  itemsSkipped: number;
  notes: string;
}) {
  return prisma.ingestionRun.create({
    data: {
      sourceType: "backfill",
      sourceName: data.sourceName,
      status: data.status,
      itemsFetched: data.itemsFetched,
      itemsSaved: data.itemsSaved,
      itemsSkipped: data.itemsSkipped,
      startedAt: new Date(),
      completedAt: new Date(),
      notes: data.notes
    }
  });
}

function normalizeBackfillJobRecord(job: {
  id: string;
  source: string;
  year: number;
  month: number;
  keywords: string | null;
  status: string;
  articlesFound: number;
  articlesSaved: number;
  duplicatesSkipped: number;
  lastError: string | null;
  createdAt: Date;
  updatedAt: Date;
  completedAt: Date | null;
}): BackfillJobRecord {
  return {
    ...job,
    status: normalizeBackfillJobStatus(job.status)
  };
}

export async function createBackfillJobs(input: BackfillJobInput): Promise<{ count: number; dataSource: "database" | "mock" }> {
  const source = input.source.trim();
  if (!source || !input.startMonth || !input.endMonth) {
    return { count: 0, dataSource: "database" };
  }

  const jobs: BackfillJobDraft[] = monthRange(input.startMonth, input.endMonth).map(({ year, month }) => ({
    source,
    year,
    month,
    keywords: combineKeywords(input),
    status: "queued" as BackfillJobStatus,
    articlesFound: 0,
    articlesSaved: 0,
    duplicatesSkipped: 0,
    lastError: null
  }));

  try {
    for (const job of jobs) {
      const existing = await prisma.backfillJob.findFirst({
        where: { source: job.source, year: job.year, month: job.month, keywords: job.keywords }
      });

      if (!existing) {
        await prisma.backfillJob.create({ data: job });
      }
    }

    await createBackfillLog({
      sourceName: source,
      status: "queued",
      itemsFetched: 0,
      itemsSaved: 0,
      itemsSkipped: 0,
      notes: `Queued ${jobs.length} backfill job(s) covering ${input.startMonth} through ${input.endMonth}.`
    });

    return { count: jobs.length, dataSource: "database" };
  } catch {
    const previewState = await readMockPreviewState();
    const nextJobs = [...previewState.backfillJobs];

    for (const job of jobs) {
      const exists = nextJobs.some(
        (item) => item.source === job.source && item.year === job.year && item.month === job.month && (item.keywords ?? null) === (job.keywords ?? null)
      );

      if (!exists) {
        nextJobs.push({
          id: randomUUID(),
          ...job,
          createdAt: new Date(),
          updatedAt: new Date(),
          completedAt: null
        });
      }
    }

    await saveMockBackfillJobs(nextJobs.sort(compareBackfillPriority));
    await appendMockIngestionResult({
      articles: [],
      run: {
        sourceType: "backfill",
        sourceName: source,
        status: "queued",
        itemsFetched: 0,
        itemsSaved: 0,
        itemsSkipped: 0,
        startedAt: new Date(),
        completedAt: new Date(),
        notes: `Queued ${jobs.length} mock backfill job(s) covering ${input.startMonth} through ${input.endMonth}.`
      }
    });

    return { count: jobs.length, dataSource: "mock" };
  }
}

async function runNextDatabaseBackfillJob(): Promise<RunNextBackfillSummary> {
  if (!historicalSearchAdapterAvailable()) {
    await createBackfillLog({
      sourceName: "Backfill Queue",
      status: "paused",
      itemsFetched: 0,
      itemsSaved: 0,
      itemsSkipped: 0,
      notes: "No historical search adapter is configured yet. Plug in a search API or continue with manual URL entry and mock backfill preview."
    }).catch(() => {});

    return {
      dataSource: "database",
      status: "idle",
      articlesFound: 0,
      articlesSaved: 0,
      duplicatesSkipped: 0,
      message: "No historical search adapter is configured yet, so queued jobs were left untouched."
    };
  }

  const nextJob = await prisma.backfillJob.findFirst({
    where: { status: { in: ["queued", "paused"] } },
    orderBy: [{ year: "desc" }, { month: "desc" }, { createdAt: "desc" }]
  });

  if (!nextJob) {
    return {
      dataSource: "database",
      status: "idle",
      articlesFound: 0,
      articlesSaved: 0,
      duplicatesSkipped: 0,
      message: "No queued backfill jobs are waiting."
    };
  }

  const normalizedNextJob: BackfillJobRecord = {
    ...nextJob,
    status: normalizeBackfillJobStatus(nextJob.status)
  };

  await prisma.backfillJob.update({
    where: { id: nextJob.id },
    data: { status: "running", lastError: null }
  });

  try {
    const candidates = await fetchHistoricalCandidates(normalizedNextJob, "database");
    const existingUrls = new Set((await prisma.article.findMany({ select: { url: true } })).map((article) => article.url));

    let articlesSaved = 0;
    let duplicatesSkipped = 0;

    for (const candidate of candidates) {
      if (existingUrls.has(candidate.url)) {
        duplicatesSkipped += 1;
        continue;
      }

      existingUrls.add(candidate.url);

      await prisma.article.create({
        data: {
          url: candidate.url,
          headline: candidate.headline,
          publication: candidate.publication,
          publishedDate: candidate.publishedDate,
          summary: candidate.summary,
          rawText: toStoredRawText({ ...candidate, rawText: await maybeFetchBody(candidate) }),
          sourceType: "backfill",
          ingestionSource: "Backfill",
          extractionStatus: "Needs Review",
          needsReview: true,
          suspectedCategory: candidate.suspectedCategory,
          confidenceScore: 0.55
        }
      });

      articlesSaved += 1;
    }

    const status = candidates.length === 0 ? "failed" : "completed";
    const completedAt = new Date();
    const note =
      candidates.length === 0
        ? "No historical search adapter is configured yet. Plug in a search API or use manual URL entry for live backfill retrieval."
        : `Processed one backfill batch from ${summarizeJobSource(normalizedNextJob)}.`;

    await prisma.backfillJob.update({
      where: { id: nextJob.id },
      data: {
        status,
        articlesFound: candidates.length,
        articlesSaved,
        duplicatesSkipped,
        lastError: status === "failed" ? note : null,
        completedAt
      }
    });

    await createBackfillLog({
      sourceName: summarizeJobSource(normalizedNextJob),
      status,
      itemsFetched: candidates.length,
      itemsSaved: articlesSaved,
      itemsSkipped: duplicatesSkipped,
      notes: note
    });

    return {
      dataSource: "database",
      jobId: nextJob.id,
      status: status === "completed" ? "completed" : "failed",
      source: normalizedNextJob.source,
      year: normalizedNextJob.year,
      month: normalizedNextJob.month,
      articlesFound: candidates.length,
      articlesSaved,
      duplicatesSkipped,
      message: note
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Backfill run failed.";

    await prisma.backfillJob.update({
      where: { id: nextJob.id },
      data: {
        status: "failed",
        lastError: message,
        completedAt: new Date()
      }
    });

    await createBackfillLog({
      sourceName: summarizeJobSource(normalizedNextJob),
      status: "failed",
      itemsFetched: 0,
      itemsSaved: 0,
      itemsSkipped: 0,
      notes: message
    });

    return {
      dataSource: "database",
      jobId: nextJob.id,
      status: "failed",
      source: normalizedNextJob.source,
      year: normalizedNextJob.year,
      month: normalizedNextJob.month,
      articlesFound: 0,
      articlesSaved: 0,
      duplicatesSkipped: 0,
      message
    };
  }
}

async function runNextMockBackfillJob(): Promise<RunNextBackfillSummary> {
  const previewState = await readMockPreviewState();
  const nextJob = [...previewState.backfillJobs]
    .filter((job) => job.status === "queued" || job.status === "paused")
    .sort(compareBackfillPriority)[0];

  if (!nextJob) {
    return {
      dataSource: "mock",
      status: "idle",
      articlesFound: 0,
      articlesSaved: 0,
      duplicatesSkipped: 0,
      message: "No queued mock backfill jobs are waiting."
    };
  }

  const runningJobs = previewState.backfillJobs.map((job) =>
    job.id === nextJob.id ? { ...job, status: "running", lastError: null, updatedAt: new Date() } : job
  );
  await saveMockBackfillJobs(runningJobs);

  const candidates = await fetchHistoricalCandidates(nextJob, "mock");
  const existingUrls = new Set(previewState.reviewArticles.map((article) => article.url));
  const articles: MockReviewArticle[] = [];
  let duplicatesSkipped = 0;

  for (const candidate of candidates) {
    if (existingUrls.has(candidate.url)) {
      duplicatesSkipped += 1;
      continue;
    }

    existingUrls.add(candidate.url);
    articles.push({
      id: randomUUID(),
      headline: candidate.headline,
      publication: candidate.publication,
      publishedDate: candidate.publishedDate,
      url: candidate.url,
      sourceType: "backfill",
      extractionStatus: "Needs Review",
      extractionMode: "mock",
      suspectedCategory: candidate.suspectedCategory,
      confidenceScore: 0.58,
      summary: candidate.summary,
      linkedProjectId: null,
      linkedProjectTitle: null,
      linkedShowId: null,
      linkedShowTitle: null,
      extractedProjectTitle: null,
      extractedFormat: null,
      extractedStatus: null,
      extractedLogline: null,
      extractedBuyer: null,
      extractedStudio: null,
      extractedCompanies: null,
      extractedPeople: null,
      extractedCountry: null,
      extractedAnnouncementDate: candidate.publishedDate,
      extractedPremiereDate: null,
      extractedRelationships: null,
      extractedFieldsNeedingReview: "buyer, studio, people",
      extractedDeduplicationNotes: null
    });
  }

  const status: BackfillJobStatus = "completed";
  const now = new Date();
  await appendMockIngestionResult({
    articles,
    run: {
      sourceType: "backfill",
      sourceName: summarizeJobSource(nextJob),
      status,
      itemsFetched: candidates.length,
      itemsSaved: articles.length,
      itemsSkipped: duplicatesSkipped,
      startedAt: now,
      completedAt: now,
      notes: `Processed one mock backfill batch from ${summarizeJobSource(nextJob)}.`
    }
  });

  const refreshedState = await readMockPreviewState();
  const finalJobs = refreshedState.backfillJobs.map((job) =>
    job.id === nextJob.id
      ? {
          ...job,
          status,
          articlesFound: candidates.length,
          articlesSaved: articles.length,
          duplicatesSkipped,
          lastError: null,
          updatedAt: now,
          completedAt: now
        }
      : job
  );
  await saveMockBackfillJobs(finalJobs);

  return {
    dataSource: "mock",
    jobId: nextJob.id,
    status: "completed",
    source: nextJob.source,
    year: nextJob.year,
    month: nextJob.month,
    articlesFound: candidates.length,
    articlesSaved: articles.length,
    duplicatesSkipped,
    message: `Processed one mock backfill batch from ${summarizeJobSource(nextJob)}.`
  };
}

export async function runNextBackfillJob(mode: BackfillMode = "auto"): Promise<RunNextBackfillSummary> {
  if (mode === "mock") {
    return runNextMockBackfillJob();
  }

  if (mode === "real") {
    return runNextDatabaseBackfillJob();
  }

  try {
    return await runNextDatabaseBackfillJob();
  } catch {
    if (!canUseMockPreview()) {
      return {
        dataSource: "database",
        status: "failed",
        articlesFound: 0,
        articlesSaved: 0,
        duplicatesSkipped: 0,
        message: mockPreviewDisabledReason() ?? "Mock preview is disabled in production."
      };
    }
    return runNextMockBackfillJob();
  }
}

export async function getBackfillDashboardData(): Promise<BackfillDashboardData> {
  try {
    const [jobs, logs] = await Promise.all([
      prisma.backfillJob.findMany(),
      prisma.ingestionRun.findMany({ where: { sourceType: "backfill" }, orderBy: { startedAt: "desc" }, take: 12 })
    ]);

    const sortedJobs = jobs.map(normalizeBackfillJobRecord).sort(compareBackfillPriority);

    return {
      dataSource: "database",
      jobs: sortedJobs,
      logs,
      statusPanel: {
        queuedJobs: sortedJobs.filter((job) => job.status === "queued" || job.status === "paused").length,
        completedJobs: sortedJobs.filter((job) => job.status === "completed").length,
        failedJobs: sortedJobs.filter((job) => job.status === "failed").length,
        articlesSaved: sortedJobs.reduce((total, job) => total + job.articlesSaved, 0),
        estimatedRemainingJobs: sortedJobs.filter((job) => job.status === "queued" || job.status === "paused" || job.status === "running").length
      }
    };
  } catch (error) {
    if (!canUseMockPreview()) {
      return {
        dataSource: "database",
        jobs: [],
        logs: [],
        statusPanel: {
          queuedJobs: 0,
          completedJobs: 0,
          failedJobs: 0,
          articlesSaved: 0,
          estimatedRemainingJobs: 0
        },
        errorMessage: mockPreviewDisabledReason() ?? (error instanceof Error ? error.message : "Unknown backfill queue error.")
      };
    }

    const previewState = await readMockPreviewState();
    const jobs = [...previewState.backfillJobs].sort(compareBackfillPriority);
    const logs = previewState.ingestionRuns.filter((run) => run.sourceType === "backfill");

    return {
      dataSource: "mock",
      jobs,
      logs,
      statusPanel: {
        queuedJobs: jobs.filter((job) => job.status === "queued" || job.status === "paused").length,
        completedJobs: jobs.filter((job) => job.status === "completed").length,
        failedJobs: jobs.filter((job) => job.status === "failed").length,
        articlesSaved: jobs.reduce((total, job) => total + job.articlesSaved, 0),
        estimatedRemainingJobs: jobs.filter((job) => job.status === "queued" || job.status === "paused" || job.status === "running").length
      },
      errorMessage: error instanceof Error ? error.message : "Unknown backfill queue error."
    };
  }
}

export function formatJobMonth(job: Pick<BackfillJobRecord, "year" | "month">) {
  return format(new Date(job.year, job.month - 1, 1), "MMMM yyyy");
}
