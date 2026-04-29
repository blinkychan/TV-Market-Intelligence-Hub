"use server";

import { revalidatePath } from "next/cache";
import { BuyerType, CompanyType, PersonRole, ProjectStatus, ProjectType } from "@prisma/client";
import { fetchArticleBody } from "@/lib/article-body";
import { recordAuditLog } from "@/lib/audit";
import { findBestDuplicateWarning, type DuplicateGroupRecord } from "@/lib/deduplication";
import { extractStructuredTVData, extractStructuredTVDataWithAI, type StructuredTVExtraction } from "@/lib/extraction";
import { readMockPreviewState, updateMockReviewArticle } from "@/lib/mock-preview-store";
import { logOperationalEvent } from "@/lib/ops-log";
import { prisma } from "@/lib/prisma";
import { inferSourceReliability } from "@/lib/source-reliability";
import { requireAdminCapabilityAccess, requireEditorActionAccess } from "@/lib/team-auth";

function parseDate(value: FormDataEntryValue | null) {
  const stringValue = String(value ?? "").trim();
  if (!stringValue) return null;
  const parsed = new Date(stringValue);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function parseCsv(value: FormDataEntryValue | null) {
  return String(value ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function parseArticleIds(formData: FormData) {
  return formData
    .getAll("articleIds")
    .map((value) => String(value).trim())
    .filter(Boolean);
}

function parseBoolean(value: FormDataEntryValue | null) {
  return value === "on" || value === "true";
}

function deriveProjectType(category?: string | null): ProjectType {
  const normalized = (category ?? "").toLowerCase().replaceAll(" ", "_").replaceAll("-", "_");
  if (normalized.includes("acquisition")) return ProjectType.acquisition;
  if (normalized.includes("co_production")) return ProjectType.co_production;
  if (normalized.includes("international")) return ProjectType.international;
  if (normalized.includes("animation")) return ProjectType.animation;
  if (normalized.includes("limited")) return ProjectType.limited_series;
  if (normalized.includes("format")) return ProjectType.format;
  if (normalized.includes("unscripted")) return ProjectType.unscripted;
  return ProjectType.scripted;
}

function deriveProjectStatus(status?: string | null): ProjectStatus {
  const normalized = String(status ?? "").trim();
  switch (normalized) {
    case ProjectStatus.sold:
      return ProjectStatus.sold;
    case ProjectStatus.in_development:
      return ProjectStatus.in_development;
    case ProjectStatus.pilot_order:
      return ProjectStatus.pilot_order;
    case ProjectStatus.series_order:
      return ProjectStatus.series_order;
    case ProjectStatus.airing:
      return ProjectStatus.airing;
    case ProjectStatus.renewed:
      return ProjectStatus.renewed;
    case ProjectStatus.canceled:
      return ProjectStatus.canceled;
    case ProjectStatus.passed:
      return ProjectStatus.passed;
    case ProjectStatus.stale:
      return ProjectStatus.stale;
    default:
      return ProjectStatus.unknown;
  }
}

function deriveBuyerType(name?: string | null): BuyerType {
  const normalized = (name ?? "").toLowerCase();
  if (normalized.includes("tv+") || normalized.includes("netflix") || normalized.includes("peacock")) return BuyerType.streamer;
  if (normalized === "abc" || normalized === "bbc" || normalized === "cbc") return BuyerType.broadcast;
  if (normalized === "hbo" || normalized === "fx") return BuyerType.cable;
  if (normalized.includes("fremantle")) return BuyerType.distributor;
  return BuyerType.streamer;
}

function inferCompanyType(name?: string | null): CompanyType {
  const normalized = (name ?? "").toLowerCase();
  if (!normalized) return CompanyType.production_company;
  if (normalized.includes("television")) return CompanyType.studio;
  if (normalized.includes("agency")) return CompanyType.agency;
  if (normalized.includes("management")) return CompanyType.management_company;
  if (normalized.includes("distribut")) return CompanyType.distributor;
  return CompanyType.production_company;
}

function inferPersonRoleFromContext(article: {
  extractedStatus?: string | null;
  suspectedCategory?: string | null;
}): PersonRole {
  const text = `${article.extractedStatus ?? ""} ${article.suspectedCategory ?? ""}`.toLowerCase();
  if (text.includes("casting")) return PersonRole.actor;
  if (text.includes("pilot")) return PersonRole.showrunner;
  if (text.includes("series")) return PersonRole.producer;
  return PersonRole.creator;
}

function normalizePersonRole(input?: string | null): PersonRole {
  const normalized = String(input ?? "").trim().toLowerCase();

  if (!normalized) return PersonRole.creator;
  if (normalized === "writer") return PersonRole.writer;
  if (normalized === "creator" || normalized === "co-creator" || normalized === "cocreator") return PersonRole.creator;
  if (normalized === "showrunner") return PersonRole.showrunner;
  if (normalized === "producer" || normalized === "executive producer" || normalized === "ep") return PersonRole.producer;
  if (normalized === "actor" || normalized === "cast" || normalized === "talent") return PersonRole.actor;
  if (normalized === "director") return PersonRole.director;
  if (normalized === "executive") return PersonRole.executive;

  if (normalized.includes("writer")) return PersonRole.writer;
  if (normalized.includes("creator")) return PersonRole.creator;
  if (normalized.includes("showrunner")) return PersonRole.showrunner;
  if (normalized.includes("producer")) return PersonRole.producer;
  if (normalized.includes("actor") || normalized.includes("cast") || normalized.includes("talent")) return PersonRole.actor;
  if (normalized.includes("director")) return PersonRole.director;
  if (normalized.includes("executive")) return PersonRole.executive;

  return PersonRole.creator;
}

function mapArticleData(extraction: StructuredTVExtraction) {
  const fieldsNeedingReview = [...extraction.fieldsNeedingReview];
  if (extraction.warning && !fieldsNeedingReview.includes(extraction.warning)) {
    fieldsNeedingReview.unshift(extraction.warning);
  }

  return {
    extractionMode: extraction.mode,
    suspectedCategory: extraction.category.replaceAll("_", " "),
    confidenceScore: extraction.confidenceScore,
    extractedProjectTitle: extraction.title,
    extractedFormat: extraction.format,
    extractedGenre: extraction.genre,
    extractedSourceMaterial: extraction.sourceMaterial,
    extractedStatus: extraction.status,
    extractedLogline: extraction.logline,
    extractedBuyer: extraction.buyer,
    extractedStudio: extraction.studio,
    extractedCompanies: extraction.productionCompanies.join(", "),
    extractedPeople: extraction.people.join(", "),
    extractedCountry: extraction.country,
    extractedIsAcquisition: extraction.isAcquisition,
    extractedIsCoProduction: extraction.isCoProduction,
    extractedIsInternational: extraction.isInternational,
    extractedAnnouncementDate: extraction.announcementDate,
    extractedPremiereDate: extraction.premiereDate,
    extractedRelationships: extraction.suggestedRelationships,
    extractedFieldsNeedingReview: fieldsNeedingReview.join(", "),
    extractedDeduplicationNotes: extraction.dedupeReason
  };
}

function hasExistingExtractedFields(article: {
  extractedProjectTitle?: string | null;
  extractedBuyer?: string | null;
  extractedStudio?: string | null;
  extractedCompanies?: string | null;
  extractedPeople?: string | null;
  extractedLogline?: string | null;
  extractedFormat?: string | null;
  extractedGenre?: string | null;
  extractedSourceMaterial?: string | null;
}) {
  return Boolean(
    article.extractedProjectTitle ||
      article.extractedBuyer ||
      article.extractedStudio ||
      article.extractedCompanies ||
      article.extractedPeople ||
      article.extractedLogline ||
      article.extractedFormat ||
      article.extractedGenre ||
      article.extractedSourceMaterial
  );
}

function preserveExistingFieldNote(existing?: string | null) {
  const note = "AI extraction ready; existing extracted fields were preserved until overwrite is confirmed.";
  if (!existing) return note;
  if (existing.includes(note)) return existing;
  return `${note}, ${existing}`;
}

function serializeExtractionSnapshot(extraction: StructuredTVExtraction) {
  return {
    ...extraction,
    announcementDate: extraction.announcementDate ? extraction.announcementDate.toISOString() : null,
    premiereDate: extraction.premiereDate ? extraction.premiereDate.toISOString() : null
  };
}

async function loadArticle(articleId: string) {
  const article = await prisma.article.findUnique({ where: { id: articleId } }).catch(() => null);
  return article;
}

async function findLikelyDuplicate(args: { title?: string | null; buyer?: string | null; announcementDate?: Date | null; excludeArticleId?: string }) {
  const title = args.title?.trim();
  if (!title) return null;

  const [projects, shows, articles] = await Promise.all([
    prisma.project.findMany({
      select: {
        id: true,
        title: true,
        aliases: true,
        sourceUrl: true,
        networkOrPlatform: true,
        announcementDate: true,
        confidenceScore: true,
        duplicateGroupId: true,
        duplicateConfidence: true,
        possibleDuplicateOfId: true,
        duplicateStatus: true
      }
    }).catch(() => []),
    prisma.currentShow.findMany({
      select: {
        id: true,
        title: true,
        aliases: true,
        sourceUrl: true,
        networkOrPlatform: true,
        premiereDate: true,
        duplicateGroupId: true,
        duplicateConfidence: true,
        possibleDuplicateOfId: true,
        duplicateStatus: true
      }
    }).catch(() => []),
    prisma.article.findMany({
      where: args.excludeArticleId ? { id: { not: args.excludeArticleId } } : undefined,
      select: {
        id: true,
        headline: true,
        aliases: true,
        url: true,
        extractedProjectTitle: true,
        extractedBuyer: true,
        publishedDate: true,
        confidenceScore: true,
        duplicateGroupId: true,
        duplicateConfidence: true,
        possibleDuplicateOfId: true,
        duplicateStatus: true
      }
    }).catch(() => [])
  ]);

  const inputRecord: DuplicateGroupRecord = {
    id: "candidate",
    entityType: "project",
    label: title,
    buyerOrPlatform: args.buyer ?? null,
    date: args.announcementDate,
    payload: {}
  };

  const candidates: DuplicateGroupRecord[] = [
    ...projects.map((project) => ({
      id: project.id,
      entityType: "project" as const,
      label: project.title,
      aliases: project.aliases,
      url: project.sourceUrl,
      buyerOrPlatform: project.networkOrPlatform,
      date: project.announcementDate,
      confidenceScore: project.confidenceScore,
      duplicateGroupId: project.duplicateGroupId,
      duplicateConfidence: project.duplicateConfidence,
      possibleDuplicateOfId: project.possibleDuplicateOfId,
      duplicateStatus: project.duplicateStatus,
      payload: {}
    })),
    ...shows.map((show) => ({
      id: show.id,
      entityType: "project" as const,
      label: show.title,
      aliases: show.aliases,
      url: show.sourceUrl,
      buyerOrPlatform: show.networkOrPlatform,
      date: show.premiereDate,
      duplicateConfidence: show.duplicateConfidence,
      possibleDuplicateOfId: show.possibleDuplicateOfId,
      duplicateStatus: show.duplicateStatus,
      payload: {}
    })),
    ...articles.map((article) => ({
      id: article.id,
      entityType: "project" as const,
      label: article.extractedProjectTitle ?? article.headline,
      aliases: article.aliases,
      url: article.url,
      buyerOrPlatform: article.extractedBuyer,
      date: article.publishedDate,
      confidenceScore: article.confidenceScore,
      duplicateGroupId: article.duplicateGroupId,
      duplicateConfidence: article.duplicateConfidence,
      possibleDuplicateOfId: article.possibleDuplicateOfId,
      duplicateStatus: article.duplicateStatus,
      payload: { headline: article.headline }
    }))
  ];

  const warning = findBestDuplicateWarning(inputRecord, candidates);
  if (!warning) return null;

  return (
    projects.find((project) => project.id === warning.targetId) ??
    shows.find((show) => show.id === warning.targetId) ??
    articles.find((article) => article.id === warning.targetId) ??
    null
  );
}

async function createOrFindBuyer(name?: string | null) {
  if (!name) return null;
  const existing = await prisma.buyer.findFirst({ where: { name } }).catch(() => null);
  if (existing) return existing;

  const buyers = await prisma.buyer.findMany({
    select: {
      id: true,
      name: true,
      aliases: true,
      parentCompany: true,
      duplicateGroupId: true,
      duplicateConfidence: true,
      possibleDuplicateOfId: true,
      duplicateStatus: true
    }
  }).catch(() => []);
  const warning = findBestDuplicateWarning(
    {
      id: "candidate",
      entityType: "buyer",
      label: name,
      payload: {}
    },
    buyers.map((buyer) => ({
      id: buyer.id,
      entityType: "buyer" as const,
      label: buyer.name,
      aliases: buyer.aliases,
      studioOrCompany: buyer.parentCompany,
      duplicateGroupId: buyer.duplicateGroupId,
      duplicateConfidence: buyer.duplicateConfidence,
      possibleDuplicateOfId: buyer.possibleDuplicateOfId,
      duplicateStatus: buyer.duplicateStatus,
      payload: {}
    }))
  );
  if (warning) {
    return prisma.buyer.findUnique({ where: { id: warning.targetId } }).catch(() => null);
  }

  const type = deriveBuyerType(name);
  return prisma.buyer.create({ data: { name, type } }).catch(() => null);
}

async function createOrFindCompanies(names: string[]) {
  const companies = [];
  for (const name of names) {
    const existing = await prisma.company.findFirst({ where: { name } }).catch(() => null);
    if (existing) {
      companies.push(existing);
      continue;
    }

    const existingCompanies = await prisma.company.findMany({
      select: {
        id: true,
        name: true,
        aliases: true,
        type: true,
        duplicateGroupId: true,
        duplicateConfidence: true,
        possibleDuplicateOfId: true,
        duplicateStatus: true
      }
    }).catch(() => []);
    const warning = findBestDuplicateWarning(
      {
        id: "candidate",
        entityType: "company",
        label: name,
        payload: {}
      },
      existingCompanies.map((company) => ({
        id: company.id,
        entityType: "company" as const,
        label: company.name,
        aliases: company.aliases,
        studioOrCompany: company.type,
        duplicateGroupId: company.duplicateGroupId,
        duplicateConfidence: company.duplicateConfidence,
        possibleDuplicateOfId: company.possibleDuplicateOfId,
        duplicateStatus: company.duplicateStatus,
        payload: {}
      }))
    );
    if (warning) {
      const duplicate = await prisma.company.findUnique({ where: { id: warning.targetId } }).catch(() => null);
      if (duplicate) {
        companies.push(duplicate);
        continue;
      }
    }

    const type = inferCompanyType(name);
    const created = await prisma.company.create({ data: { name, type } }).catch(() => null);
    if (created) companies.push(created);
  }

  return companies;
}

async function createOrFindPeople(names: string[], roleHint?: string | null) {
  const people = [];
  const role = normalizePersonRole(roleHint);

  for (const name of names) {
    const existing = await prisma.person.findFirst({ where: { name } }).catch(() => null);
    if (existing) {
      people.push(existing);
      continue;
    }

    const existingPeople = await prisma.person.findMany({
      select: {
        id: true,
        name: true,
        aliases: true,
        company: true,
        duplicateGroupId: true,
        duplicateConfidence: true,
        possibleDuplicateOfId: true,
        duplicateStatus: true
      }
    }).catch(() => []);
    const warning = findBestDuplicateWarning(
      {
        id: "candidate",
        entityType: "person",
        label: name,
        payload: {}
      },
      existingPeople.map((person) => ({
        id: person.id,
        entityType: "person" as const,
        label: person.name,
        aliases: person.aliases,
        studioOrCompany: person.company,
        duplicateGroupId: person.duplicateGroupId,
        duplicateConfidence: person.duplicateConfidence,
        possibleDuplicateOfId: person.possibleDuplicateOfId,
        duplicateStatus: person.duplicateStatus,
        payload: {}
      }))
    );
    if (warning) {
      const duplicate = await prisma.person.findUnique({ where: { id: warning.targetId } }).catch(() => null);
      if (duplicate) {
        people.push(duplicate);
        continue;
      }
    }

    const created = await prisma.person.create({ data: { name, role } }).catch(() => null);
    if (created) people.push(created);
  }

  return people;
}

async function updateMockArticle(articleId: string, updater: Parameters<typeof updateMockReviewArticle>[1]) {
  await updateMockReviewArticle(articleId, updater);
  revalidatePath("/review");
  revalidatePath("/admin/status");
}

export async function updateArticleStatus(formData: FormData) {
  await requireEditorActionAccess();
  const articleId = String(formData.get("articleId") ?? "");
  const extractionStatus = String(formData.get("extractionStatus") ?? "");
  if (!articleId || !extractionStatus) return;

  const previous = await prisma.article.findUnique({ where: { id: articleId } }).catch(() => null);
  const updated = await prisma.article
    .update({
      where: { id: articleId },
      data: {
        extractionStatus,
        needsReview: extractionStatus === "Needs Review" || extractionStatus === "New"
      }
    })
    .catch(() => null);

  if (!updated) {
    await updateMockArticle(articleId, (article) => ({
      ...article,
      extractionStatus,
      extractedDeduplicationNotes:
        extractionStatus === "Duplicate"
          ? article.extractedDeduplicationNotes ?? "Marked duplicate during preview review."
          : article.extractedDeduplicationNotes
    }));
  } else {
    await recordAuditLog({
      entityType: "Article",
      entityId: updated.id,
      action:
        extractionStatus === "Approved" ? "approved" : extractionStatus === "Rejected" ? "rejected" : "updated",
      previousValueJson: previous,
      newValueJson: updated,
      reason: `Article review status set to ${extractionStatus}.`,
      source: "review_queue"
    });
  }

  revalidatePath("/review");
  revalidatePath("/admin/status");
}

export async function extractArticleData(formData: FormData) {
  await requireEditorActionAccess();
  const articleId = String(formData.get("articleId") ?? "");
  const mode = String(formData.get("mode") ?? "placeholder") as "mock" | "placeholder";
  if (!articleId) return;

  const article = await loadArticle(articleId);
  if (article) {
    const extraction = await extractStructuredTVData(article, mode);
    const duplicate = await findLikelyDuplicate({
      title: extraction.title,
      buyer: extraction.buyer,
      announcementDate: extraction.announcementDate,
      excludeArticleId: article.id
    });

    const updated = await prisma.article.update({
      where: { id: article.id },
      data: {
        ...mapArticleData(extraction),
        extractionStatus: duplicate ? "Duplicate" : "Needs Review",
        needsReview: true,
        sourceReliability: article.sourceReliability ?? inferSourceReliability(article.publication, article.url),
        extractedDeduplicationNotes:
          extraction.dedupeReason ??
          (duplicate ? `Possible duplicate found for ${"headline" in duplicate ? duplicate.headline ?? extraction.title : duplicate.title}.` : null)
      }
    }).catch(() => null);
    if (updated) {
      await recordAuditLog({
        entityType: "Article",
        entityId: updated.id,
        action: "extracted",
        previousValueJson: article,
        newValueJson: updated,
        reason: "Structured extraction run from review queue.",
        source: mode
      });
    }
  } else {
    await updateMockReviewArticle(articleId, async (existing) => {
      const extraction = await extractStructuredTVData(existing, "mock");
      return {
        ...existing,
        ...mapArticleData(extraction),
        extractionStatus: extraction.dedupeCandidate ? "Duplicate" : "Needs Review",
        sourceReliability: existing.sourceReliability ?? inferSourceReliability(existing.publication, existing.url)
      };
    });
  }

  revalidatePath("/review");
  revalidatePath("/admin/status");
}

async function persistAiExtraction(articleId: string, confirmOverwrite: boolean) {
  const article = await loadArticle(articleId);

  if (article) {
    try {
      const extraction = await extractStructuredTVDataWithAI(article);
      const duplicate = await findLikelyDuplicate({
        title: extraction.title,
        buyer: extraction.buyer,
        announcementDate: extraction.announcementDate,
        excludeArticleId: article.id
      });

      const mapped = mapArticleData(extraction);
      const extractionSnapshot = serializeExtractionSnapshot(extraction);
      const shouldPreserveExisting = hasExistingExtractedFields(article) && !confirmOverwrite;
      const duplicateNote =
        extraction.dedupeReason ??
        (duplicate ? `Possible duplicate found for ${"headline" in duplicate ? duplicate.headline ?? extraction.title : duplicate.title}.` : null);

      const updated = await prisma.article.update({
        where: { id: article.id },
        data: {
          ...(shouldPreserveExisting
            ? {
                extractionMode: extraction.mode,
                confidenceScore: extraction.confidenceScore,
                suspectedCategory: extraction.category.replaceAll("_", " "),
                extractedStructuredDataJson: extractionSnapshot,
                aiExtractionError: null,
                sourceReliability: article.sourceReliability ?? inferSourceReliability(article.publication, article.url),
                extractionStatus: duplicate ? "Duplicate" : "Needs Review",
                needsReview: true,
                extractedFieldsNeedingReview: preserveExistingFieldNote(article.extractedFieldsNeedingReview),
                extractedDeduplicationNotes: duplicateNote
              }
            : {
                ...mapped,
                extractedStructuredDataJson: extractionSnapshot,
                aiExtractionError: null,
                extractionStatus: duplicate ? "Duplicate" : "Needs Review",
                needsReview: true,
                sourceReliability: article.sourceReliability ?? inferSourceReliability(article.publication, article.url),
                extractedDeduplicationNotes: duplicateNote
              })
        }
      });
      await recordAuditLog({
        entityType: "Article",
        entityId: updated.id,
        action: "extracted",
        previousValueJson: article,
        newValueJson: updated,
        reason: confirmOverwrite ? "AI extraction overwrote existing extracted fields." : "AI extraction refreshed draft fields.",
        source: "ai_extraction"
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "AI extraction failed.";
      logOperationalEvent("warn", "AI extraction failed.", { articleId, message });
      const failed = await prisma.article.update({
        where: { id: article.id },
        data: {
          aiExtractionError: message,
          needsReview: true,
          extractedFieldsNeedingReview: preserveExistingFieldNote(article.extractedFieldsNeedingReview)
        }
      }).catch(() => null);
      if (failed) {
        await recordAuditLog({
          entityType: "Article",
          entityId: failed.id,
          action: "extracted",
          previousValueJson: article,
          newValueJson: failed,
          reason: `AI extraction failed: ${message}`,
          source: "ai_extraction"
        });
      }
    }

    return;
  }

  await updateMockArticle(articleId, async (existing) => {
    try {
      const extraction = await extractStructuredTVDataWithAI(existing);
      const mapped = mapArticleData(extraction);
      const extractionSnapshot = serializeExtractionSnapshot(extraction);
      const shouldPreserveExisting = hasExistingExtractedFields(existing) && !confirmOverwrite;

      return {
        ...existing,
        ...(shouldPreserveExisting
          ? {
              extractionMode: extraction.mode,
              confidenceScore: extraction.confidenceScore,
              suspectedCategory: extraction.category.replaceAll("_", " "),
              extractedStructuredDataJson: extractionSnapshot,
              aiExtractionError: null,
              extractionStatus: extraction.dedupeCandidate ? "Duplicate" : "Needs Review",
              needsReview: true,
              extractedFieldsNeedingReview: preserveExistingFieldNote(existing.extractedFieldsNeedingReview)
            }
          : {
              ...mapped,
              extractedStructuredDataJson: extractionSnapshot,
              aiExtractionError: null,
              extractionStatus: extraction.dedupeCandidate ? "Duplicate" : "Needs Review",
              needsReview: true
            })
      };
    } catch (error) {
      return {
        ...existing,
        aiExtractionError: error instanceof Error ? error.message : "AI extraction failed.",
        needsReview: true
      };
    }
  });
}

export async function runAiExtractionAction(formData: FormData) {
  await requireEditorActionAccess();
  const articleId = String(formData.get("articleId") ?? "");
  const confirmOverwrite = parseBoolean(formData.get("confirmOverwrite"));
  if (!articleId) return;

  await persistAiExtraction(articleId, confirmOverwrite);
  revalidatePath("/review");
  revalidatePath("/admin/status");
}

export async function runAiExtractionForSelectedAction(formData: FormData) {
  await requireEditorActionAccess();
  const articleIds = parseArticleIds(formData);
  const confirmOverwrite = parseBoolean(formData.get("confirmOverwrite"));
  if (!articleIds.length) return;

  for (const articleId of articleIds) {
    await persistAiExtraction(articleId, confirmOverwrite);
  }

  revalidatePath("/review");
  revalidatePath("/admin/status");
}

async function persistBodyFetch(articleId: string) {
  const article = await loadArticle(articleId);
  if (article) {
    const result = await fetchArticleBody(article.url);
    const updated = await prisma.article
      .update({
        where: { id: article.id },
        data: {
          rawHtml: result.rawHtml,
          extractedText: result.extractedText,
          extractedExcerpt: result.extractedExcerpt,
          extractionMethod: result.extractionMethod,
          bodyFetchStatus: result.status,
          bodyFetchError: result.error,
          bodyFetchedAt: result.fetchedAt,
          robotsAllowed: result.robotsAllowed,
          paywallLikely: result.paywallLikely,
          sourceReliability: article.sourceReliability ?? inferSourceReliability(article.publication, article.url),
          needsReview: true
        }
      })
      .catch(() => null);

    if (updated) {
      await recordAuditLog({
        entityType: "Article",
        entityId: updated.id,
        action: "updated",
        previousValueJson: article,
        newValueJson: updated,
        reason: `Article body fetch finished with status ${result.status}.`,
        source: "body_fetch"
      });
    }

    if (result.status !== "success") {
      logOperationalEvent("warn", "Article body fetch did not fully succeed.", {
        articleId: article.id,
        source: article.publication ?? "unknown",
        status: result.status
      });
    }

    const run = await prisma.ingestionRun
      .create({
        data: {
          sourceType: "body_fetch",
          sourceName: article.publication ?? new URL(article.url).hostname,
          status: result.status === "success" ? "completed" : result.status === "robots_blocked" ? "blocked" : "failed",
          itemsFetched: 1,
          itemsSaved: result.extractedText || result.extractedExcerpt ? 1 : 0,
          itemsSkipped: result.status === "robots_blocked" ? 1 : 0,
          completedAt: new Date(),
          notes: result.error ?? `Body fetch ${result.status} for ${article.url}`
        }
      })
      .catch(() => null);

    if (run) {
      await recordAuditLog({
        entityType: "Article",
        entityId: article.id,
        action: "imported",
        previousValueJson: null,
        newValueJson: { ingestionRunId: run.id, status: result.status },
        reason: "Body extraction run logged.",
        source: "body_fetch"
      });
    }

    return;
  }

  await updateMockArticle(articleId, async (existing) => {
    const result = await fetchArticleBody(existing.url);
    return {
      ...existing,
      rawHtml: result.rawHtml,
      extractedText: result.extractedText,
      extractedExcerpt: result.extractedExcerpt,
      extractionMethod: result.extractionMethod,
      bodyFetchStatus: result.status,
      bodyFetchError: result.error,
      bodyFetchedAt: result.fetchedAt,
      robotsAllowed: result.robotsAllowed,
      paywallLikely: result.paywallLikely,
      sourceReliability: existing.sourceReliability ?? inferSourceReliability(existing.publication, existing.url),
      needsReview: true
    };
  });
}

export async function fetchArticleBodyAction(formData: FormData) {
  await requireAdminCapabilityAccess();
  const articleId = String(formData.get("articleId") ?? "");
  if (!articleId) return;
  await persistBodyFetch(articleId);
  revalidatePath("/review");
  revalidatePath("/admin/status");
}

export async function fetchBodiesForNeedsReview() {
  await requireAdminCapabilityAccess();
  const dbArticles = await prisma.article
    .findMany({
      where: { needsReview: true, extractionStatus: { in: ["Needs Review", "New"] } },
      select: { id: true }
    })
    .catch(() => []);

  if (dbArticles.length) {
    for (const article of dbArticles) {
      await persistBodyFetch(article.id);
    }
  } else {
    const mockState = await readMockPreviewState().catch(() => null);
    const previewArticles = mockState?.reviewArticles ?? [];
    for (const article of previewArticles.filter((item) => item.extractionStatus === "Needs Review" || item.extractionStatus === "New")) {
      await persistBodyFetch(article.id);
    }
  }

  revalidatePath("/review");
  revalidatePath("/admin/status");
}

export async function fetchSelectedBodiesAction(formData: FormData) {
  await requireAdminCapabilityAccess();
  const articleIds = parseArticleIds(formData);
  if (!articleIds.length) return;

  for (const articleId of articleIds) {
    await persistBodyFetch(articleId);
  }

  revalidatePath("/review");
  revalidatePath("/admin/status");
}

export async function saveExtractedFields(formData: FormData) {
  await requireEditorActionAccess();
  const articleId = String(formData.get("articleId") ?? "");
  if (!articleId) return;

  const payload = {
    suspectedCategory: String(formData.get("suspectedCategory") ?? "").trim() || null,
    confidenceScore: Number(formData.get("confidenceScore") ?? "") || null,
    extractedProjectTitle: String(formData.get("extractedProjectTitle") ?? "").trim() || null,
    extractedFormat: String(formData.get("extractedFormat") ?? "").trim() || null,
    extractedGenre: String(formData.get("extractedGenre") ?? "").trim() || null,
    extractedSourceMaterial: String(formData.get("extractedSourceMaterial") ?? "").trim() || null,
    extractedStatus: String(formData.get("extractedStatus") ?? "").trim() || null,
    extractedLogline: String(formData.get("extractedLogline") ?? "").trim() || null,
    extractedBuyer: String(formData.get("extractedBuyer") ?? "").trim() || null,
    extractedStudio: String(formData.get("extractedStudio") ?? "").trim() || null,
    extractedCompanies: String(formData.get("extractedCompanies") ?? "").trim() || null,
    extractedPeople: String(formData.get("extractedPeople") ?? "").trim() || null,
    extractedCountry: String(formData.get("extractedCountry") ?? "").trim() || null,
    extractedIsAcquisition: parseBoolean(formData.get("extractedIsAcquisition")),
    extractedIsCoProduction: parseBoolean(formData.get("extractedIsCoProduction")),
    extractedIsInternational: parseBoolean(formData.get("extractedIsInternational")),
    extractedAnnouncementDate: parseDate(formData.get("extractedAnnouncementDate")),
    extractedPremiereDate: parseDate(formData.get("extractedPremiereDate")),
    extractedRelationships: String(formData.get("extractedRelationships") ?? "").trim() || null,
    extractedFieldsNeedingReview: String(formData.get("extractedFieldsNeedingReview") ?? "").trim() || null,
    extractedDeduplicationNotes: String(formData.get("extractedDeduplicationNotes") ?? "").trim() || null,
    summary: String(formData.get("summary") ?? "").trim() || null
  };

  const previous = await prisma.article.findUnique({ where: { id: articleId } }).catch(() => null);
  const updated = await prisma.article.update({ where: { id: articleId }, data: payload }).catch(() => null);
  if (!updated) {
    await updateMockArticle(articleId, (article) => ({ ...article, ...payload }));
  } else {
    await recordAuditLog({
      entityType: "Article",
      entityId: updated.id,
      action: "updated",
      previousValueJson: previous,
      newValueJson: updated,
      reason: "Extracted article fields edited by teammate.",
      source: "review_queue"
    });
  }

  revalidatePath("/review");
  revalidatePath("/admin/status");
}

export async function createProjectFromArticle(formData: FormData) {
  await requireEditorActionAccess();
  const articleId = String(formData.get("articleId") ?? "");
  if (!articleId) return;

  const article = await loadArticle(articleId);
  if (!article) {
    await updateMockArticle(articleId, (existing) => ({
      ...existing,
      linkedProjectId: existing.linkedProjectId ?? `mock-project-${(existing.extractedProjectTitle ?? existing.headline).toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
      linkedProjectTitle: existing.extractedProjectTitle ?? existing.headline,
      extractionStatus: "Approved"
    }));
    return;
  }

  const duplicate = await findLikelyDuplicate({
    title: article.extractedProjectTitle,
    buyer: article.extractedBuyer,
    announcementDate: article.extractedAnnouncementDate,
    excludeArticleId: article.id
  });

  if (duplicate && "headline" in duplicate) {
    await prisma.article.update({
      where: { id: article.id },
      data: {
        extractionStatus: "Duplicate",
        extractedDeduplicationNotes: `Similar article already exists: ${duplicate.headline}.`,
        needsReview: true
      }
    }).catch(() => {});
    revalidatePath("/review");
    return;
  }

  const title = article.extractedProjectTitle?.trim() || article.headline;
  const existingProject = await prisma.project.findFirst({ where: { title } }).catch(() => null);

  let projectId = existingProject?.id;
  if (!projectId) {
    const buyer = await createOrFindBuyer(article.extractedBuyer);
    const studio = article.extractedStudio
      ? await prisma.company.findFirst({ where: { name: article.extractedStudio } }).catch(() => null)
      : null;

    const project = await prisma.project.create({
      data: {
        title,
        type: deriveProjectType(article.suspectedCategory),
        status: deriveProjectStatus(article.extractedStatus),
        logline: article.extractedLogline,
        genre: article.extractedGenre,
        format: article.extractedFormat,
        source_material: article.extractedSourceMaterial,
        buyerId: buyer?.id,
        networkOrPlatform: article.extractedBuyer,
        studioId: studio?.id,
        countryOfOrigin: article.extractedCountry,
        isInternational: article.extractedIsInternational ?? (article.suspectedCategory ?? "").toLowerCase().includes("international"),
        isCoProduction: article.extractedIsCoProduction ?? (article.suspectedCategory ?? "").toLowerCase().includes("co-production"),
        isAcquisition: article.extractedIsAcquisition ?? (article.suspectedCategory ?? "").toLowerCase().includes("acquisition"),
        announcementDate: article.extractedAnnouncementDate,
        premiereDate: article.extractedPremiereDate,
        lastUpdateDate: article.publishedDate ?? new Date(),
        sourceUrl: article.url,
        sourcePublication: article.publication,
        confidenceScore: article.confidenceScore ?? 0.6,
        needsReview: false,
        notes: "Created from Article Review Queue."
      }
    }).catch(() => null);

    projectId = project?.id;
    if (project) {
      await recordAuditLog({
        entityType: "Project",
        entityId: project.id,
        action: "created",
        previousValueJson: null,
        newValueJson: project,
        reason: "Project created from approved article.",
        source: "review_queue"
      });
    }
  }

  if (!projectId) return;

  const updatedArticle = await prisma.article.update({
    where: { id: articleId },
    data: {
      linkedProjectId: projectId,
      extractionStatus: "Approved",
      needsReview: false
    }
  }).catch(() => null);

  if (updatedArticle) {
    await recordAuditLog({
      entityType: "Article",
      entityId: updatedArticle.id,
      action: "approved",
      previousValueJson: article,
      newValueJson: updatedArticle,
      reason: "Article approved and linked to project.",
      source: "review_queue"
    });
  }

  revalidatePath("/review");
  revalidatePath("/admin/status");
}

export async function approveAndCreateRecordsAction(formData: FormData) {
  await requireEditorActionAccess();
  const articleId = String(formData.get("articleId") ?? "");
  if (!articleId) return;

  const article = await loadArticle(articleId);
  if (!article) {
    await updateMockArticle(articleId, (existing) => ({
      ...existing,
      extractionStatus: "Approved",
      needsReview: false,
      linkedShowId:
        existing.linkedShowId ??
        ((existing.suspectedCategory ?? "").toLowerCase().includes("current") ? `mock-show-${(existing.extractedProjectTitle ?? existing.headline).toLowerCase().replace(/[^a-z0-9]+/g, "-")}` : existing.linkedShowId),
      linkedProjectId:
        existing.linkedProjectId ??
        ((existing.suspectedCategory ?? "").toLowerCase().includes("current") ? existing.linkedProjectId : `mock-project-${(existing.extractedProjectTitle ?? existing.headline).toLowerCase().replace(/[^a-z0-9]+/g, "-")}`)
    }));
    return;
  }

  const nextCategory = (article.suspectedCategory ?? "").toLowerCase();
  const nextFormData = new FormData();
  nextFormData.set("articleId", articleId);

  if (nextCategory.includes("current")) {
    await createCurrentShowFromArticle(nextFormData);
  } else {
    await createProjectFromArticle(nextFormData);
  }

  await prisma.article.update({
    where: { id: article.id },
    data: {
      extractionStatus: "Approved",
      needsReview: false
    }
  }).catch(() => {});

  revalidatePath("/review");
  revalidatePath("/admin/status");
}

export async function createCurrentShowFromArticle(formData: FormData) {
  await requireEditorActionAccess();
  const articleId = String(formData.get("articleId") ?? "");
  if (!articleId) return;

  const article = await loadArticle(articleId);
  if (!article) {
    await updateMockArticle(articleId, (existing) => ({
      ...existing,
      linkedShowId: existing.linkedShowId ?? `mock-show-${(existing.extractedProjectTitle ?? existing.headline).toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
      linkedShowTitle: existing.extractedProjectTitle ?? existing.headline,
      extractionStatus: "Approved"
    }));
    return;
  }

  const title = article.extractedProjectTitle?.trim() || article.headline;
  const existingShow = await prisma.currentShow.findFirst({ where: { title } }).catch(() => null);

  const showId =
    existingShow?.id ??
    (
      await prisma.currentShow.create({
        data: {
          title,
          networkOrPlatform: article.extractedBuyer || "Unknown",
          premiereDate: article.extractedPremiereDate,
          status: article.extractedStatus || "premiering soon",
          genre: article.extractedGenre,
          studio: article.extractedStudio,
          productionCompanies: article.extractedCompanies,
          country: article.extractedCountry,
          sourceUrl: article.url,
          notes: article.summary || "Created from Article Review Queue."
        }
      }).then(async (created) => {
        await recordAuditLog({
          entityType: "CurrentShow",
          entityId: created.id,
          action: "created",
          previousValueJson: null,
          newValueJson: created,
          reason: "Current show created from approved article.",
          source: "review_queue"
        });
        return created;
      }).catch(() => null)
    )?.id;

  if (!showId) return;

  const updatedArticle = await prisma.article.update({
    where: { id: articleId },
    data: {
      linkedShowId: showId,
      extractionStatus: "Approved",
      needsReview: false
    }
  }).catch(() => null);

  if (updatedArticle) {
    await recordAuditLog({
      entityType: "Article",
      entityId: updatedArticle.id,
      action: "approved",
      previousValueJson: article,
      newValueJson: updatedArticle,
      reason: "Article approved and linked to current show.",
      source: "review_queue"
    });
  }

  revalidatePath("/review");
  revalidatePath("/admin/status");
}

export async function linkArticleToProject(formData: FormData) {
  await requireEditorActionAccess();
  const articleId = String(formData.get("articleId") ?? "");
  const projectId = String(formData.get("projectId") ?? "");
  if (!articleId || !projectId) return;

  const project = await prisma.project.findUnique({ where: { id: projectId }, select: { title: true } }).catch(() => null);
  const success = await prisma.article
    .update({
      where: { id: articleId },
      data: {
        linkedProjectId: projectId,
        extractionStatus: "Approved",
        needsReview: false
      }
    })
    .then(() => true)
    .catch(() => false);

  if (!success) {
    await updateMockArticle(articleId, (article) => ({
      ...article,
      linkedProjectId: projectId,
      linkedProjectTitle: project?.title ?? article.linkedProjectTitle ?? article.extractedProjectTitle,
      extractionStatus: "Approved"
    }));
  }

  revalidatePath("/review");
}

export async function linkArticleToShow(formData: FormData) {
  await requireEditorActionAccess();
  const articleId = String(formData.get("articleId") ?? "");
  const showId = String(formData.get("showId") ?? "");
  if (!articleId || !showId) return;

  const show = await prisma.currentShow.findUnique({ where: { id: showId }, select: { title: true } }).catch(() => null);
  const success = await prisma.article
    .update({
      where: { id: articleId },
      data: {
        linkedShowId: showId,
        extractionStatus: "Approved",
        needsReview: false
      }
    })
    .then(() => true)
    .catch(() => false);

  if (!success) {
    await updateMockArticle(articleId, (article) => ({
      ...article,
      linkedShowId: showId,
      linkedShowTitle: show?.title ?? article.linkedShowTitle ?? article.extractedProjectTitle,
      extractionStatus: "Approved"
    }));
  }

  revalidatePath("/review");
}

export async function createOrLinkBuyer(formData: FormData) {
  await requireEditorActionAccess();
  const articleId = String(formData.get("articleId") ?? "");
  if (!articleId) return;

  const article = await loadArticle(articleId);
  if (!article) {
    await updateMockArticle(articleId, (existing) => ({
      ...existing,
      extractedRelationships:
        existing.extractedRelationships ??
        (existing.extractedBuyer ? `${existing.extractedBuyer} linked from extracted article metadata.` : "Buyer linkage staged in preview mode.")
    }));
    return;
  }

  await createOrFindBuyer(article.extractedBuyer);
  revalidatePath("/review");
}

export async function createOrLinkCompanies(formData: FormData) {
  await requireEditorActionAccess();
  const articleId = String(formData.get("articleId") ?? "");
  if (!articleId) return;

  const article = await loadArticle(articleId);
  if (!article) {
    await updateMockArticle(articleId, (existing) => ({
      ...existing,
      extractedFieldsNeedingReview: existing.extractedFieldsNeedingReview ?? "company verification"
    }));
    return;
  }

  const companies = await createOrFindCompanies(parseCsv(article.extractedCompanies));
  if (article.linkedProjectId && companies.length) {
    await prisma.project.update({
      where: { id: article.linkedProjectId },
      data: {
        productionCompanies: {
          connect: companies.map((company) => ({ id: company.id }))
        }
      }
    }).catch(() => {});
  }

  revalidatePath("/review");
}

export async function createOrLinkPeople(formData: FormData) {
  await requireEditorActionAccess();
  const articleId = String(formData.get("articleId") ?? "");
  if (!articleId) return;

  const article = await loadArticle(articleId);
  if (!article) {
    await updateMockArticle(articleId, (existing) => ({
      ...existing,
      extractedFieldsNeedingReview: existing.extractedFieldsNeedingReview ?? "talent verification"
    }));
    return;
  }

  const role = inferPersonRoleFromContext(article);
  const people = await createOrFindPeople(parseCsv(article.extractedPeople), role);
  if (article.linkedProjectId && people.length) {
    await prisma.project.update({
      where: { id: article.linkedProjectId },
      data: {
        people: {
          connect: people.map((person) => ({ id: person.id }))
        }
      }
    }).catch(() => {});
  }

  revalidatePath("/review");
}

export async function createRelationships(formData: FormData) {
  await requireEditorActionAccess();
  const articleId = String(formData.get("articleId") ?? "");
  if (!articleId) return;

  const article = await loadArticle(articleId);
  if (!article) {
    await updateMockArticle(articleId, (existing) => ({
      ...existing,
      extractedRelationships: existing.extractedRelationships ?? "Preview relationships created.",
      extractionStatus: existing.extractionStatus === "New" ? "Needs Review" : existing.extractionStatus
    }));
    return;
  }

  const buyer = await createOrFindBuyer(article.extractedBuyer);
  const companies = await createOrFindCompanies(parseCsv(article.extractedCompanies));
  const people = await createOrFindPeople(parseCsv(article.extractedPeople), inferPersonRoleFromContext(article));

  if (article.linkedProjectId) {
    for (const company of companies) {
      await prisma.relationship.create({
        data: {
          buyerId: buyer?.id,
          companyId: company.id,
          projectId: article.linkedProjectId,
          relationshipType: "article_extracted_company",
          sourceUrl: article.url,
          date: article.extractedAnnouncementDate ?? article.publishedDate
        }
      }).catch(() => {});
    }

    for (const person of people) {
      await prisma.relationship.create({
        data: {
          buyerId: buyer?.id,
          personId: person.id,
          projectId: article.linkedProjectId,
          relationshipType: "article_extracted_person",
          sourceUrl: article.url,
          date: article.extractedAnnouncementDate ?? article.publishedDate
        }
      }).catch(() => {});
    }
  }

  revalidatePath("/review");
}
