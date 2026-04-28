import { randomUUID } from "node:crypto";
import Parser from "rss-parser";
import { FEEDS } from "@/lib/feeds";
import { appendMockIngestionResult, readMockPreviewState } from "@/lib/mock-preview-store";
import { mockFeedEntries } from "@/lib/mock-rss";
import { prisma } from "@/lib/prisma";

const parser = new Parser();

const RELEVANCE_KEYWORDS = [
  "series",
  "pilot",
  "development",
  "drama",
  "comedy",
  "sells to",
  "lands at",
  "ordered",
  "picked up",
  "renewal",
  "cancellation",
  "cast"
];

type FeedLike = {
  publicationName: string;
  feedUrl: string;
  category: string;
  enabled: boolean;
};

type IngestionMode = "real" | "mock";

export type IngestionSummary = {
  mode: IngestionMode;
  dataSource: "database" | "mock";
  startedAt: Date;
  completedAt: Date;
  feedsProcessed: number;
  fetched: number;
  saved: number;
  skipped: number;
  relevant: number;
  runId?: string;
  message: string;
};

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function normalizeUrl(urlValue?: string | null) {
  if (!urlValue) return null;
  try {
    const parsed = new URL(urlValue);
    parsed.hash = "";
    return parsed.toString();
  } catch {
    return null;
  }
}

function isRelevantHeadline(headline: string) {
  const normalized = headline.toLowerCase();
  return RELEVANCE_KEYWORDS.some((keyword) => normalized.includes(keyword));
}

function inferCategory(headline: string) {
  const normalized = headline.toLowerCase();
  if (normalized.includes("pilot")) return "Pilot Order";
  if (normalized.includes("renewal")) return "Renewal";
  if (normalized.includes("cancellation")) return "Cancellation";
  if (normalized.includes("cast")) return "Talent Attachment";
  if (normalized.includes("lands at") || normalized.includes("sells to")) return "Sale";
  if (normalized.includes("ordered") || normalized.includes("picked up")) return "Series Order";
  if (normalized.includes("development")) return "Development";
  if (normalized.includes("drama")) return "Drama";
  if (normalized.includes("comedy")) return "Comedy";
  return "General";
}

async function getConfiguredFeeds(): Promise<FeedLike[]> {
  const dbFeeds = await prisma.rssFeed.findMany({
    where: { enabled: true },
    orderBy: { publicationName: "asc" }
  });

  if (dbFeeds.length) return dbFeeds;

  return FEEDS.map((feed) => ({
    publicationName: feed.name,
    feedUrl: feed.url,
    category: feed.category,
    enabled: true
  }));
}

async function fetchFeedItems(feed: FeedLike) {
  const response = await fetch(feed.feedUrl, {
    headers: {
      "user-agent": "TV Market Intelligence Hub/0.1 (local RSS ingestion)",
      accept: "application/rss+xml, application/xml, text/xml;q=0.9, */*;q=0.8"
    },
    cache: "no-store"
  });

  if (!response.ok) {
    throw new Error(`Feed request failed with ${response.status}`);
  }

  const xml = await response.text();
  const parsed = await parser.parseString(xml);
  return (parsed.items ?? []).map((item) => ({
    title: item.title ?? "Untitled RSS item",
    url: normalizeUrl(item.link ?? item.guid) ?? "",
    publishedDate: item.isoDate ? new Date(item.isoDate) : item.pubDate ? new Date(item.pubDate) : null,
    summary: item.contentSnippet ?? item.summary ?? null
  }));
}

export async function ingestRSSFeeds(mode: IngestionMode = "real"): Promise<IngestionSummary> {
  const startedAt = new Date();

  if (mode === "mock") {
    const articles = [];
    let fetched = 0;
    let saved = 0;
    let skipped = 0;

    const previewState = await readMockPreviewState();
    const previewUrls = new Set(previewState.reviewArticles.map((article) => article.url));

    for (const feed of mockFeedEntries) {
      for (const item of feed.items) {
        fetched += 1;
        if (!isRelevantHeadline(item.title)) continue;

        const url = normalizeUrl(item.url);
        if (!url || previewUrls.has(url)) {
          skipped += 1;
          continue;
        }

        previewUrls.add(url);
        saved += 1;
        articles.push({
          id: randomUUID(),
          headline: item.title,
          publication: feed.publication,
          publishedDate: item.publishedAt ? new Date(item.publishedAt) : null,
          url,
          sourceType: "rss",
          extractionStatus: "Needs Review",
          suspectedCategory: inferCategory(item.title),
          confidenceScore: 0.61,
          summary: item.summary,
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
          extractedAnnouncementDate: item.publishedAt ? new Date(item.publishedAt) : null,
          extractedPremiereDate: null,
          extractedRelationships: null
        });
      }
    }

    const completedAt = new Date();

    try {
      const existingArticles = await prisma.article.findMany({ select: { url: true } });
      const existingUrls = new Set(existingArticles.map((article) => article.url));
      let dbSaved = 0;
      let dbSkipped = 0;

      for (const article of articles) {
        if (existingUrls.has(article.url)) {
          dbSkipped += 1;
          continue;
        }
        existingUrls.add(article.url);
        dbSaved += 1;
        await prisma.article.create({
          data: {
            url: article.url,
            headline: article.headline,
            publication: article.publication,
            publishedDate: article.publishedDate,
            summary: article.summary,
            sourceType: "rss",
            ingestionSource: "RSS",
            extractionStatus: "Needs Review",
            needsReview: true,
            suspectedCategory: article.suspectedCategory,
            confidenceScore: article.confidenceScore
          }
        });
      }

      const run = await prisma.ingestionRun.create({
        data: {
          sourceType: "rss_mock",
          sourceName: "Mock RSS",
          status: "completed",
          itemsFetched: fetched,
          itemsSaved: dbSaved,
          itemsSkipped: skipped + dbSkipped,
          startedAt,
          completedAt,
          notes: "Mock ingestion run for local preview and workflow testing."
        }
      });

      return {
        mode,
        dataSource: "database",
        startedAt,
        completedAt,
        feedsProcessed: mockFeedEntries.length,
        fetched,
        saved: dbSaved,
        skipped: skipped + dbSkipped,
        relevant: articles.length + skipped,
        runId: run.id,
        message: dbSaved ? "Mock ingestion completed and queued new articles for review." : "Mock ingestion completed with no new relevant articles."
      };
    } catch {
      await appendMockIngestionResult({
        articles,
        run: {
          sourceType: "rss_mock",
          sourceName: "Mock RSS",
          status: "completed",
          itemsFetched: fetched,
          itemsSaved: saved,
          itemsSkipped: skipped,
          startedAt,
          completedAt,
          notes: "Mock ingestion run stored in preview state."
        }
      });

      return {
        mode,
        dataSource: "mock",
        startedAt,
        completedAt,
        feedsProcessed: mockFeedEntries.length,
        fetched,
        saved,
        skipped,
        relevant: articles.length + skipped,
        message: saved ? "Mock ingestion completed in preview mode." : "Mock ingestion completed with no new relevant articles."
      };
    }
  }

  const feeds = await getConfiguredFeeds();
  let fetched = 0;
  let saved = 0;
  let skipped = 0;
  let relevant = 0;

  for (const feed of feeds) {
    const items = await fetchFeedItems(feed);
    fetched += items.length;

    for (const item of items) {
      if (!item.url || !item.title || !isRelevantHeadline(item.title)) continue;
      relevant += 1;

      const existing = await prisma.article.findUnique({ where: { url: item.url }, select: { id: true } });
      if (existing) {
        skipped += 1;
        continue;
      }

      await prisma.article.create({
        data: {
          url: item.url,
          headline: item.title,
          publication: feed.publicationName,
          publishedDate: item.publishedDate,
          summary: item.summary,
          sourceType: "rss",
          ingestionSource: "RSS",
          extractionStatus: "Needs Review",
          needsReview: true,
          suspectedCategory: inferCategory(item.title),
          confidenceScore: 0.6
        }
      });

      saved += 1;
    }

    await prisma.rssFeed.updateMany({
      where: { feedUrl: feed.feedUrl },
      data: { lastChecked: new Date() }
    });

    await sleep(400);
  }

  const completedAt = new Date();
  const run = await prisma.ingestionRun.create({
    data: {
      sourceType: "rss",
      sourceName: feeds.length === 1 ? feeds[0].publicationName : "RSS Feed Batch",
      status: "completed",
      itemsFetched: fetched,
      itemsSaved: saved,
      itemsSkipped: skipped,
      startedAt,
      completedAt,
      notes: `Relevant headlines matched simple keyword filter: ${relevant}.`
    }
  });

  return {
    mode,
    dataSource: "database",
    startedAt,
    completedAt,
    feedsProcessed: feeds.length,
    fetched,
    saved,
    skipped,
    relevant,
    runId: run.id,
    message: saved ? "RSS ingestion completed and queued new articles for review." : "RSS ingestion completed with no new relevant articles."
  };
}
