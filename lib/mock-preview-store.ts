import { randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { mockReviewArticles, type MockReviewArticle } from "@/lib/mock-review";
import { mockIngestionRuns, type MockIngestionRun } from "@/lib/mock-sources";

type MockPreviewState = {
  reviewArticles: MockReviewArticle[];
  ingestionRuns: MockIngestionRun[];
};

const storagePath = path.join(process.cwd(), "data", "mock-preview-state.json");

function baseState(): MockPreviewState {
  return {
    reviewArticles: [...mockReviewArticles],
    ingestionRuns: [...mockIngestionRuns]
  };
}

function reviveState(raw: MockPreviewState): MockPreviewState {
  return {
    reviewArticles: raw.reviewArticles.map((article) => ({
      ...article,
      publishedDate: article.publishedDate ? new Date(article.publishedDate) : null,
      extractedAnnouncementDate: article.extractedAnnouncementDate ? new Date(article.extractedAnnouncementDate) : null,
      extractedPremiereDate: article.extractedPremiereDate ? new Date(article.extractedPremiereDate) : null,
      extractionMode: article.extractionMode ?? null,
      extractedFieldsNeedingReview: article.extractedFieldsNeedingReview ?? null,
      extractedDeduplicationNotes: article.extractedDeduplicationNotes ?? null
    })),
    ingestionRuns: raw.ingestionRuns.map((run) => ({
      ...run,
      startedAt: new Date(run.startedAt),
      completedAt: run.completedAt ? new Date(run.completedAt) : null
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
