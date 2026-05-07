import { randomUUID } from "node:crypto";
import Parser from "rss-parser";
import { detectArticleMissingData, syncMissingDataFlags, upsertSourceCoverage } from "@/lib/data-quality";
import { FEEDS } from "@/lib/feeds";
import { appendMockIngestionResult, readMockPreviewState } from "@/lib/mock-preview-store";
import { logOperationalEvent } from "@/lib/ops-log";
import { mockFeedEntries } from "@/lib/mock-rss";
import { prisma } from "@/lib/prisma";
import { scoreArticleRelevance } from "@/lib/source-relevance";
import { getSourceConnector } from "@/lib/source-connectors";
import { inferSourceReliability } from "@/lib/source-reliability";
import { triggerWatchlistAlertsForEntity } from "@/lib/watchlists";

const parser = new Parser();

type FeedLike = {
  publicationName: string;
  feedUrl: string;
  category: string;
  enabled: boolean;
  baseUrl?: string | null;
  reliabilityScore?: number | null;
  allowedCategories?: string | null;
  blockedKeywords?: string | null;
  preferredKeywords?: string | null;
  sourceType?: string | null;
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

type FeedRunStats = {
  included: number;
  possible: number;
  excluded: number;
  high: number;
  medium: number;
  low: number;
  reasons: string[];
};

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function feedConnectorOverride(feed: FeedLike) {
  return {
    name: feed.publicationName,
    sourceType: (feed.sourceType as "trade" | "official_press" | "calendar" | "manual_csv" | "search_api" | "rss" | undefined) ?? "rss",
    baseUrl: feed.baseUrl ?? "",
    rssUrls: [feed.feedUrl],
    enabled: feed.enabled,
    reliabilityScore: feed.reliabilityScore ?? 0.7,
    allowedCategories: String(feed.allowedCategories ?? "")
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean),
    blockedKeywords: String(feed.blockedKeywords ?? "")
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean),
    preferredKeywords: String(feed.preferredKeywords ?? "")
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean),
    notes: feed.category
  };
}

function topExclusionReasons(reasons: string[]) {
  const counts = new Map<string, number>();
  for (const reason of reasons) {
    counts.set(reason, (counts.get(reason) ?? 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([reason, count]) => `${reason} (${count})`)
    .join("; ");
}

async function fetchFeedXml(url: string) {
  const delays = [300, 900];
  let attempts = 0;

  while (true) {
    const response = await fetch(url, {
      headers: {
        "user-agent": "TV Market Intelligence Hub/0.1 (local RSS ingestion)",
        accept: "application/rss+xml, application/xml, text/xml;q=0.9, */*;q=0.8"
      },
      cache: "no-store"
    });

    if (response.ok || response.status === 401 || response.status === 403 || response.status < 500 || attempts >= delays.length) {
      return { response, attempts };
    }

    attempts += 1;
    logOperationalEvent("warn", "RSS fetch retry scheduled.", { url, status: response.status, retryCount: attempts });
    await sleep(delays[attempts - 1]);
  }
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

async function getConfiguredFeeds(): Promise<FeedLike[]> {
  const [dbFeeds, coverageRows] = await Promise.all([
    prisma.rssFeed.findMany({
      where: { enabled: true },
      orderBy: { publicationName: "asc" }
    }),
    prisma.sourceCoverage.findMany().catch(() => [])
  ]);

  if (dbFeeds.length) {
    return dbFeeds.map((feed) => {
      const coverage = coverageRows.find((row) => row.sourceName === feed.publicationName);
      const connector = getSourceConnector(feed.publicationName);
      return {
        publicationName: feed.publicationName,
        feedUrl: feed.feedUrl,
        category: feed.category,
        enabled: feed.enabled,
        baseUrl: coverage?.baseUrl ?? connector?.baseUrl ?? null,
        reliabilityScore: coverage?.reliabilityScore ?? connector?.reliabilityScore ?? null,
        allowedCategories: coverage?.allowedCategories ?? connector?.allowedCategories.join(", ") ?? null,
        blockedKeywords: coverage?.blockedKeywords ?? connector?.blockedKeywords.join(", ") ?? null,
        preferredKeywords: coverage?.preferredKeywords ?? connector?.preferredKeywords.join(", ") ?? null,
        sourceType: coverage?.sourceType ?? connector?.sourceType ?? "rss"
      };
    });
  }

  return FEEDS.map((feed) => {
    const connector = getSourceConnector(feed.name);
    return {
      publicationName: feed.name,
      feedUrl: feed.url,
      category: feed.category,
      enabled: true,
      baseUrl: connector?.baseUrl ?? null,
      reliabilityScore: connector?.reliabilityScore ?? null,
      allowedCategories: connector?.allowedCategories.join(", ") ?? null,
      blockedKeywords: connector?.blockedKeywords.join(", ") ?? null,
      preferredKeywords: connector?.preferredKeywords.join(", ") ?? null,
      sourceType: connector?.sourceType ?? "rss"
    };
  });
}

async function fetchFeedItems(feed: FeedLike) {
  const { response, attempts } = await fetchFeedXml(feed.feedUrl);

  if (!response.ok) {
    throw new Error(`Feed request failed with ${response.status}.${attempts ? ` Retries attempted: ${attempts}.` : ""}`);
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
    let relevant = 0;

    const previewState = await readMockPreviewState();
    const previewUrls = new Set(previewState.reviewArticles.map((article) => article.url));

    for (const feed of mockFeedEntries) {
      let feedFetched = 0;
      let feedSaved = 0;
      const stats: FeedRunStats = { included: 0, possible: 0, excluded: 0, high: 0, medium: 0, low: 0, reasons: [] };
      for (const item of feed.items) {
        fetched += 1;
        feedFetched += 1;
        const relevance = scoreArticleRelevance(
          { headline: item.title, summary: item.summary, publication: feed.publication, url: item.url },
          getSourceConnector(feed.publication)
        );
        relevant += relevance.decision === "excluded" ? 0 : 1;
        stats[relevance.band] += 1;
        if (relevance.decision === "excluded") {
          skipped += 1;
          stats.excluded += 1;
          stats.reasons.push(relevance.primaryReason);
          continue;
        }

        const url = normalizeUrl(item.url);
        if (!url || previewUrls.has(url)) {
          skipped += 1;
          stats.reasons.push("Duplicate URL");
          continue;
        }

        previewUrls.add(url);
        saved += 1;
        feedSaved += 1;
        if (relevance.decision === "review_queue") {
          stats.included += 1;
        } else {
          stats.possible += 1;
        }
        articles.push({
          id: randomUUID(),
          headline: item.title,
          publication: feed.publication,
          publishedDate: item.publishedAt ? new Date(item.publishedAt) : null,
          url,
          sourceType: "rss",
          relevanceScore: relevance.score,
          relevanceBand: relevance.band,
          relevanceDecision: relevance.decision,
          relevanceReasons: relevance.reasons.join(" | "),
          rawHtml: null,
          extractedText: null,
          extractedExcerpt: item.summary ? item.summary.slice(0, 280) : null,
          extractionMethod: null,
          bodyFetchStatus: "not_fetched",
          bodyFetchError: null,
          bodyFetchedAt: null,
          robotsAllowed: null,
          paywallLikely: false,
          sourceReliability: inferSourceReliability(feed.publication, url),
          extractionStatus: relevance.decision === "possible_match" ? "Possible Match" : "Needs Review",
          suspectedCategory: relevance.classification.replaceAll("_", " "),
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
      await upsertSourceCoverage({
        sourceName: feed.publication,
        sourceType: "rss",
        baseUrl: getSourceConnector(feed.publication)?.baseUrl ?? null,
        rssUrlsJson: [feed.feedUrl],
        enabled: true,
        reliabilityScore: getSourceConnector(feed.publication)?.reliabilityScore ?? null,
        allowedCategories: getSourceConnector(feed.publication)?.allowedCategories.join(", ") ?? null,
        blockedKeywords: getSourceConnector(feed.publication)?.blockedKeywords.join(", ") ?? null,
        preferredKeywords: getSourceConnector(feed.publication)?.preferredKeywords.join(", ") ?? null,
        checkedAt: new Date(),
        successAt: new Date(),
        articlesFetchedLastRun: feedFetched,
        articlesSavedLastRun: feedSaved,
        articlesExcludedLastRun: stats.excluded,
        highRelevanceCountLastRun: stats.high,
        mediumRelevanceCountLastRun: stats.medium,
        lowRelevanceCountLastRun: stats.low,
        commonExclusionReasons: topExclusionReasons(stats.reasons),
        sourceReliability: inferSourceReliability(feed.publication, feed.items[0]?.url ?? null),
        notes: `Mock RSS preview source. Included ${stats.included}, possible ${stats.possible}, excluded ${stats.excluded}.`
      });
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
        const created = await prisma.article.create({
          data: {
            url: article.url,
            headline: article.headline,
            publication: article.publication,
            publishedDate: article.publishedDate,
            summary: article.summary,
            relevanceScore: article.relevanceScore,
            relevanceBand: article.relevanceBand,
            relevanceReasons: article.relevanceReasons,
            relevanceDecision: article.relevanceDecision,
            rawHtml: null,
            extractedText: null,
            extractedExcerpt: article.summary ? article.summary.slice(0, 280) : null,
            extractionMethod: null,
            bodyFetchStatus: "not_fetched",
            bodyFetchError: null,
            bodyFetchedAt: null,
            robotsAllowed: null,
            paywallLikely: false,
            sourceReliability: inferSourceReliability(article.publication, article.url),
            sourceType: "rss",
            ingestionSource: "RSS",
            extractionStatus: article.extractionStatus,
            needsReview: true,
            suspectedCategory: article.suspectedCategory,
            confidenceScore: article.confidenceScore
          }
        });
        await syncMissingDataFlags(
          detectArticleMissingData({
            id: created.id,
            url: created.url,
            extractedText: created.extractedText,
            extractedExcerpt: created.extractedExcerpt,
            extractedBuyer: created.extractedBuyer,
            extractedStudio: created.extractedStudio,
            extractionSource: created.extractionSource,
            extractionConfidence: created.extractionConfidence,
            confidenceScore: created.confidenceScore
          }),
          "Article",
          created.id
        );
        await triggerWatchlistAlertsForEntity({
          entityType: "Article",
          entityId: created.id,
          title: created.headline,
          genre: created.suspectedCategory,
          source: created.publication,
          status: created.extractionStatus,
          url: created.url,
          keywordText: [created.summary, created.extractedExcerpt].filter(Boolean).join(" ")
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
        relevant,
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
        relevant,
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
    let feedSaved = 0;
    const stats: FeedRunStats = { included: 0, possible: 0, excluded: 0, high: 0, medium: 0, low: 0, reasons: [] };
    const items = await fetchFeedItems(feed);
    fetched += items.length;

    for (const item of items) {
      if (!item.url || !item.title) continue;
      const relevance = scoreArticleRelevance(
        { headline: item.title, summary: item.summary, publication: feed.publicationName, url: item.url },
        feedConnectorOverride(feed)
      );
      stats[relevance.band] += 1;
      if (relevance.decision === "excluded") {
        skipped += 1;
        stats.excluded += 1;
        stats.reasons.push(relevance.primaryReason);
        continue;
      }
      relevant += 1;

      const existing = await prisma.article.findUnique({ where: { url: item.url }, select: { id: true } });
      if (existing) {
        skipped += 1;
        stats.reasons.push("Duplicate URL");
        continue;
      }

      const created = await prisma.article.create({
        data: {
          url: item.url,
          headline: item.title,
          publication: feed.publicationName,
          publishedDate: item.publishedDate,
          summary: item.summary,
          relevanceScore: relevance.score,
          relevanceBand: relevance.band,
          relevanceReasons: relevance.reasons.join(" | "),
          relevanceDecision: relevance.decision,
          rawHtml: null,
          extractedText: null,
          extractedExcerpt: item.summary ? item.summary.slice(0, 280) : null,
          extractionMethod: null,
          bodyFetchStatus: "not_fetched",
          bodyFetchError: null,
          bodyFetchedAt: null,
          robotsAllowed: null,
          paywallLikely: false,
          sourceReliability: inferSourceReliability(feed.publicationName, item.url),
          sourceType: "rss",
          ingestionSource: "RSS",
          extractionStatus: relevance.decision === "possible_match" ? "Possible Match" : "Needs Review",
          needsReview: true,
          suspectedCategory: relevance.classification.replaceAll("_", " "),
          confidenceScore: 0.6
        }
      });
      await syncMissingDataFlags(
        detectArticleMissingData({
          id: created.id,
          url: created.url,
          extractedText: created.extractedText,
          extractedExcerpt: created.extractedExcerpt,
          extractedBuyer: created.extractedBuyer,
          extractedStudio: created.extractedStudio,
          extractionSource: created.extractionSource,
          extractionConfidence: created.extractionConfidence,
          confidenceScore: created.confidenceScore
        }),
        "Article",
        created.id
      );
      await triggerWatchlistAlertsForEntity({
        entityType: "Article",
        entityId: created.id,
        title: created.headline,
        genre: created.suspectedCategory,
        source: created.publication,
        status: created.extractionStatus,
        url: created.url,
        keywordText: [created.summary, created.extractedExcerpt].filter(Boolean).join(" ")
      });

      saved += 1;
      feedSaved += 1;
      if (relevance.decision === "review_queue") {
        stats.included += 1;
      } else {
        stats.possible += 1;
      }
    }

    await prisma.rssFeed.updateMany({
      where: { feedUrl: feed.feedUrl },
      data: { lastChecked: new Date() }
    });
    await upsertSourceCoverage({
      sourceName: feed.publicationName,
      sourceType: (feed.sourceType as "trade" | "official_press" | "calendar" | "manual_csv" | "search_api" | "rss" | undefined) ?? "rss",
      baseUrl: feed.baseUrl ?? null,
      rssUrlsJson: [feed.feedUrl],
      enabled: feed.enabled,
      reliabilityScore: feed.reliabilityScore ?? null,
      allowedCategories: feed.allowedCategories ?? null,
      blockedKeywords: feed.blockedKeywords ?? null,
      preferredKeywords: feed.preferredKeywords ?? null,
      checkedAt: new Date(),
      successAt: new Date(),
      articlesFetchedLastRun: items.length,
      articlesSavedLastRun: feedSaved,
      articlesExcludedLastRun: stats.excluded,
      highRelevanceCountLastRun: stats.high,
      mediumRelevanceCountLastRun: stats.medium,
      lowRelevanceCountLastRun: stats.low,
      commonExclusionReasons: topExclusionReasons(stats.reasons),
      sourceReliability: inferSourceReliability(feed.publicationName, feed.feedUrl),
      notes: `Included ${stats.included}, possible ${stats.possible}, excluded ${stats.excluded}.`
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
      notes: `Saved ${saved} high-relevance articles, queued possible matches where warranted, skipped ${skipped} low-signal items.`
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
