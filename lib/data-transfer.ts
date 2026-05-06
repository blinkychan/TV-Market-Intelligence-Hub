import {
  BuyerType,
  CompanyType,
  ConfidenceLevel,
  CurrentShowSeasonType,
  Prisma,
  PersonRole,
  ProjectStatus,
  ProjectType
} from "@prisma/client";
import { recordAuditLog } from "@/lib/audit";
import { calculateArticleConfidence, calculateCurrentShowConfidence, calculateProjectConfidence, joinConfidenceReasons } from "@/lib/confidence";
import { mergeTagList } from "@/lib/csv";
import { getImportFields, IMPORT_ENTITY_OPTIONS, type ImportEntityType, type ImportField } from "@/lib/import-config";
import { prisma } from "@/lib/prisma";
import { canUseMockPreview } from "@/lib/runtime-mode";
import { triggerLowConfidenceAlert, triggerPremiereUpdateAlert, triggerStatusChangeAlert } from "@/lib/watchlists";

export type ImportPreviewRow = {
  rowNumber: number;
  values: Record<string, string>;
  warnings: string[];
  errors: string[];
  duplicateOfId: string | null;
};

export type ImportPreviewResult = {
  entityType: ImportEntityType;
  fields: ImportField[];
  rows: ImportPreviewRow[];
  acceptedCount: number;
  duplicateCount: number;
  errorCount: number;
  databaseWritable: boolean;
};

type ExportProject = Prisma.ProjectGetPayload<{
  include: { buyer: true; studio: true; productionCompanies: true; people: true };
}>;
type ExportBuyer = Prisma.BuyerGetPayload<{ include: { projects: true } }>;
type ExportCompany = Prisma.CompanyGetPayload<{ include: { studioProjects: true; productionProjects: true } }>;
type ExportPerson = Prisma.PersonGetPayload<{ include: { projects: true } }>;

const PROJECT_TYPE_VALUES = new Set(Object.values(ProjectType));
const PROJECT_STATUS_VALUES = new Set(Object.values(ProjectStatus));
const BUYER_TYPE_VALUES = new Set(Object.values(BuyerType));
const COMPANY_TYPE_VALUES = new Set(Object.values(CompanyType));
const PERSON_ROLE_VALUES = new Set(Object.values(PersonRole));
const CONFIDENCE_VALUES = new Set(Object.values(ConfidenceLevel));
const CURRENT_SHOW_SEASON_VALUES = new Set(Object.values(CurrentShowSeasonType));


function parseDate(value: string | null | undefined) {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function parseBool(value: string | null | undefined) {
  const text = String(value ?? "").trim().toLowerCase();
  return text === "true" || text === "yes" || text === "1" || text === "y";
}

function parseList(value: string | null | undefined) {
  return String(value ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function normalizeProjectType(value: string | null | undefined) {
  const normalized = String(value ?? "").trim().toLowerCase().replace(/\s+/g, "_").replace(/-/g, "_");
  return PROJECT_TYPE_VALUES.has(normalized as ProjectType) ? (normalized as ProjectType) : null;
}

function normalizeProjectStatus(value: string | null | undefined) {
  const normalized = String(value ?? "").trim().toLowerCase().replace(/\s+/g, "_").replace(/-/g, "_");
  return PROJECT_STATUS_VALUES.has(normalized as ProjectStatus) ? (normalized as ProjectStatus) : null;
}

function normalizeBuyerType(value: string | null | undefined) {
  const normalized = String(value ?? "").trim().toLowerCase().replace(/\s+/g, "_").replace(/-/g, "_");
  return BUYER_TYPE_VALUES.has(normalized as BuyerType) ? (normalized as BuyerType) : BuyerType.streamer;
}

function normalizeCompanyType(value: string | null | undefined) {
  const normalized = String(value ?? "").trim().toLowerCase().replace(/\s+/g, "_").replace(/-/g, "_");
  return COMPANY_TYPE_VALUES.has(normalized as CompanyType) ? (normalized as CompanyType) : CompanyType.production_company;
}

function normalizePersonRole(value: string | null | undefined) {
  const normalized = String(value ?? "").trim().toLowerCase().replace(/\s+/g, "_").replace(/-/g, "_");
  if (PERSON_ROLE_VALUES.has(normalized as PersonRole)) return normalized as PersonRole;
  if (normalized.includes("showrunner")) return PersonRole.showrunner;
  if (normalized.includes("creator")) return PersonRole.creator;
  if (normalized.includes("writer")) return PersonRole.writer;
  if (normalized.includes("producer")) return PersonRole.producer;
  if (normalized.includes("executive")) return PersonRole.executive;
  if (normalized.includes("director")) return PersonRole.director;
  return PersonRole.actor;
}

function normalizeConfidenceLevel(value: string | null | undefined) {
  const normalized = String(value ?? "").trim().toLowerCase();
  return CONFIDENCE_VALUES.has(normalized as ConfidenceLevel) ? (normalized as ConfidenceLevel) : null;
}

function normalizeSeasonType(value: string | null | undefined) {
  const normalized = String(value ?? "").trim().toLowerCase().replace(/\s+/g, "_").replace(/-/g, "_");
  return CURRENT_SHOW_SEASON_VALUES.has(normalized as CurrentShowSeasonType) ? (normalized as CurrentShowSeasonType) : null;
}

async function findDuplicateForImport(entityType: ImportEntityType, values: Record<string, string>) {
  try {
    if (entityType === "projects") {
      const title = values.title?.trim();
      if (!title) return null;
      const buyer = values.buyer?.trim();
      const announcementDate = parseDate(values.announcementDate);
      const project = await prisma.project.findFirst({
        where: {
          title,
          ...(buyer ? { OR: [{ networkOrPlatform: buyer }, { buyer: { name: buyer } }] } : {}),
          ...(announcementDate ? { announcementDate } : {})
        },
        select: { id: true }
      });
      return project?.id ?? null;
    }

    if (entityType === "current-shows") {
      const title = values.title?.trim();
      const networkOrPlatform = values.networkOrPlatform?.trim();
      if (!title || !networkOrPlatform) return null;
      const show = await prisma.currentShow.findFirst({
        where: {
          title,
          networkOrPlatform,
          premiereDate: parseDate(values.premiereDate)
        },
        select: { id: true }
      });
      return show?.id ?? null;
    }

    if (entityType === "buyers") {
      const buyer = await prisma.buyer.findUnique({ where: { name: values.name.trim() }, select: { id: true } });
      return buyer?.id ?? null;
    }

    if (entityType === "companies") {
      const company = await prisma.company.findUnique({ where: { name: values.name.trim() }, select: { id: true } });
      return company?.id ?? null;
    }

    if (entityType === "people") {
      const person = await prisma.person.findUnique({ where: { name: values.name.trim() }, select: { id: true } });
      return person?.id ?? null;
    }

    const article = await prisma.article.findUnique({ where: { url: values.url.trim() }, select: { id: true } });
    return article?.id ?? null;
  } catch {
    return null;
  }
}

export async function previewCsvImport(entityType: ImportEntityType, rows: Array<Record<string, string>>): Promise<ImportPreviewResult> {
  const previewRows: ImportPreviewRow[] = [];
  const databaseWritable = await prisma.$queryRaw`SELECT 1`.then(() => true).catch(() => false);

  for (const [index, values] of rows.entries()) {
    const errors: string[] = [];
    const warnings: string[] = [];
    const fields = getImportFields(entityType);

    for (const field of fields) {
      if (field.required && !String(values[field.key] ?? "").trim()) {
        errors.push(`Missing required field: ${field.label}.`);
      }
    }

    if (entityType === "projects") {
      if (values.type && !normalizeProjectType(values.type)) errors.push("Project type is not recognized.");
      if (values.status && !normalizeProjectStatus(values.status)) errors.push("Project status is not recognized.");
      if (values.announcementDate && !parseDate(values.announcementDate)) warnings.push("Announcement date could not be parsed.");
    }

    if (entityType === "current-shows") {
      if (values.premiereDate && !parseDate(values.premiereDate)) warnings.push("Premiere date could not be parsed.");
      if (values.seasonType && !normalizeSeasonType(values.seasonType)) warnings.push("Season type is not recognized.");
    }

    if (entityType === "articles" && values.publishedDate && !parseDate(values.publishedDate)) {
      warnings.push("Published date could not be parsed.");
    }

    const duplicateOfId = databaseWritable ? await findDuplicateForImport(entityType, values) : null;
    if (duplicateOfId) warnings.push("Possible duplicate detected in the existing database.");
    previewRows.push({ rowNumber: index + 2, values, warnings, errors, duplicateOfId });
  }

  return {
    entityType,
    fields: getImportFields(entityType),
    rows: previewRows,
    acceptedCount: previewRows.filter((row) => row.errors.length === 0 && !row.duplicateOfId).length,
    duplicateCount: previewRows.filter((row) => Boolean(row.duplicateOfId)).length,
    errorCount: previewRows.reduce((sum, row) => sum + row.errors.length, 0),
    databaseWritable
  };
}

async function ensureBuyer(name: string | null | undefined) {
  const trimmed = String(name ?? "").trim();
  if (!trimmed) return null;
  return prisma.buyer.upsert({
    where: { name: trimmed },
    update: {},
    create: { name: trimmed, type: BuyerType.streamer }
  });
}

async function ensureCompany(name: string | null | undefined, type: CompanyType = CompanyType.production_company) {
  const trimmed = String(name ?? "").trim();
  if (!trimmed) return null;
  return prisma.company.upsert({
    where: { name: trimmed },
    update: {},
    create: { name: trimmed, type }
  });
}

async function ensurePerson(name: string | null | undefined, role: PersonRole = PersonRole.actor) {
  const trimmed = String(name ?? "").trim();
  if (!trimmed) return null;
  return prisma.person.upsert({
    where: { name: trimmed },
    update: {},
    create: { name: trimmed, role }
  });
}

export async function confirmCsvImport(entityType: ImportEntityType, rows: Array<Record<string, string>>) {
  const summary = {
    created: 0,
    skippedDuplicates: 0,
    skippedErrors: 0,
    warnings: [] as string[]
  };

  for (const values of rows) {
    const preview = await previewCsvImport(entityType, [values]);
    const rowPreview = preview.rows[0];
    if (!rowPreview || rowPreview.errors.length > 0) {
      summary.skippedErrors += 1;
      continue;
    }
    if (rowPreview.duplicateOfId) {
      summary.skippedDuplicates += 1;
      continue;
    }

    if (entityType === "projects") {
      const buyer = await ensureBuyer(values.buyer);
      const studio = await ensureCompany(values.studio, CompanyType.studio);
      const productionCompanies = await Promise.all(parseList(values.productionCompanies).map((name) => ensureCompany(name)));
      const people = await Promise.all(parseList(values.people).map((name) => ensurePerson(name, PersonRole.creator)));
      const confidence = calculateProjectConfidence({
        sourceReliability: values.sourceUrl ? "medium" : "low",
        bodyAvailable: false,
        title: values.title,
        buyer: buyer?.name ?? values.buyer ?? null,
        studio: studio?.name ?? values.studio ?? null,
        genre: values.genre ?? null,
        status: values.status ?? null,
        country: values.countryOfOrigin ?? null,
        announcementDate: parseDate(values.announcementDate),
        sourceUrl: values.sourceUrl ?? null,
        productionCompanies: productionCompanies.map((item) => item?.name).filter(Boolean) as string[],
        people: people.map((item) => item?.name).filter(Boolean) as string[],
        needsReview: false
      });
      const created = await prisma.project.create({
        data: {
          title: values.title.trim(),
          type: normalizeProjectType(values.type) ?? ProjectType.scripted,
          status: normalizeProjectStatus(values.status) ?? ProjectStatus.unknown,
          buyerId: buyer?.id ?? null,
          networkOrPlatform: values.buyer?.trim() || null,
          studioId: studio?.id ?? null,
          genre: values.genre?.trim() || null,
          countryOfOrigin: values.countryOfOrigin?.trim() || null,
          announcementDate: parseDate(values.announcementDate),
          sourceUrl: values.sourceUrl?.trim() || null,
          notes: values.notes?.trim() || "Imported from CSV.",
          confidenceScore: confidence.score,
          confidenceLevel: confidence.level,
          confidenceReasons: joinConfidenceReasons(confidence.reasons),
          productionCompanies: { connect: productionCompanies.filter(Boolean).map((item) => ({ id: item!.id })) },
          people: { connect: people.filter(Boolean).map((item) => ({ id: item!.id })) }
        }
      });
      await recordAuditLog({
        entityType: "Project",
        entityId: created.id,
        action: "imported",
        previousValueJson: null,
        newValueJson: created,
        reason: "Imported from CSV.",
        source: "csv_import"
      });
      summary.created += 1;
      continue;
    }

    if (entityType === "current-shows") {
      const confidence = calculateCurrentShowConfidence({
        sourceReliability: "high",
        title: values.title,
        networkOrPlatform: values.networkOrPlatform,
        premiereDate: parseDate(values.premiereDate),
        finaleDate: parseDate(values.finaleDate),
        studio: values.studio ?? null,
        productionCompanies: values.productionCompanies ?? null,
        genre: values.genre ?? null,
        country: values.country ?? null,
        sourceUrl: values.sourceUrl ?? null,
        verifiedAt: new Date(),
        needsVerification: false,
        notes: values.notes ?? null,
        humanEdited: true
      });
      const created = await prisma.currentShow.create({
        data: {
          title: values.title.trim(),
          networkOrPlatform: values.networkOrPlatform.trim(),
          premiereDate: parseDate(values.premiereDate),
          finaleDate: parseDate(values.finaleDate),
          status: values.status?.trim() || "premiering soon",
          genre: values.genre?.trim() || null,
          studio: values.studio?.trim() || null,
          country: values.country?.trim() || null,
          sourceUrl: values.sourceUrl?.trim() || null,
          seasonType: normalizeSeasonType(values.seasonType),
          sourceType: "manual_csv",
          sourceReliability: "high",
          notes: values.notes?.trim() || "Imported from CSV.",
          verifiedAt: new Date(),
          needsVerification: false,
          confidenceScore: confidence.score,
          confidenceLevel: confidence.level,
          confidenceReasons: joinConfidenceReasons(confidence.reasons)
        }
      });
      await recordAuditLog({
        entityType: "CurrentShow",
        entityId: created.id,
        action: "imported",
        previousValueJson: null,
        newValueJson: created,
        reason: "Imported from CSV.",
        source: "csv_import"
      });
      summary.created += 1;
      continue;
    }

    if (entityType === "buyers") {
      const created = await prisma.buyer.create({
        data: {
          name: values.name.trim(),
          type: normalizeBuyerType(values.type),
          parentCompany: values.parentCompany?.trim() || null,
          notes: values.notes?.trim() || "Imported from CSV."
        }
      });
      await recordAuditLog({ entityType: "Buyer", entityId: created.id, action: "imported", previousValueJson: null, newValueJson: created, reason: "Imported from CSV.", source: "csv_import" });
      summary.created += 1;
      continue;
    }

    if (entityType === "companies") {
      const created = await prisma.company.create({
        data: {
          name: values.name.trim(),
          type: normalizeCompanyType(values.type),
          notes: values.notes?.trim() || "Imported from CSV."
        }
      });
      await recordAuditLog({ entityType: "Company", entityId: created.id, action: "imported", previousValueJson: null, newValueJson: created, reason: "Imported from CSV.", source: "csv_import" });
      summary.created += 1;
      continue;
    }

    if (entityType === "people") {
      const created = await prisma.person.create({
        data: {
          name: values.name.trim(),
          role: normalizePersonRole(values.role),
          company: values.company?.trim() || null,
          reps: values.reps?.trim() || null,
          notes: values.notes?.trim() || "Imported from CSV."
        }
      });
      await recordAuditLog({ entityType: "Person", entityId: created.id, action: "imported", previousValueJson: null, newValueJson: created, reason: "Imported from CSV.", source: "csv_import" });
      summary.created += 1;
      continue;
    }

    const confidence = calculateArticleConfidence({
      sourceReliability: "medium",
      extractionSource: "manual",
      bodyAvailable: false,
      summary: values.summary ?? null,
      title: values.headline ?? null
    });
    const created = await prisma.article.create({
      data: {
        headline: values.headline.trim(),
        url: values.url.trim(),
        publication: values.publication?.trim() || null,
        publishedDate: parseDate(values.publishedDate),
        summary: values.summary?.trim() || null,
        suspectedCategory: values.suspectedCategory?.trim() || null,
        ingestionSource: "Manual CSV",
        extractionStatus: "Needs Review",
        needsReview: true,
        extractionConfidence: confidence.score,
        extractionSource: "manual",
        confidenceScore: confidence.score,
        bodyAvailable: false
      }
    });
    await recordAuditLog({ entityType: "Article", entityId: created.id, action: "imported", previousValueJson: null, newValueJson: created, reason: "Imported from CSV.", source: "csv_import" });
    summary.created += 1;
  }

  return summary;
}

function hideRestrictedFields<T extends Record<string, unknown>>(rows: T[], includeSensitive = false) {
  if (includeSensitive) return rows;
  return rows.map((row) => {
    const next = { ...row };
    delete next.notes;
    delete next.rawHtml;
    delete next.extractedText;
    delete next.rawText;
    return next;
  });
}

export async function getExportRows(args: {
  pageType: string;
  filters: URLSearchParams;
  includeSensitive?: boolean;
  forceMock?: boolean;
}) {
  const includeSensitive = Boolean(args.includeSensitive);
  const search = (args.filters.get("q") ?? args.filters.get("query") ?? "").trim().toLowerCase();

  if (args.pageType === "development_tracker") {
    const rows = await prisma.project.findMany({
      include: { buyer: true, studio: true, productionCompanies: true, people: true },
      where: {
        archivedAt: null,
        ...(args.filters.get("status") ? { status: args.filters.get("status") as ProjectStatus } : {}),
        ...(args.filters.get("buyer") ? { buyer: { name: args.filters.get("buyer") as string } } : {}),
        ...(args.filters.get("genre") ? { genre: args.filters.get("genre") as string } : {})
      },
      orderBy: [{ announcementDate: "desc" }, { title: "asc" }]
    }).catch(() => [] as ExportProject[]);

    const filtered = rows.filter((project) => {
      const savedView = args.filters.get("savedView") ?? "current";
      if (savedView === "pilot" && project.status !== "pilot_order") return false;
      if (savedView === "series" && project.status !== "series_order") return false;
      if (savedView === "acquisitions" && !project.isAcquisition) return false;
      if (savedView === "international" && !(project.isInternational || project.isCoProduction)) return false;
      if (savedView === "stale" && project.status !== "stale") return false;
      if (savedView === "review" && !project.needsReview) return false;
      if (args.filters.get("country") && project.countryOfOrigin !== args.filters.get("country")) return false;
      if (args.filters.get("confidence") && project.confidenceLevel !== args.filters.get("confidence")) return false;
      return true;
    });

    return hideRestrictedFields(
      filtered
        .filter((project) => {
          if (!search) return true;
          return [
            project.title,
            project.genre,
            project.buyer?.name,
            project.networkOrPlatform,
            project.studio?.name,
            project.notes,
            ...project.productionCompanies.map((item: ExportProject["productionCompanies"][number]) => item.name),
            ...project.people.map((item: ExportProject["people"][number]) => item.name)
          ]
            .filter(Boolean)
            .join(" ")
            .toLowerCase()
            .includes(search);
        })
        .map((project) => ({
        id: project.id,
        title: project.title,
        type: project.type,
        status: project.status,
        buyer: project.buyer?.name ?? project.networkOrPlatform,
        studio: project.studio?.name,
        productionCompanies: project.productionCompanies.map((item: ExportProject["productionCompanies"][number]) => item.name).join(", "),
        people: project.people.map((item: ExportProject["people"][number]) => item.name).join(", "),
        genre: project.genre,
        countryOfOrigin: project.countryOfOrigin,
        announcementDate: project.announcementDate?.toISOString() ?? null,
        sourceUrl: project.sourceUrl,
        confidenceLevel: project.confidenceLevel,
        confidenceScore: project.confidenceScore,
        needsReview: project.needsReview,
        tags: project.tags,
        notes: project.notes
        })),
      includeSensitive
    );
  }

  if (args.pageType === "current_tv_tracker") {
    const premiereFrom = parseDate(args.filters.get("premiereFrom"));
    const premiereTo = parseDate(args.filters.get("premiereTo"));
    const rows = await prisma.currentShow.findMany({
      where: {
        archivedAt: null,
        ...(args.filters.get("status") ? { status: args.filters.get("status") as string } : {}),
        ...(args.filters.get("platform") ? { networkOrPlatform: args.filters.get("platform") as string } : {}),
        ...(args.filters.get("genre") ? { genre: args.filters.get("genre") as string } : {})
      },
      orderBy: [{ premiereDate: "asc" }, { title: "asc" }]
    }).catch(() => []);

    return hideRestrictedFields(
      rows
        .filter((show) => {
          if (search) {
            const haystack = [show.title, show.networkOrPlatform, show.genre, show.studio, show.country, show.notes]
              .filter(Boolean)
              .join(" ")
              .toLowerCase();
            if (!haystack.includes(search)) return false;
          }
          if (args.filters.get("country") && show.country !== args.filters.get("country")) return false;
          if (args.filters.get("confidence") && show.confidenceLevel !== args.filters.get("confidence")) return false;
          if (premiereFrom && show.premiereDate && show.premiereDate < premiereFrom) return false;
          if (premiereTo && show.premiereDate && show.premiereDate > premiereTo) return false;
          return true;
        })
        .map((show) => ({
          id: show.id,
          title: show.title,
          networkOrPlatform: show.networkOrPlatform,
          premiereDate: show.premiereDate?.toISOString() ?? null,
          finaleDate: show.finaleDate?.toISOString() ?? null,
          status: show.status,
          genre: show.genre,
          studio: show.studio,
          country: show.country,
          seasonType: show.seasonType,
          sourceUrl: show.sourceUrl,
          confidenceLevel: show.confidenceLevel,
          confidenceScore: show.confidenceScore,
          needsVerification: show.needsVerification,
          tags: show.tags,
          notes: show.notes
        })),
      includeSensitive
    );
  }

  if (args.pageType === "buyers") {
    const rows = await prisma.buyer.findMany({
      where: { archivedAt: null, ...(args.filters.get("type") ? { type: args.filters.get("type") as BuyerType } : {}) },
      include: { projects: true },
      orderBy: { name: "asc" }
    }).catch(() => [] as ExportBuyer[]);
    return hideRestrictedFields(
      rows
        .filter((buyer) => {
          if (!search) return true;
          return [buyer.name, buyer.parentCompany, buyer.notes, buyer.type].filter(Boolean).join(" ").toLowerCase().includes(search);
        })
        .map((buyer) => ({
        id: buyer.id,
        name: buyer.name,
        type: buyer.type,
        parentCompany: buyer.parentCompany,
        projectCount: buyer.projects.length,
        tags: buyer.tags,
        notes: buyer.notes
        })),
      includeSensitive
    );
  }

  if (args.pageType === "companies") {
    const rows = await prisma.company.findMany({
      where: { archivedAt: null, ...(args.filters.get("tab") === "people" ? {} : {}) },
      include: { studioProjects: true, productionProjects: true },
      orderBy: { name: "asc" }
    }).catch(() => [] as ExportCompany[]);
    return hideRestrictedFields(
      rows
        .filter((company) => {
          if (!search) return true;
          return [company.name, company.notes, company.type].filter(Boolean).join(" ").toLowerCase().includes(search);
        })
        .map((company) => ({
        id: company.id,
        name: company.name,
        type: company.type,
        projectCount: company.studioProjects.length + company.productionProjects.length,
        tags: company.tags,
        notes: company.notes
        })),
      includeSensitive
    );
  }

  if (args.pageType === "people") {
    const rows = await prisma.person.findMany({
      where: { archivedAt: null },
      include: { projects: true },
      orderBy: { name: "asc" }
    }).catch(() => [] as ExportPerson[]);
    return hideRestrictedFields(
      rows
        .filter((person) => {
          if (!search) return true;
          return [person.name, person.role, person.company, person.reps, person.notes].filter(Boolean).join(" ").toLowerCase().includes(search);
        })
        .map((person) => ({
        id: person.id,
        name: person.name,
        role: person.role,
        company: person.company,
        reps: person.reps,
        projectCount: person.projects.length,
        tags: person.tags,
        notes: person.notes
        })),
      includeSensitive
    );
  }

  if (args.pageType === "articles") {
    const rows = await prisma.article.findMany({
      where: {
        archivedAt: null,
        ...(args.filters.get("status") && args.filters.get("status") !== "All" ? { extractionStatus: args.filters.get("status") as string } : {})
      },
      orderBy: [{ publishedDate: "desc" }, { createdAt: "desc" }]
    }).catch(() => []);
    return hideRestrictedFields(
      rows
        .filter((article) => {
          if (search) {
            const haystack = [
              article.headline,
              article.publication,
              article.suspectedCategory,
              article.extractedProjectTitle,
              article.extractedBuyer,
              article.extractedStudio,
              article.extractedCompanies,
              article.extractedPeople
            ]
              .filter(Boolean)
              .join(" ")
              .toLowerCase();
            if (!haystack.includes(search)) return false;
          }
          if (args.filters.get("confidence") === "low" && article.extractionConfidence != null && article.extractionConfidence >= 0.55) return false;
          return true;
        })
        .map((article) => ({
        id: article.id,
        headline: article.headline,
        publication: article.publication,
        publishedDate: article.publishedDate?.toISOString() ?? null,
        url: article.url,
        extractionStatus: article.extractionStatus,
        suspectedCategory: article.suspectedCategory,
        linkedProjectId: article.linkedProjectId,
        linkedShowId: article.linkedShowId,
        extractionConfidence: article.extractionConfidence,
        extractionSource: article.extractionSource,
        bodyAvailable: article.bodyAvailable,
        sourceReliability: article.sourceReliability,
        tags: article.tags,
        summary: includeSensitive ? article.summary : null
        })),
      includeSensitive
    );
  }

  if (args.pageType === "missing_data") {
    return prisma.missingDataFlag.findMany({
      where: { resolvedAt: null },
      orderBy: [{ severity: "desc" }, { createdAt: "desc" }]
    }).catch(() => []);
  }

  return [];
}

export async function bulkUpdateRecords(args: {
  entityType: "Project" | "CurrentShow" | "Article";
  ids: string[];
  action: string;
  value?: string | null;
  confirm?: boolean;
  dryRun?: boolean;
}) {
  const ids = Array.from(new Set(args.ids.filter(Boolean)));
  const affectedCount = ids.length;
  if (!ids.length) return { affectedCount: 0, updatedCount: 0, preview: [] as unknown[] };

  if (args.entityType === "Project") {
    const records = await prisma.project.findMany({ where: { id: { in: ids } } });
    const preview = records.slice(0, 12).map((record) => ({ id: record.id, label: record.title }));
    if (args.dryRun || !args.confirm) return { affectedCount, updatedCount: 0, preview };

    let updatedCount = 0;
    for (const record of records) {
      let data: Prisma.ProjectUncheckedUpdateInput | null = null;
      if (args.action === "needs_review") data = { needsReview: true };
      else if (args.action === "status") {
        const nextStatus = normalizeProjectStatus(args.value);
        if (nextStatus) data = { status: nextStatus };
      }
      else if (args.action === "genre") data = { genre: args.value?.trim() || null };
      else if (args.action === "confidence_level") {
        const nextConfidence = normalizeConfidenceLevel(args.value);
        if (nextConfidence) data = { confidenceLevel: nextConfidence };
      }
      else if (args.action === "mark_stale") data = { status: ProjectStatus.stale };
      else if (args.action === "add_tag") data = { tags: mergeTagList(record.tags, parseList(args.value)) };
      else if (args.action === "remove_tag") data = { tags: parseList(record.tags).filter((item) => !parseList(args.value).includes(item)).join(", ") || null };
      else if (args.action === "archive") data = { archivedAt: new Date() };
      else if (args.action === "buyer") {
        const buyer = await ensureBuyer(args.value);
        data = { buyerId: buyer?.id ?? null, networkOrPlatform: buyer?.name ?? args.value?.trim() ?? null };
      }
      if (!data) continue;
      const updated = await prisma.project.update({ where: { id: record.id }, data });
      await triggerStatusChangeAlert({
        entityType: "Project",
        entityId: updated.id,
        label: updated.title,
        previousStatus: record.status,
        nextStatus: updated.status
      });
      await triggerLowConfidenceAlert({
        entityType: "Project",
        entityId: updated.id,
        label: updated.title,
        confidenceLevel: updated.confidenceLevel,
        impact: updated.status === "series_order" || updated.status === "pilot_order" || updated.status === "sold" ? "high" : "medium"
      });
      await recordAuditLog({ entityType: "Project", entityId: record.id, action: "updated", previousValueJson: record, newValueJson: updated, reason: `Bulk action: ${args.action}`, source: "bulk_edit" });
      updatedCount += 1;
    }
    return { affectedCount, updatedCount, preview };
  }

  if (args.entityType === "CurrentShow") {
    const records = await prisma.currentShow.findMany({ where: { id: { in: ids } } });
    const preview = records.slice(0, 12).map((record) => ({ id: record.id, label: record.title }));
    if (args.dryRun || !args.confirm) return { affectedCount, updatedCount: 0, preview };

    let updatedCount = 0;
    for (const record of records) {
      let data: Prisma.CurrentShowUpdateInput | null = null;
      if (args.action === "status") data = { status: args.value?.trim() || record.status };
      else if (args.action === "genre") data = { genre: args.value?.trim() || null };
      else if (args.action === "confidence_level") {
        const nextConfidence = normalizeConfidenceLevel(args.value);
        if (nextConfidence) data = { confidenceLevel: nextConfidence };
      }
      else if (args.action === "source_reliability") data = { sourceReliability: args.value?.trim() || null };
      else if (args.action === "mark_verified") data = { verifiedAt: new Date(), needsVerification: false };
      else if (args.action === "mark_stale") data = { status: "stale" };
      else if (args.action === "add_tag") data = { tags: mergeTagList(record.tags, parseList(args.value)) };
      else if (args.action === "remove_tag") data = { tags: parseList(record.tags).filter((item) => !parseList(args.value).includes(item)).join(", ") || null };
      else if (args.action === "archive") data = { archivedAt: new Date() };
      if (!data) continue;
      const updated = await prisma.currentShow.update({ where: { id: record.id }, data });
      await triggerStatusChangeAlert({
        entityType: "CurrentShow",
        entityId: updated.id,
        label: updated.title,
        previousStatus: record.status,
        nextStatus: updated.status
      });
      await triggerPremiereUpdateAlert({
        entityId: updated.id,
        label: updated.title,
        previousPremiereDate: record.premiereDate,
        nextPremiereDate: updated.premiereDate
      });
      await triggerLowConfidenceAlert({
        entityType: "CurrentShow",
        entityId: updated.id,
        label: updated.title,
        confidenceLevel: updated.confidenceLevel,
        impact: "high"
      });
      await recordAuditLog({ entityType: "CurrentShow", entityId: record.id, action: "updated", previousValueJson: record, newValueJson: updated, reason: `Bulk action: ${args.action}`, source: "bulk_edit" });
      updatedCount += 1;
    }
    return { affectedCount, updatedCount, preview };
  }

  const records = await prisma.article.findMany({ where: { id: { in: ids } } });
  const preview = records.slice(0, 12).map((record) => ({ id: record.id, label: record.headline }));
  if (args.dryRun || !args.confirm) return { affectedCount, updatedCount: 0, preview };

  let updatedCount = 0;
  for (const record of records) {
    let data: Prisma.ArticleUpdateInput | null = null;
    if (args.action === "needs_review") data = { needsReview: true, extractionStatus: "Needs Review" };
    else if (args.action === "status") data = { extractionStatus: args.value?.trim() || record.extractionStatus };
    else if (args.action === "confidence_level" && normalizeConfidenceLevel(args.value)) data = { confidenceScore: args.value === "high" ? 0.88 : args.value === "medium" ? 0.66 : 0.35 };
    else if (args.action === "source_reliability") data = { sourceReliability: args.value?.trim() || null };
    else if (args.action === "add_tag") data = { tags: mergeTagList(record.tags, parseList(args.value)) };
    else if (args.action === "remove_tag") data = { tags: parseList(record.tags).filter((item) => !parseList(args.value).includes(item)).join(", ") || null };
    else if (args.action === "archive") data = { archivedAt: new Date() };
    if (!data) continue;
    const updated = await prisma.article.update({ where: { id: record.id }, data });
    await recordAuditLog({ entityType: "Article", entityId: record.id, action: "updated", previousValueJson: record, newValueJson: updated, reason: `Bulk action: ${args.action}`, source: "bulk_edit" });
    updatedCount += 1;
  }

  return { affectedCount, updatedCount, preview };
}

export function importWriteAllowed() {
  return canUseMockPreview();
}
