"use server";

import { revalidatePath } from "next/cache";
import { randomUUID } from "node:crypto";
import { appendMockIngestionResult } from "@/lib/mock-preview-store";
import { prisma } from "@/lib/prisma";
import { ingestRSSFeeds } from "@/lib/rss-ingestion";

function safeHost(urlValue: string) {
  try {
    return new URL(urlValue).hostname.replace(/^www\./, "");
  } catch {
    return "Manual Source";
  }
}

export async function saveRssFeed(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const publicationName = String(formData.get("publicationName") ?? "").trim();
  const feedUrl = String(formData.get("feedUrl") ?? "").trim();
  const category = String(formData.get("category") ?? "").trim();
  const enabled = formData.get("enabled") === "on";

  if (!publicationName || !feedUrl || !category) return;

  await prisma.rssFeed.upsert({
    where: { id: id || "__new__" },
    update: {
      publicationName,
      feedUrl,
      category,
      enabled
    },
    create: {
      publicationName,
      feedUrl,
      category,
      enabled
    }
  }).catch(() => {});

  revalidatePath("/sources");
}

export async function addManualArticle(formData: FormData) {
  const url = String(formData.get("url") ?? "").trim();
  const publication = String(formData.get("publication") ?? "").trim() || safeHost(url);
  const notes = String(formData.get("notes") ?? "").trim();
  if (!url) return;

  try {
    await prisma.article.upsert({
      where: { url },
      update: {
        publication,
        summary: notes || "Manual URL submitted from Sources / Ingestion Settings.",
        sourceType: "manual_url",
        ingestionSource: "Manual",
        needsReview: true,
        extractionStatus: "New"
      },
      create: {
        url,
        publication,
        headline: `Manual review: ${safeHost(url)}`,
        summary: notes || "Manual URL submitted from Sources / Ingestion Settings.",
        sourceType: "manual_url",
        ingestionSource: "Manual",
        needsReview: true,
        extractionStatus: "New"
      }
    });

    await prisma.ingestionRun.create({
      data: {
        sourceType: "manual_url",
        sourceName: publication,
        status: "queued",
        itemsFetched: 1,
        itemsSaved: 1,
        itemsSkipped: 0,
        completedAt: new Date(),
        notes: `Manual article queued for review: ${url}`
      }
    });
  } catch {
    await appendMockIngestionResult({
      articles: [
        {
          id: randomUUID(),
          headline: `Manual review: ${safeHost(url)}`,
          publication,
          publishedDate: new Date(),
          url,
          sourceType: "manual_url",
          extractionStatus: "New",
          suspectedCategory: "Manual Review",
          confidenceScore: null,
          summary: notes || "Manual URL submitted from Sources / Ingestion Settings.",
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
          extractedAnnouncementDate: new Date(),
          extractedPremiereDate: null,
          extractedRelationships: null
        }
      ],
      run: {
        sourceType: "manual_url",
        sourceName: publication,
        status: "queued",
        itemsFetched: 1,
        itemsSaved: 1,
        itemsSkipped: 0,
        startedAt: new Date(),
        completedAt: new Date(),
        notes: `Manual article queued for review: ${url}`
      }
    });
  }

  revalidatePath("/sources");
  revalidatePath("/review");
}

export async function runRssIngestion() {
  try {
    await ingestRSSFeeds("real");
  } catch (error) {
    await prisma.ingestionRun.create({
      data: {
        sourceType: "rss",
        sourceName: "RSS Feed Batch",
        status: "failed",
        itemsFetched: 0,
        itemsSaved: 0,
        itemsSkipped: 0,
        completedAt: new Date(),
        notes: error instanceof Error ? error.message : "RSS ingestion failed."
      }
    }).catch(() => {});
  }
  revalidatePath("/sources");
  revalidatePath("/review");
}

export async function runMockRssIngestion() {
  try {
    await ingestRSSFeeds("mock");
  } catch (error) {
    await appendMockIngestionResult({
      articles: [],
      run: {
        sourceType: "rss_mock",
        sourceName: "Mock RSS",
        status: "failed",
        itemsFetched: 0,
        itemsSaved: 0,
        itemsSkipped: 0,
        startedAt: new Date(),
        completedAt: new Date(),
        notes: error instanceof Error ? error.message : "Mock RSS ingestion failed."
      }
    });
  }
  revalidatePath("/sources");
  revalidatePath("/review");
}

export async function saveBackfillRequest(formData: FormData) {
  const source = String(formData.get("source") ?? "").trim();
  const month = String(formData.get("month") ?? "").trim();
  const year = String(formData.get("year") ?? "").trim();
  const keywords = String(formData.get("keywords") ?? "").trim();
  const statusCategory = String(formData.get("statusCategory") ?? "").trim();

  if (!source && !keywords && !statusCategory) return;

  await prisma.ingestionRun.create({
    data: {
      sourceType: "backfill",
      sourceName: source || "Backfill Request",
      status: "queued",
      itemsFetched: 0,
      itemsSaved: 0,
      itemsSkipped: 0,
      notes: [`Month: ${month || "-"}`, `Year: ${year || "-"}`, `Keywords: ${keywords || "-"}`, `Status: ${statusCategory || "-"}`].join(" | ")
    }
  }).catch(() => {});

  revalidatePath("/sources");
}
