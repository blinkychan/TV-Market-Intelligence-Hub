"use server";

import { revalidatePath } from "next/cache";
import { randomUUID } from "node:crypto";
import { recordAuditLog } from "@/lib/audit";
import { appendMockIngestionResult } from "@/lib/mock-preview-store";
import { logOperationalEvent } from "@/lib/ops-log";
import { prisma } from "@/lib/prisma";
import { ingestRSSFeeds } from "@/lib/rss-ingestion";
import { inferSourceReliability } from "@/lib/source-reliability";
import { requireAdminCapabilityAccess } from "@/lib/team-auth";

function safeHost(urlValue: string) {
  try {
    return new URL(urlValue).hostname.replace(/^www\./, "");
  } catch {
    return "Manual Source";
  }
}

export async function saveRssFeed(formData: FormData) {
  await requireAdminCapabilityAccess();
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
  revalidatePath("/admin/status");
}

export async function addManualArticle(formData: FormData) {
  await requireAdminCapabilityAccess();
  const url = String(formData.get("url") ?? "").trim();
  const publication = String(formData.get("publication") ?? "").trim() || safeHost(url);
  const notes = String(formData.get("notes") ?? "").trim();
  if (!url) return;

  try {
    const existing = await prisma.article.findUnique({ where: { url } }).catch(() => null);
    const article = await prisma.article.upsert({
      where: { url },
      update: {
        publication,
        summary: notes || "Manual URL submitted from Sources / Ingestion Settings.",
        extractedExcerpt: notes ? notes.slice(0, 280) : null,
        bodyFetchStatus: "not_fetched",
        paywallLikely: false,
        sourceReliability: inferSourceReliability(publication, url),
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
        extractedExcerpt: notes ? notes.slice(0, 280) : null,
        bodyFetchStatus: "not_fetched",
        paywallLikely: false,
        sourceReliability: inferSourceReliability(publication, url),
        sourceType: "manual_url",
        ingestionSource: "Manual",
        needsReview: true,
        extractionStatus: "New"
      }
    });

    const run = await prisma.ingestionRun.create({
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

    await recordAuditLog({
      entityType: "Article",
      entityId: article.id,
      action: existing ? "updated" : "created",
      previousValueJson: existing,
      newValueJson: article,
      reason: "Manual article URL added to review queue.",
      source: "sources_manual_url"
    });
    await recordAuditLog({
      entityType: "Article",
      entityId: article.id,
      action: "imported",
      previousValueJson: null,
      newValueJson: { ingestionRunId: run.id, url },
      reason: "Manual article queued for review.",
      source: "manual_url"
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
          extractedExcerpt: notes ? notes.slice(0, 280) : null,
          bodyFetchStatus: "not_fetched",
          bodyFetchError: null,
          bodyFetchedAt: null,
          robotsAllowed: null,
          paywallLikely: false,
          sourceReliability: inferSourceReliability(publication, url),
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
  revalidatePath("/admin/status");
}

export async function runRssIngestion() {
  await requireAdminCapabilityAccess();
  try {
    await ingestRSSFeeds("real");
    await recordAuditLog({
      entityType: "Article",
      entityId: "rss-batch",
      action: "imported",
      newValueJson: { mode: "real" },
      reason: "Manual RSS ingestion run started from sources page.",
      source: "rss"
    });
  } catch (error) {
    logOperationalEvent("error", "RSS ingestion failed.", {
      sourceType: "rss",
      message: error instanceof Error ? error.message : "Unknown RSS ingestion error"
    });
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
  revalidatePath("/admin/status");
}

export async function runMockRssIngestion() {
  await requireAdminCapabilityAccess();
  try {
    await ingestRSSFeeds("mock");
    await recordAuditLog({
      entityType: "Article",
      entityId: "rss-mock-batch",
      action: "imported",
      newValueJson: { mode: "mock" },
      reason: "Mock RSS ingestion run started from sources page.",
      source: "rss_mock"
    });
  } catch (error) {
    logOperationalEvent("warn", "Mock RSS ingestion failed.", {
      sourceType: "rss_mock",
      message: error instanceof Error ? error.message : "Unknown mock RSS ingestion error"
    });
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
  revalidatePath("/admin/status");
}

export async function saveBackfillRequest(formData: FormData) {
  await requireAdminCapabilityAccess();
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
  revalidatePath("/admin/status");
}
