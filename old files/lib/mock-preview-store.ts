import { randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { mockBackfillJobs, type MockBackfillJob } from "@/lib/mock-backfill";
import type { JobRunStatusValue } from "@/lib/job-control";
import { mockReviewArticles, type MockReviewArticle } from "@/lib/mock-review";
import { mockIngestionRuns, type MockIngestionRun } from "@/lib/mock-sources";

export type MockJobRun = {
  id: string;
  jobType: string;
  status: JobRunStatusValue;
  startedAt: Date | null;
  completedAt: Date | null;
  createdByUserId: string | null;
  createdByEmail: string | null;
  inputJson: unknown;
  resultJson: unknown;
  errorMessage: string | null;
  lockKey: string | null;
  createdAt: Date;
  updatedAt: Date;
};

type MockPreviewState = {
  backfillJobs: MockBackfillJob[];
  reviewArticles: MockReviewArticle[];
  ingestionRuns: MockIngestionRun[];
  jobRuns: MockJobRun[];
};

const storagePath = path.join(process.cwd(), "data", "mock-preview-state.json");

function baseState(): MockPreviewState {
  return {
    backfillJobs: [...mockBackfillJobs],
    reviewArticles: [...mockReviewArticles],
    ingestionRuns: [...mockIngestionRuns],
    jobRuns: []
  };
}

function reviveState(raw: MockPreviewState): MockPreviewState {
  return {
    backfillJobs: (raw.backfillJobs ?? mockBackfillJobs).map((job) => ({
      ...job,
      keywords: job.keywords ?? null,
      lastError: job.lastError ?? null,
      createdAt: new Date(job.createdAt),
      updatedAt: new Date(job.updatedAt),
      completedAt: job.completedAt ? new Date(job.completedAt) : null
    })),
    reviewArticles: raw.reviewArticles.map((article) => ({
      ...article,
      publishedDate: article.publishedDate ? new Date(article.publishedDate) : null,
      bodyFetchedAt: article.bodyFetchedAt ? new Date(article.bodyFetchedAt) : null,
      extractedAnnouncementDate: article.extractedAnnouncementDate ? new Date(article.extractedAnnouncementDate) : null,
      extractedPremiereDate: article.extractedPremiereDate ? new Date(article.extractedPremiereDate) : null,
      rawHtml: article.rawHtml ?? null,
      extractedText: article.extractedText ?? null,
      extractedExcerpt: article.extractedExcerpt ?? null,
      extractionMethod: article.extractionMethod ?? null,
      bodyFetchStatus: article.bodyFetchStatus ?? "not_fetched",
      bodyFetchError: article.bodyFetchError ?? null,
      robotsAllowed: article.robotsAllowed ?? null,
      paywallLikely: article.paywallLikely ?? false,
      sourceReliability: article.sourceReliability ?? null,
      relevanceScore: article.relevanceScore ?? null,
      relevanceBand: article.relevanceBand ?? null,
      relevanceReasons: article.relevanceReasons ?? null,
      relevanceDecision: article.relevanceDecision ?? null,
      extractionConfidence: article.extractionConfidence ?? article.confidenceScore ?? null,
      extractionSource: article.extractionSource ?? null,
      bodyAvailable: article.bodyAvailable ?? Boolean(article.extractedText),
      needsReview: article.needsReview ?? (article.extractionStatus === "Needs Review" || article.extractionStatus === "New"),
      extractionMode: article.extractionMode ?? null,
      extractedGenre: article.extractedGenre ?? null,
      extractedSourceMaterial: article.extractedSourceMaterial ?? null,
      extractedIsAcquisition: article.extractedIsAcquisition ?? null,
      extractedIsCoProduction: article.extractedIsCoProduction ?? null,
      extractedIsInternational: article.extractedIsInternational ?? null,
      extractedFieldsNeedingReview: article.extractedFieldsNeedingReview ?? null,
      extractedDeduplicationNotes: article.extractedDeduplicationNotes ?? null,
      extractedStructuredDataJson: article.extractedStructuredDataJson ?? null,
      aiExtractionError: article.aiExtractionError ?? null
    })),
    ingestionRuns: raw.ingestionRuns.map((run) => ({
      ...run,
      startedAt: new Date(run.startedAt),
      completedAt: run.completedAt ? new Date(run.completedAt) : null
    })),
    jobRuns: (raw.jobRuns ?? []).map((job) => ({
      ...job,
      status: job.status ?? "queued",
      startedAt: job.startedAt ? new Date(job.startedAt) : null,
      completedAt: job.completedAt ? new Date(job.completedAt) : null,
      createdByUserId: job.createdByUserId ?? null,
      createdByEmail: job.createdByEmail ?? null,
      inputJson: job.inputJson ?? null,
      resultJson: job.resultJson ?? null,
      errorMessage: job.errorMessage ?? null,
      lockKey: job.lockKey ?? null,
      createdAt: new Date(job.createdAt),
      updatedAt: new Date(job.updatedAt)
    }))
  };
}

export async function readMockPreviewState() {
  try {
    const contents = await readFile(storagePath, "utf8");
    return reviveState(JSON.parse(contents) as MockPreviewState);
  } catch {
    return baseState();
  }
}

async function writeMockPreviewState(state: MockPreviewState) {
  await mkdir(path.dirname(storagePath), { recursive: true });
  await writeFile(storagePath, JSON.stringify(state, null, 2), "utf8");
}

export async function appendMockIngestionResult(result: {
  articles: MockReviewArticle[];
  run: Omit<MockIngestionRun, "id">;
}) {
  const current = await readMockPreviewState();
  const reviewByUrl = new Map(current.reviewArticles.map((article) => [article.url, article]));

  for (const article of result.articles) {
    reviewByUrl.set(article.url, article);
  }

  const nextState: MockPreviewState = {
    ...current,
    backfillJobs: current.backfillJobs,
    reviewArticles: Array.from(reviewByUrl.values()).sort((a, b) => {
      const aDate = a.publishedDate ? new Date(a.publishedDate).getTime() : 0;
      const bDate = b.publishedDate ? new Date(b.publishedDate).getTime() : 0;
      return bDate - aDate;
    }),
    ingestionRuns: [
      {
        id: randomUUID(),
        ...result.run
      },
      ...current.ingestionRuns
    ].slice(0, 20)
  };

  await writeMockPreviewState(nextState);
  return nextState;
}

export async function updateMockReviewArticle(
  articleId: string,
  updater: (article: MockReviewArticle) => MockReviewArticle | Promise<MockReviewArticle>
) {
  const current = await readMockPreviewState();
  let changed = false;

  const nextArticles = [];
  for (const article of current.reviewArticles) {
    if (article.id !== articleId) {
      nextArticles.push(article);
      continue;
    }

    changed = true;
    nextArticles.push(await updater(article));
  }

  const nextState: MockPreviewState = {
    ...current,
    reviewArticles: nextArticles
  };

  if (changed) {
    await writeMockPreviewState(nextState);
  }

  return nextState;
}

export async function saveMockBackfillJobs(backfillJobs: MockBackfillJob[]) {
  const current = await readMockPreviewState();
  const nextState: MockPreviewState = {
    ...current,
    backfillJobs
  };

  await writeMockPreviewState(nextState);
  return nextState;
}

export async function saveMockJobRuns(jobRuns: MockJobRun[]) {
  const current = await readMockPreviewState();
  const nextState: MockPreviewState = {
    ...current,
    jobRuns
  };

  await writeMockPreviewState(nextState);
  return nextState;
}
