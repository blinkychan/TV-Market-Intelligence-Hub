"use server";

import { revalidatePath } from "next/cache";
import { extractStructuredTVData, type StructuredTVExtraction } from "@/lib/extraction";
import { updateMockReviewArticle } from "@/lib/mock-preview-store";
import { prisma } from "@/lib/prisma";

const validProjectStatuses = new Set([
  "sold",
  "in_development",
  "pilot_order",
  "series_order",
  "airing",
  "renewed",
  "canceled",
  "passed",
  "stale",
  "unknown"
]);

const validProjectTypes = new Set([
  "scripted",
  "unscripted",
  "animation",
  "limited_series",
  "format",
  "international",
  "acquisition",
  "co_production"
]);

const validBuyerTypes = new Set(["broadcast", "cable", "streamer", "studio", "distributor"]);
const validCompanyTypes = new Set(["studio", "production_company", "distributor", "agency", "management_company"]);
const validPersonRoles = new Set(["writer", "creator", "showrunner", "producer", "actor", "executive", "director"]);

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

function deriveProjectType(category?: string | null) {
  const normalized = (category ?? "").toLowerCase().replaceAll(" ", "_").replaceAll("-", "_");
  if (normalized.includes("acquisition")) return "acquisition";
  if (normalized.includes("co_production")) return "co_production";
  if (normalized.includes("international")) return "international";
  return "scripted";
}

function deriveProjectStatus(status?: string | null) {
  const normalized = String(status ?? "").trim();
  return validProjectStatuses.has(normalized) ? normalized : "unknown";
}

function deriveBuyerType(name?: string | null) {
  const normalized = (name ?? "").toLowerCase();
  if (normalized.includes("tv+") || normalized.includes("netflix") || normalized.includes("peacock")) return "streamer";
  if (normalized === "abc" || normalized === "bbc" || normalized === "cbc") return "broadcast";
  if (normalized === "hbo" || normalized === "fx") return "cable";
  if (normalized.includes("fremantle")) return "distributor";
  return "streamer";
}

function inferCompanyType(name?: string | null) {
  const normalized = (name ?? "").toLowerCase();
  if (!normalized) return "production_company";
  if (normalized.includes("television")) return "studio";
  if (normalized.includes("agency")) return "agency";
  if (normalized.includes("management")) return "management_company";
  return "production_company";
}

function inferPersonRoleFromContext(article: {
  extractedStatus?: string | null;
  suspectedCategory?: string | null;
}) {
  const text = `${article.extractedStatus ?? ""} ${article.suspectedCategory ?? ""}`.toLowerCase();
  if (text.includes("casting")) return "actor";
  if (text.includes("pilot")) return "showrunner";
  if (text.includes("series")) return "producer";
  return "creator";
}

function mapArticleData(extraction: StructuredTVExtraction) {
  return {
    extractionMode: extraction.mode,
    suspectedCategory: extraction.category.replaceAll("_", " "),
    confidenceScore: extraction.confidenceScore,
    extractedProjectTitle: extraction.title,
    extractedFormat: extraction.format,
    extractedStatus: extraction.status,
    extractedLogline: extraction.logline,
    extractedBuyer: extraction.buyer,
    extractedStudio: extraction.studio,
    extractedCompanies: extraction.productionCompanies.join(", "),
    extractedPeople: extraction.people.join(", "),
    extractedCountry: extraction.country,
    extractedAnnouncementDate: extraction.announcementDate,
    extractedPremiereDate: extraction.premiereDate,
    extractedRelationships: extraction.suggestedRelationships,
    extractedFieldsNeedingReview: extraction.fieldsNeedingReview.join(", "),
    extractedDeduplicationNotes: extraction.dedupeReason
  };
}

async function loadArticle(articleId: string) {
  const article = await prisma.article.findUnique({ where: { id: articleId } }).catch(() => null);
  return article;
}

async function findLikelyDuplicate(args: { title?: string | null; buyer?: string | null; announcementDate?: Date | null; excludeArticleId?: string }) {
  const title = args.title?.trim();
  if (!title) return null;

  const [project, show, article] = await Promise.all([
    prisma.project.findFirst({
      where: {
        title,
        ...(args.buyer ? { networkOrPlatform: args.buyer } : {})
      },
      select: { id: true, title: true, announcementDate: true }
    }).catch(() => null),
    prisma.currentShow.findFirst({
      where: {
        title,
        ...(args.buyer ? { networkOrPlatform: args.buyer } : {})
      },
      select: { id: true, title: true, premiereDate: true }
    }).catch(() => null),
    prisma.article.findFirst({
      where: {
        extractedProjectTitle: title,
        ...(args.excludeArticleId ? { id: { not: args.excludeArticleId } } : {}),
        ...(args.buyer ? { extractedBuyer: args.buyer } : {})
      },
      select: { id: true, headline: true, publishedDate: true }
    }).catch(() => null)
  ]);

  return project ?? show ?? article ?? null;
}

async function createOrFindBuyer(name?: string | null) {
  if (!name) return null;
  const existing = await prisma.buyer.findFirst({ where: { name } }).catch(() => null);
  if (existing) return existing;

  const type = deriveBuyerType(name);
  if (!validBuyerTypes.has(type)) return null;
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

    const type = inferCompanyType(name);
    if (!validCompanyTypes.has(type)) continue;
    const created = await prisma.company.create({ data: { name, type } }).catch(() => null);
    if (created) companies.push(created);
  }

  return companies;
}

async function createOrFindPeople(names: string[], roleHint?: string | null) {
  const people = [];
  const role = validPersonRoles.has(String(roleHint ?? "")) ? String(roleHint) : "creator";

  for (const name of names) {
    const existing = await prisma.person.findFirst({ where: { name } }).catch(() => null);
    if (existing) {
      people.push(existing);
      continue;
    }

    const created = await prisma.person.create({ data: { name, role } }).catch(() => null);
    if (created) people.push(created);
  }

  return people;
}

async function updateMockArticle(articleId: string, updater: Parameters<typeof updateMockReviewArticle>[1]) {
  await updateMockReviewArticle(articleId, updater);
  revalidatePath("/review");
}

export async function updateArticleStatus(formData: FormData) {
  const articleId = String(formData.get("articleId") ?? "");
  const extractionStatus = String(formData.get("extractionStatus") ?? "");
  if (!articleId || !extractionStatus) return;

  const success = await prisma.article
    .update({
      where: { id: articleId },
      data: {
        extractionStatus,
        needsReview: extractionStatus === "Needs Review" || extractionStatus === "New"
      }
    })
    .then(() => true)
    .catch(() => false);

  if (!success) {
    await updateMockArticle(articleId, (article) => ({
      ...article,
      extractionStatus,
      extractedDeduplicationNotes:
        extractionStatus === "Duplicate"
          ? article.extractedDeduplicationNotes ?? "Marked duplicate during preview review."
          : article.extractedDeduplicationNotes
    }));
  }

  revalidatePath("/review");
}

export async function extractArticleData(formData: FormData) {
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

    await prisma.article.update({
      where: { id: article.id },
      data: {
        ...mapArticleData(extraction),
        extractionStatus: duplicate ? "Duplicate" : "Needs Review",
        needsReview: true,
        extractedDeduplicationNotes:
          extraction.dedupeReason ??
          (duplicate ? `Possible duplicate found for ${"headline" in duplicate ? duplicate.headline ?? extraction.title : duplicate.title}.` : null)
      }
    }).catch(() => {});
  } else {
    await updateMockReviewArticle(articleId, async (existing) => {
      const extraction = await extractStructuredTVData(existing, "mock");
      return {
        ...existing,
        ...mapArticleData(extraction),
        extractionStatus: extraction.dedupeCandidate ? "Duplicate" : "Needs Review"
      };
    });
  }

  revalidatePath("/review");
}

export async function saveExtractedFields(formData: FormData) {
  const articleId = String(formData.get("articleId") ?? "");
  if (!articleId) return;

  const payload = {
    suspectedCategory: String(formData.get("suspectedCategory") ?? "").trim() || null,
    confidenceScore: Number(formData.get("confidenceScore") ?? "") || null,
    extractedProjectTitle: String(formData.get("extractedProjectTitle") ?? "").trim() || null,
    extractedFormat: String(formData.get("extractedFormat") ?? "").trim() || null,
    extractedStatus: String(formData.get("extractedStatus") ?? "").trim() || null,
    extractedLogline: String(formData.get("extractedLogline") ?? "").trim() || null,
    extractedBuyer: String(formData.get("extractedBuyer") ?? "").trim() || null,
    extractedStudio: String(formData.get("extractedStudio") ?? "").trim() || null,
    extractedCompanies: String(formData.get("extractedCompanies") ?? "").trim() || null,
    extractedPeople: String(formData.get("extractedPeople") ?? "").trim() || null,
    extractedCountry: String(formData.get("extractedCountry") ?? "").trim() || null,
    extractedAnnouncementDate: parseDate(formData.get("extractedAnnouncementDate")),
    extractedPremiereDate: parseDate(formData.get("extractedPremiereDate")),
    extractedRelationships: String(formData.get("extractedRelationships") ?? "").trim() || null,
    extractedFieldsNeedingReview: String(formData.get("extractedFieldsNeedingReview") ?? "").trim() || null,
    extractedDeduplicationNotes: String(formData.get("extractedDeduplicationNotes") ?? "").trim() || null,
    summary: String(formData.get("summary") ?? "").trim() || null
  };

  const success = await prisma.article.update({ where: { id: articleId }, data: payload }).then(() => true).catch(() => false);
  if (!success) {
    await updateMockArticle(articleId, (article) => ({ ...article, ...payload }));
  }

  revalidatePath("/review");
}

export async function createProjectFromArticle(formData: FormData) {
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
        type: validProjectTypes.has(deriveProjectType(article.suspectedCategory)) ? deriveProjectType(article.suspectedCategory) : "scripted",
        status: deriveProjectStatus(article.extractedStatus),
        logline: article.extractedLogline,
        format: article.extractedFormat,
        buyerId: buyer?.id,
        networkOrPlatform: article.extractedBuyer,
        studioId: studio?.id,
        countryOfOrigin: article.extractedCountry,
        isInternational: (article.suspectedCategory ?? "").toLowerCase().includes("international"),
        isCoProduction: (article.suspectedCategory ?? "").toLowerCase().includes("co-production"),
        isAcquisition: (article.suspectedCategory ?? "").toLowerCase().includes("acquisition"),
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
  }

  if (!projectId) return;

  await prisma.article.update({
    where: { id: articleId },
    data: {
      linkedProjectId: projectId,
      extractionStatus: "Approved",
      needsReview: false
    }
  }).catch(() => {});

  revalidatePath("/review");
}

export async function createCurrentShowFromArticle(formData: FormData) {
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
          studio: article.extractedStudio,
          productionCompanies: article.extractedCompanies,
          country: article.extractedCountry,
          sourceUrl: article.url,
          notes: article.summary || "Created from Article Review Queue."
        }
      }).catch(() => null)
    )?.id;

  if (!showId) return;

  await prisma.article.update({
    where: { id: articleId },
    data: {
      linkedShowId: showId,
      extractionStatus: "Approved",
      needsReview: false
    }
  }).catch(() => {});

  revalidatePath("/review");
}

export async function linkArticleToProject(formData: FormData) {
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
