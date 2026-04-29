"use server";

import { revalidatePath } from "next/cache";
import type { DuplicateStatus } from "@prisma/client";
import { recordAuditLog } from "@/lib/audit";
import { logOperationalEvent } from "@/lib/ops-log";
import { prisma } from "@/lib/prisma";
import { requireEditorActionAccess } from "@/lib/team-auth";

type MergeEntityType = "article" | "project" | "current_show" | "buyer" | "company" | "person";

function parseIds(formData: FormData) {
  return String(formData.get("recordIds") ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
}

function appendNote(existing: string | null | undefined, addition: string) {
  if (!existing) return addition;
  if (existing.includes(addition)) return existing;
  return `${existing}\n\n${addition}`;
}

function parseSelection(formData: FormData, field: string) {
  const value = String(formData.get(field) ?? "").trim();
  return value || null;
}

async function markRows(
  entityType: MergeEntityType,
  ids: string[],
  data: {
    duplicateGroupId?: string | null;
    duplicateConfidence?: number | null;
    possibleDuplicateOfId?: string | null;
    duplicateStatus?: DuplicateStatus;
    notes?: string | null;
    extractedDeduplicationNotes?: string | null;
  }
) {
  switch (entityType) {
    case "article":
      await prisma.article.updateMany({
        where: { id: { in: ids } },
        data: {
          duplicateGroupId: data.duplicateGroupId ?? null,
          duplicateConfidence: data.duplicateConfidence ?? null,
          possibleDuplicateOfId: data.possibleDuplicateOfId ?? null,
          duplicateStatus: data.duplicateStatus,
          extractedDeduplicationNotes: data.extractedDeduplicationNotes ?? undefined
        }
      });
      return;
    case "project":
      await prisma.project.updateMany({
        where: { id: { in: ids } },
        data: {
          duplicateGroupId: data.duplicateGroupId ?? null,
          duplicateConfidence: data.duplicateConfidence ?? null,
          possibleDuplicateOfId: data.possibleDuplicateOfId ?? null,
          duplicateStatus: data.duplicateStatus,
          notes: data.notes ?? undefined
        }
      });
      return;
    case "current_show":
      await prisma.currentShow.updateMany({
        where: { id: { in: ids } },
        data: {
          duplicateGroupId: data.duplicateGroupId ?? null,
          duplicateConfidence: data.duplicateConfidence ?? null,
          possibleDuplicateOfId: data.possibleDuplicateOfId ?? null,
          duplicateStatus: data.duplicateStatus,
          notes: data.notes ?? undefined
        }
      });
      return;
    case "buyer":
      await prisma.buyer.updateMany({
        where: { id: { in: ids } },
        data: {
          duplicateGroupId: data.duplicateGroupId ?? null,
          duplicateConfidence: data.duplicateConfidence ?? null,
          possibleDuplicateOfId: data.possibleDuplicateOfId ?? null,
          duplicateStatus: data.duplicateStatus,
          notes: data.notes ?? undefined
        }
      });
      return;
    case "company":
      await prisma.company.updateMany({
        where: { id: { in: ids } },
        data: {
          duplicateGroupId: data.duplicateGroupId ?? null,
          duplicateConfidence: data.duplicateConfidence ?? null,
          possibleDuplicateOfId: data.possibleDuplicateOfId ?? null,
          duplicateStatus: data.duplicateStatus,
          notes: data.notes ?? undefined
        }
      });
      return;
    case "person":
      await prisma.person.updateMany({
        where: { id: { in: ids } },
        data: {
          duplicateGroupId: data.duplicateGroupId ?? null,
          duplicateConfidence: data.duplicateConfidence ?? null,
          possibleDuplicateOfId: data.possibleDuplicateOfId ?? null,
          duplicateStatus: data.duplicateStatus,
          notes: data.notes ?? undefined
        }
      });
  }
}

export async function markDuplicateGroupNotDuplicateAction(formData: FormData) {
  await requireEditorActionAccess();
  const entityType = String(formData.get("entityType") ?? "") as MergeEntityType;
  const ids = parseIds(formData);
  if (!entityType || !ids.length) return;

  await markRows(entityType, ids, {
    duplicateGroupId: null,
    duplicateConfidence: null,
    possibleDuplicateOfId: null,
    duplicateStatus: "not_duplicate",
    notes: "Marked not duplicate during duplicate review."
  }).catch(() => {});

  logOperationalEvent("info", "Duplicate group marked not duplicate.", { entityType, ids });
  revalidatePath("/duplicates");
  revalidatePath("/review");
}

export async function mergeDuplicateGroupAction(formData: FormData) {
  await requireEditorActionAccess();
  const entityType = String(formData.get("entityType") ?? "") as MergeEntityType;
  const groupId = String(formData.get("groupId") ?? "").trim();
  const winnerId = String(formData.get("winnerId") ?? "").trim();
  const keepLabelFromId = parseSelection(formData, "keepLabelFromId");
  const keepAliasesFromId = parseSelection(formData, "keepAliasesFromId");
  const keepNotesFromId = parseSelection(formData, "keepNotesFromId");
  const ids = parseIds(formData);

  if (!entityType || !winnerId || ids.length < 2) return;

  const loserIds = ids.filter((id) => id !== winnerId);
  const mergedAt = new Date();

  if (entityType === "article") {
    const records = await prisma.article.findMany({ where: { id: { in: ids } } }).catch(() => []);
    const winner = records.find((record) => record.id === winnerId);
    if (!winner) return;

    const labelSource = records.find((record) => record.id === keepLabelFromId) ?? winner;
    const aliasesSource = records.find((record) => record.id === keepAliasesFromId) ?? winner;
    const notesSource = records.find((record) => record.id === keepNotesFromId) ?? winner;
    const sourceUrls = records.map((record) => record.url).filter(Boolean).join(", ");
    const mergeNote = `Merged duplicate articles on ${mergedAt.toISOString()}. Preserved source URLs: ${sourceUrls}.`;

    await prisma.article.update({
      where: { id: winner.id },
      data: {
        headline: labelSource.headline,
        aliases: aliasesSource.aliases ?? winner.aliases,
        linkedProjectId: winner.linkedProjectId ?? records.find((record) => record.linkedProjectId)?.linkedProjectId ?? null,
        linkedShowId: winner.linkedShowId ?? records.find((record) => record.linkedShowId)?.linkedShowId ?? null,
        duplicateGroupId: groupId || winner.duplicateGroupId,
        duplicateConfidence: Math.max(...records.map((record) => record.duplicateConfidence ?? record.confidenceScore ?? 0)),
        possibleDuplicateOfId: null,
        duplicateStatus: "not_duplicate",
        extractedDeduplicationNotes: appendNote(notesSource.extractedDeduplicationNotes, mergeNote)
      }
    });

    await prisma.article.updateMany({
      where: { id: { in: loserIds } },
      data: {
        duplicateGroupId: groupId || winner.duplicateGroupId,
        duplicateConfidence: winner.duplicateConfidence ?? winner.confidenceScore ?? 0.85,
        possibleDuplicateOfId: winner.id,
        duplicateStatus: "merged",
        extractedDeduplicationNotes: mergeNote,
        needsReview: false
      }
    });
    await recordAuditLog({
      entityType: "Article",
      entityId: winner.id,
      action: "merged",
      previousValueJson: records,
      newValueJson: { winnerId: winner.id, loserIds, groupId },
      reason: "Duplicate article group merged.",
      source: "duplicate_review"
    });
  }

  if (entityType === "project") {
    const records = await prisma.project.findMany({
      where: { id: { in: ids } },
      include: { people: { select: { id: true } }, productionCompanies: { select: { id: true } } }
    }).catch(() => []);
    const winner = records.find((record) => record.id === winnerId);
    if (!winner) return;

    const labelSource = records.find((record) => record.id === keepLabelFromId) ?? winner;
    const aliasesSource = records.find((record) => record.id === keepAliasesFromId) ?? winner;
    const notesSource = records.find((record) => record.id === keepNotesFromId) ?? winner;
    const allCompanyIds = Array.from(new Set(records.flatMap((record) => record.productionCompanies.map((company) => company.id))));
    const allPersonIds = Array.from(new Set(records.flatMap((record) => record.people.map((person) => person.id))));
    const mergeNote = `Merged duplicate projects on ${mergedAt.toISOString()}. Source URLs: ${records.map((record) => record.sourceUrl).filter(Boolean).join(", ")}.`;

    await prisma.project.update({
      where: { id: winner.id },
      data: {
        title: labelSource.title,
        aliases: aliasesSource.aliases ?? winner.aliases,
        buyerId: winner.buyerId ?? records.find((record) => record.buyerId)?.buyerId ?? null,
        networkOrPlatform: winner.networkOrPlatform ?? records.find((record) => record.networkOrPlatform)?.networkOrPlatform ?? null,
        studioId: winner.studioId ?? records.find((record) => record.studioId)?.studioId ?? null,
        announcementDate: winner.announcementDate ?? records.find((record) => record.announcementDate)?.announcementDate ?? null,
        premiereDate: winner.premiereDate ?? records.find((record) => record.premiereDate)?.premiereDate ?? null,
        sourceUrl: winner.sourceUrl ?? records.find((record) => record.sourceUrl)?.sourceUrl ?? null,
        confidenceScore: Math.max(...records.map((record) => record.confidenceScore)),
        duplicateGroupId: groupId || winner.duplicateGroupId,
        duplicateConfidence: Math.max(...records.map((record) => record.duplicateConfidence ?? record.confidenceScore)),
        possibleDuplicateOfId: null,
        duplicateStatus: "not_duplicate",
        notes: appendNote(notesSource.notes, mergeNote),
        productionCompanies: { connect: allCompanyIds.map((id) => ({ id })) },
        people: { connect: allPersonIds.map((id) => ({ id })) }
      }
    });

    await prisma.article.updateMany({
      where: { linkedProjectId: { in: loserIds } },
      data: { linkedProjectId: winner.id }
    });
    await prisma.relationship.updateMany({
      where: { projectId: { in: loserIds } },
      data: { projectId: winner.id }
    });
    await prisma.project.updateMany({
      where: { id: { in: loserIds } },
      data: {
        duplicateGroupId: groupId || winner.duplicateGroupId,
        duplicateConfidence: winner.duplicateConfidence ?? winner.confidenceScore,
        possibleDuplicateOfId: winner.id,
        duplicateStatus: "merged",
        notes: mergeNote
      }
    });
    await recordAuditLog({
      entityType: "Project",
      entityId: winner.id,
      action: "merged",
      previousValueJson: records,
      newValueJson: { winnerId: winner.id, loserIds, groupId },
      reason: "Duplicate project group merged.",
      source: "duplicate_review"
    });
  }

  if (entityType === "current_show") {
    const records = await prisma.currentShow.findMany({ where: { id: { in: ids } } }).catch(() => []);
    const winner = records.find((record) => record.id === winnerId);
    if (!winner) return;

    const labelSource = records.find((record) => record.id === keepLabelFromId) ?? winner;
    const aliasesSource = records.find((record) => record.id === keepAliasesFromId) ?? winner;
    const notesSource = records.find((record) => record.id === keepNotesFromId) ?? winner;
    const mergeNote = `Merged duplicate current-show records on ${mergedAt.toISOString()}. Source URLs: ${records.map((record) => record.sourceUrl).filter(Boolean).join(", ")}.`;

    await prisma.currentShow.update({
      where: { id: winner.id },
      data: {
        title: labelSource.title,
        aliases: aliasesSource.aliases ?? winner.aliases,
        networkOrPlatform: winner.networkOrPlatform || records.find((record) => record.networkOrPlatform)?.networkOrPlatform || "Unknown",
        premiereDate: winner.premiereDate ?? records.find((record) => record.premiereDate)?.premiereDate ?? null,
        finaleDate: winner.finaleDate ?? records.find((record) => record.finaleDate)?.finaleDate ?? null,
        studio: winner.studio ?? records.find((record) => record.studio)?.studio ?? null,
        productionCompanies: winner.productionCompanies ?? records.find((record) => record.productionCompanies)?.productionCompanies ?? null,
        sourceUrl: winner.sourceUrl ?? records.find((record) => record.sourceUrl)?.sourceUrl ?? null,
        duplicateGroupId: groupId || winner.duplicateGroupId,
        duplicateConfidence: Math.max(...records.map((record) => record.duplicateConfidence ?? 0)),
        possibleDuplicateOfId: null,
        duplicateStatus: "not_duplicate",
        notes: appendNote(notesSource.notes, mergeNote)
      }
    });

    await prisma.article.updateMany({
      where: { linkedShowId: { in: loserIds } },
      data: { linkedShowId: winner.id }
    });
    await prisma.currentShow.updateMany({
      where: { id: { in: loserIds } },
      data: {
        duplicateGroupId: groupId || winner.duplicateGroupId,
        duplicateConfidence: winner.duplicateConfidence ?? 0.85,
        possibleDuplicateOfId: winner.id,
        duplicateStatus: "merged",
        notes: mergeNote
      }
    });
    await recordAuditLog({
      entityType: "CurrentShow",
      entityId: winner.id,
      action: "merged",
      previousValueJson: records,
      newValueJson: { winnerId: winner.id, loserIds, groupId },
      reason: "Duplicate current-show group merged.",
      source: "duplicate_review"
    });
  }

  if (entityType === "buyer") {
    const records = await prisma.buyer.findMany({ where: { id: { in: ids } } }).catch(() => []);
    const winner = records.find((record) => record.id === winnerId);
    if (!winner) return;
    const labelSource = records.find((record) => record.id === keepLabelFromId) ?? winner;
    const aliasesSource = records.find((record) => record.id === keepAliasesFromId) ?? winner;
    const notesSource = records.find((record) => record.id === keepNotesFromId) ?? winner;
    const loserNames = records.filter((record) => record.id !== winner.id).map((record) => record.name);
    const mergeNote = `Merged duplicate buyers on ${mergedAt.toISOString()}. Prior names: ${loserNames.join(", ")}.`;

    await prisma.project.updateMany({ where: { buyerId: { in: loserIds } }, data: { buyerId: winner.id, networkOrPlatform: winner.name } });
    await prisma.relationship.updateMany({ where: { buyerId: { in: loserIds } }, data: { buyerId: winner.id } });
    await prisma.currentShow.updateMany({ where: { networkOrPlatform: { in: loserNames } }, data: { networkOrPlatform: winner.name } });
    await prisma.buyer.update({
      where: { id: winner.id },
      data: {
        name: labelSource.name,
        aliases: aliasesSource.aliases ?? winner.aliases,
        parentCompany: winner.parentCompany ?? records.find((record) => record.parentCompany)?.parentCompany ?? null,
        duplicateGroupId: groupId || winner.duplicateGroupId,
        duplicateConfidence: Math.max(...records.map((record) => record.duplicateConfidence ?? 0)),
        possibleDuplicateOfId: null,
        duplicateStatus: "not_duplicate",
        notes: appendNote(notesSource.notes, mergeNote)
      }
    });
    await prisma.buyer.updateMany({
      where: { id: { in: loserIds } },
      data: {
        duplicateGroupId: groupId || winner.duplicateGroupId,
        duplicateConfidence: winner.duplicateConfidence ?? 0.85,
        possibleDuplicateOfId: winner.id,
        duplicateStatus: "merged",
        notes: mergeNote
      }
    });
    await recordAuditLog({
      entityType: "Buyer",
      entityId: winner.id,
      action: "merged",
      previousValueJson: records,
      newValueJson: { winnerId: winner.id, loserIds, groupId },
      reason: "Duplicate buyer group merged.",
      source: "duplicate_review"
    });
  }

  if (entityType === "company") {
    const records = await prisma.company.findMany({
      where: { id: { in: ids } },
      include: { productionProjects: { select: { id: true } } }
    }).catch(() => []);
    const winner = records.find((record) => record.id === winnerId);
    if (!winner) return;
    const labelSource = records.find((record) => record.id === keepLabelFromId) ?? winner;
    const aliasesSource = records.find((record) => record.id === keepAliasesFromId) ?? winner;
    const notesSource = records.find((record) => record.id === keepNotesFromId) ?? winner;
    const loserNames = records.filter((record) => record.id !== winner.id).map((record) => record.name);
    const mergeNote = `Merged duplicate companies on ${mergedAt.toISOString()}. Prior names: ${loserNames.join(", ")}.`;

    await prisma.project.updateMany({ where: { studioId: { in: loserIds } }, data: { studioId: winner.id } });
    await prisma.relationship.updateMany({ where: { companyId: { in: loserIds } }, data: { companyId: winner.id } });
    await prisma.currentShow.updateMany({ where: { studio: { in: loserNames } }, data: { studio: winner.name } });
    for (const record of records) {
      for (const project of record.productionProjects) {
        await prisma.project.update({
          where: { id: project.id },
          data: { productionCompanies: { connect: { id: winner.id } } }
        }).catch(() => {});
      }
    }
    await prisma.company.update({
      where: { id: winner.id },
      data: {
        name: labelSource.name,
        aliases: aliasesSource.aliases ?? winner.aliases,
        duplicateGroupId: groupId || winner.duplicateGroupId,
        duplicateConfidence: Math.max(...records.map((record) => record.duplicateConfidence ?? 0)),
        possibleDuplicateOfId: null,
        duplicateStatus: "not_duplicate",
        notes: appendNote(notesSource.notes, mergeNote)
      }
    });
    await prisma.company.updateMany({
      where: { id: { in: loserIds } },
      data: {
        duplicateGroupId: groupId || winner.duplicateGroupId,
        duplicateConfidence: winner.duplicateConfidence ?? 0.85,
        possibleDuplicateOfId: winner.id,
        duplicateStatus: "merged",
        notes: mergeNote
      }
    });
    await recordAuditLog({
      entityType: "Company",
      entityId: winner.id,
      action: "merged",
      previousValueJson: records,
      newValueJson: { winnerId: winner.id, loserIds, groupId },
      reason: "Duplicate company group merged.",
      source: "duplicate_review"
    });
  }

  if (entityType === "person") {
    const records = await prisma.person.findMany({
      where: { id: { in: ids } },
      include: { projects: { select: { id: true } } }
    }).catch(() => []);
    const winner = records.find((record) => record.id === winnerId);
    if (!winner) return;
    const labelSource = records.find((record) => record.id === keepLabelFromId) ?? winner;
    const aliasesSource = records.find((record) => record.id === keepAliasesFromId) ?? winner;
    const notesSource = records.find((record) => record.id === keepNotesFromId) ?? winner;
    const mergeNote = `Merged duplicate people records on ${mergedAt.toISOString()}.`;

    await prisma.relationship.updateMany({ where: { personId: { in: loserIds } }, data: { personId: winner.id } });
    for (const record of records) {
      for (const project of record.projects) {
        await prisma.project.update({
          where: { id: project.id },
          data: { people: { connect: { id: winner.id } } }
        }).catch(() => {});
      }
    }
    await prisma.person.update({
      where: { id: winner.id },
      data: {
        name: labelSource.name,
        aliases: aliasesSource.aliases ?? winner.aliases,
        company: winner.company ?? records.find((record) => record.company)?.company ?? null,
        reps: winner.reps ?? records.find((record) => record.reps)?.reps ?? null,
        duplicateGroupId: groupId || winner.duplicateGroupId,
        duplicateConfidence: Math.max(...records.map((record) => record.duplicateConfidence ?? 0)),
        possibleDuplicateOfId: null,
        duplicateStatus: "not_duplicate",
        notes: appendNote(notesSource.notes, mergeNote)
      }
    });
    await prisma.person.updateMany({
      where: { id: { in: loserIds } },
      data: {
        duplicateGroupId: groupId || winner.duplicateGroupId,
        duplicateConfidence: winner.duplicateConfidence ?? 0.85,
        possibleDuplicateOfId: winner.id,
        duplicateStatus: "merged",
        notes: mergeNote
      }
    });
    await recordAuditLog({
      entityType: "Person",
      entityId: winner.id,
      action: "merged",
      previousValueJson: records,
      newValueJson: { winnerId: winner.id, loserIds, groupId },
      reason: "Duplicate person group merged.",
      source: "duplicate_review"
    });
  }

  logOperationalEvent("info", "Duplicate group merged.", { entityType, groupId, winnerId, loserIds });
  revalidatePath("/duplicates");
  revalidatePath("/review");
  revalidatePath("/development");
  revalidatePath("/current-tv");
  revalidatePath("/buyers");
  revalidatePath("/companies");
}
