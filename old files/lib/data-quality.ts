import { Prisma, type MissingDataSeverity, type SourceCoverageType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { triggerMissingDataAlert } from "@/lib/watchlists";

function toJsonValue(value: unknown): Prisma.InputJsonValue | Prisma.NullableJsonNullValueInput | undefined {
  if (value === undefined) return undefined;
  if (value === null) return Prisma.JsonNull;
  return value as Prisma.InputJsonValue;
}

export type MissingDataInput = {
  entityType: "Article" | "Project" | "CurrentShow" | "Buyer" | "Company" | "Person";
  entityId: string;
  missingField: string;
  severity: MissingDataSeverity;
  reason: string;
};

function pushIfMissing(
  flags: MissingDataInput[],
  args: {
    entityType: MissingDataInput["entityType"];
    entityId: string;
    missingField: string;
    severity: MissingDataSeverity;
    reason: string;
    when: boolean;
  }
) {
  if (!args.when) return;
  flags.push({
    entityType: args.entityType,
    entityId: args.entityId,
    missingField: args.missingField,
    severity: args.severity,
    reason: args.reason
  });
}

export function detectArticleMissingData(article: {
  id: string;
  url?: string | null;
  extractedText?: string | null;
  extractedExcerpt?: string | null;
  extractedBuyer?: string | null;
  extractedStudio?: string | null;
  extractionSource?: string | null;
  extractionConfidence?: number | null;
  confidenceScore?: number | null;
}): MissingDataInput[] {
  const flags: MissingDataInput[] = [];
  pushIfMissing(flags, {
    entityType: "Article",
    entityId: article.id,
    missingField: "source_url",
    severity: "high",
    reason: "Canonical source URL is missing.",
    when: !article.url
  });
  pushIfMissing(flags, {
    entityType: "Article",
    entityId: article.id,
    missingField: "body_text",
    severity: "medium",
    reason: "Article body text is unavailable; extraction is relying on excerpt, summary, or headline.",
    when: !article.extractedText?.trim()
  });
  pushIfMissing(flags, {
    entityType: "Article",
    entityId: article.id,
    missingField: "buyer",
    severity: "medium",
    reason: "Buyer / network / platform is missing from extracted fields.",
    when: !article.extractedBuyer?.trim()
  });
  pushIfMissing(flags, {
    entityType: "Article",
    entityId: article.id,
    missingField: "studio",
    severity: "low",
    reason: "Studio is missing from extracted fields.",
    when: !article.extractedStudio?.trim()
  });
  pushIfMissing(flags, {
    entityType: "Article",
    entityId: article.id,
    missingField: "headline_only",
    severity: "high",
    reason: "Extraction is headline-only and needs human review.",
    when: article.extractionSource === "headline_only"
  });
  pushIfMissing(flags, {
    entityType: "Article",
    entityId: article.id,
    missingField: "low_confidence",
    severity: "high",
    reason: "Article extraction confidence is low.",
    when: (article.extractionConfidence ?? article.confidenceScore ?? 1) < 0.55
  });
  return flags;
}

export function detectProjectMissingData(project: {
  id: string;
  buyerId?: string | null;
  networkOrPlatform?: string | null;
  studioId?: string | null;
  sourceUrl?: string | null;
  confidenceLevel?: string | null;
  productionCompanies?: Array<unknown>;
}): MissingDataInput[] {
  const flags: MissingDataInput[] = [];
  pushIfMissing(flags, {
    entityType: "Project",
    entityId: project.id,
    missingField: "buyer",
    severity: "high",
    reason: "Project is missing a linked buyer or network/platform.",
    when: !project.buyerId && !project.networkOrPlatform
  });
  pushIfMissing(flags, {
    entityType: "Project",
    entityId: project.id,
    missingField: "studio",
    severity: "medium",
    reason: "Project is missing a linked studio.",
    when: !project.studioId
  });
  pushIfMissing(flags, {
    entityType: "Project",
    entityId: project.id,
    missingField: "production_company",
    severity: "medium",
    reason: "Project has no connected production company.",
    when: !project.productionCompanies?.length
  });
  pushIfMissing(flags, {
    entityType: "Project",
    entityId: project.id,
    missingField: "source_url",
    severity: "medium",
    reason: "Project is missing its source URL.",
    when: !project.sourceUrl
  });
  pushIfMissing(flags, {
    entityType: "Project",
    entityId: project.id,
    missingField: "low_confidence",
    severity: "high",
    reason: "Project confidence is low.",
    when: project.confidenceLevel === "low"
  });
  return flags;
}

export function detectCurrentShowMissingData(show: {
  id: string;
  premiereDate?: Date | null;
  sourceUrl?: string | null;
  confidenceLevel?: string | null;
  productionCompanies?: string | null;
}): MissingDataInput[] {
  const flags: MissingDataInput[] = [];
  pushIfMissing(flags, {
    entityType: "CurrentShow",
    entityId: show.id,
    missingField: "premiere_date",
    severity: "high",
    reason: "Current show is missing a premiere date.",
    when: !show.premiereDate
  });
  pushIfMissing(flags, {
    entityType: "CurrentShow",
    entityId: show.id,
    missingField: "production_company",
    severity: "medium",
    reason: "Current show is missing a production company.",
    when: !show.productionCompanies?.trim()
  });
  pushIfMissing(flags, {
    entityType: "CurrentShow",
    entityId: show.id,
    missingField: "source_url",
    severity: "medium",
    reason: "Current show is missing a source URL.",
    when: !show.sourceUrl
  });
  pushIfMissing(flags, {
    entityType: "CurrentShow",
    entityId: show.id,
    missingField: "low_confidence",
    severity: "high",
    reason: "Current show confidence is low.",
    when: show.confidenceLevel === "low"
  });
  return flags;
}

export async function syncMissingDataFlags(flags: MissingDataInput[], entityType: string, entityId: string) {
  try {
    await prisma.missingDataFlag.deleteMany({
      where: { entityType, entityId, resolvedAt: null }
    });

    if (!flags.length) return;

    await prisma.missingDataFlag.createMany({
      data: flags.map((flag) => ({
        entityType: flag.entityType,
        entityId: flag.entityId,
        missingField: flag.missingField,
        severity: flag.severity,
        reason: flag.reason
      }))
    });

    await Promise.all(
      flags.map((flag) =>
        triggerMissingDataAlert({
          entityType: flag.entityType,
          entityId: flag.entityId,
          missingField: flag.missingField,
          reason: flag.reason,
          severity: flag.severity
        })
      )
    );
  } catch {
    // Non-blocking quality sync
  }
}

export async function upsertSourceCoverage(args: {
  sourceName: string;
  sourceType: SourceCoverageType;
  baseUrl?: string | null;
  rssUrlsJson?: unknown;
  enabled?: boolean;
  reliabilityScore?: number | null;
  allowedCategories?: string | null;
  blockedKeywords?: string | null;
  preferredKeywords?: string | null;
  checkedAt?: Date;
  successAt?: Date | null;
  articlesFetchedLastRun?: number;
  articlesSavedLastRun?: number;
  articlesExcludedLastRun?: number;
  highRelevanceCountLastRun?: number;
  mediumRelevanceCountLastRun?: number;
  lowRelevanceCountLastRun?: number;
  commonExclusionReasons?: string | null;
  incrementFailures?: boolean;
  sourceReliability?: string | null;
  notes?: string | null;
}) {
  try {
    const existing = await prisma.sourceCoverage.findUnique({
      where: {
        sourceName_sourceType: {
          sourceName: args.sourceName,
          sourceType: args.sourceType
        }
      }
    });

    await prisma.sourceCoverage.upsert({
      where: {
        sourceName_sourceType: {
          sourceName: args.sourceName,
          sourceType: args.sourceType
        }
      },
      update: {
        baseUrl: args.baseUrl ?? existing?.baseUrl ?? null,
        rssUrlsJson: args.rssUrlsJson !== undefined ? toJsonValue(args.rssUrlsJson) : existing?.rssUrlsJson ?? undefined,
        enabled: args.enabled ?? existing?.enabled ?? true,
        reliabilityScore: args.reliabilityScore ?? existing?.reliabilityScore ?? null,
        allowedCategories: args.allowedCategories ?? existing?.allowedCategories ?? null,
        blockedKeywords: args.blockedKeywords ?? existing?.blockedKeywords ?? null,
        preferredKeywords: args.preferredKeywords ?? existing?.preferredKeywords ?? null,
        lastCheckedAt: args.checkedAt ?? existing?.lastCheckedAt ?? null,
        lastSuccessfulFetchAt: args.successAt ?? existing?.lastSuccessfulFetchAt ?? null,
        articlesFetchedLastRun: args.articlesFetchedLastRun ?? existing?.articlesFetchedLastRun ?? 0,
        articlesSavedLastRun: args.articlesSavedLastRun ?? existing?.articlesSavedLastRun ?? 0,
        articlesExcludedLastRun: args.articlesExcludedLastRun ?? existing?.articlesExcludedLastRun ?? 0,
        highRelevanceCountLastRun: args.highRelevanceCountLastRun ?? existing?.highRelevanceCountLastRun ?? 0,
        mediumRelevanceCountLastRun: args.mediumRelevanceCountLastRun ?? existing?.mediumRelevanceCountLastRun ?? 0,
        lowRelevanceCountLastRun: args.lowRelevanceCountLastRun ?? existing?.lowRelevanceCountLastRun ?? 0,
        commonExclusionReasons: args.commonExclusionReasons ?? existing?.commonExclusionReasons ?? null,
        failuresLast7Days: args.incrementFailures ? (existing?.failuresLast7Days ?? 0) + 1 : existing?.failuresLast7Days ?? 0,
        sourceReliability: args.sourceReliability ?? existing?.sourceReliability ?? null,
        notes: args.notes ?? existing?.notes ?? null
      },
      create: {
        sourceName: args.sourceName,
        sourceType: args.sourceType,
        baseUrl: args.baseUrl ?? null,
        rssUrlsJson: toJsonValue(args.rssUrlsJson),
        enabled: args.enabled ?? true,
        reliabilityScore: args.reliabilityScore ?? null,
        allowedCategories: args.allowedCategories ?? null,
        blockedKeywords: args.blockedKeywords ?? null,
        preferredKeywords: args.preferredKeywords ?? null,
        lastCheckedAt: args.checkedAt ?? null,
        lastSuccessfulFetchAt: args.successAt ?? null,
        articlesFetchedLastRun: args.articlesFetchedLastRun ?? 0,
        articlesSavedLastRun: args.articlesSavedLastRun ?? 0,
        articlesExcludedLastRun: args.articlesExcludedLastRun ?? 0,
        highRelevanceCountLastRun: args.highRelevanceCountLastRun ?? 0,
        mediumRelevanceCountLastRun: args.mediumRelevanceCountLastRun ?? 0,
        lowRelevanceCountLastRun: args.lowRelevanceCountLastRun ?? 0,
        commonExclusionReasons: args.commonExclusionReasons ?? null,
        failuresLast7Days: args.incrementFailures ? 1 : 0,
        sourceReliability: args.sourceReliability ?? null,
        notes: args.notes ?? null
      }
    });
  } catch {
    // Non-blocking coverage sync
  }
}

export async function refreshAllMissingDataFlags() {
  try {
    const [articles, projects, shows] = await Promise.all([
      prisma.article.findMany({
        select: {
          id: true,
          url: true,
          extractedText: true,
          extractedExcerpt: true,
          extractedBuyer: true,
          extractedStudio: true,
          extractionSource: true,
          extractionConfidence: true,
          confidenceScore: true
        }
      }),
      prisma.project.findMany({
        include: {
          productionCompanies: { select: { id: true } }
        }
      }),
      prisma.currentShow.findMany({
        select: {
          id: true,
          premiereDate: true,
          sourceUrl: true,
          confidenceLevel: true,
          productionCompanies: true
        }
      })
    ]);

    for (const article of articles) {
      await syncMissingDataFlags(detectArticleMissingData(article), "Article", article.id);
    }
    for (const project of projects) {
      await syncMissingDataFlags(
        detectProjectMissingData({
          id: project.id,
          buyerId: project.buyerId,
          networkOrPlatform: project.networkOrPlatform,
          studioId: project.studioId,
          sourceUrl: project.sourceUrl,
          confidenceLevel: project.confidenceLevel,
          productionCompanies: project.productionCompanies
        }),
        "Project",
        project.id
      );
    }
    for (const show of shows) {
      await syncMissingDataFlags(detectCurrentShowMissingData(show), "CurrentShow", show.id);
    }
  } catch {
    // Non-blocking refresh
  }
}
