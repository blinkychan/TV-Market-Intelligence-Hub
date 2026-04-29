"use server";

import { revalidatePath } from "next/cache";
import { CurrentShowSeasonType } from "@prisma/client";
import { recordAuditLog } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import { requireEditorActionAccess } from "@/lib/team-auth";

function parseDate(value: FormDataEntryValue | null) {
  const text = String(value ?? "").trim();
  if (!text) return null;
  const parsed = new Date(text);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function parseOptionalInt(value: FormDataEntryValue | null) {
  const text = String(value ?? "").trim();
  if (!text) return null;
  const parsed = Number.parseInt(text, 10);
  return Number.isNaN(parsed) ? null : parsed;
}

function parseCheckbox(value: FormDataEntryValue | null) {
  return value === "on" || value === "true";
}

function normalizeSeasonType(value: string | null | undefined): CurrentShowSeasonType | null {
  if (!value) return null;
  if (
    value === CurrentShowSeasonType.new_series ||
    value === CurrentShowSeasonType.returning_series ||
    value === CurrentShowSeasonType.limited_series ||
    value === CurrentShowSeasonType.special ||
    value === CurrentShowSeasonType.finale
  ) {
    return value;
  }
  return null;
}

function parseImportedDate(value: string | null | undefined) {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

async function findDuplicateCurrentShow(args: {
  title: string;
  networkOrPlatform: string;
  premiereDate: Date | null;
  excludeId?: string | null;
}) {
  return prisma.currentShow.findFirst({
    where: {
      title: args.title,
      networkOrPlatform: args.networkOrPlatform,
      premiereDate: args.premiereDate,
      ...(args.excludeId ? { id: { not: args.excludeId } } : {})
    },
    select: { id: true }
  }).catch(() => null);
}

export async function saveCurrentShowAction(formData: FormData) {
  await requireEditorActionAccess();

  const id = String(formData.get("id") ?? "").trim();
  const title = String(formData.get("title") ?? "").trim();
  const networkOrPlatform = String(formData.get("networkOrPlatform") ?? "").trim();
  if (!title || !networkOrPlatform) return;

  const data = {
    title,
    networkOrPlatform,
    premiereDate: parseDate(formData.get("premiereDate")),
    finaleDate: parseDate(formData.get("finaleDate")),
    seasonNumber: parseOptionalInt(formData.get("seasonNumber")),
    episodeCount: parseOptionalInt(formData.get("episodeCount")),
    status: String(formData.get("status") ?? "").trim() || "premiering soon",
    genre: String(formData.get("genre") ?? "").trim() || null,
    studio: String(formData.get("studio") ?? "").trim() || null,
    productionCompanies: String(formData.get("productionCompanies") ?? "").trim() || null,
    country: String(formData.get("country") ?? "").trim() || null,
    sourceType: String(formData.get("sourceType") ?? "").trim() || null,
    sourceReliability: String(formData.get("sourceReliability") ?? "").trim() || null,
    seasonType: normalizeSeasonType(String(formData.get("seasonType") ?? "").trim() || null),
    premiereTime: String(formData.get("premiereTime") ?? "").trim() || null,
    episodeTitle: String(formData.get("episodeTitle") ?? "").trim() || null,
    episodeNumber: parseOptionalInt(formData.get("episodeNumber")),
    airPattern: String(formData.get("airPattern") ?? "").trim() || null,
    sourceUrl: String(formData.get("sourceUrl") ?? "").trim() || null,
    notes: String(formData.get("notes") ?? "").trim() || null,
    needsVerification: parseCheckbox(formData.get("needsVerification")),
    verifiedAt: parseDate(formData.get("verifiedAt"))
  };

  const duplicate = await findDuplicateCurrentShow({
    title: data.title,
    networkOrPlatform: data.networkOrPlatform,
    premiereDate: data.premiereDate,
    excludeId: id || null
  });
  if (duplicate) return;

  if (id) {
    const previous = await prisma.currentShow.findUnique({ where: { id } }).catch(() => null);
    const updated = await prisma.currentShow.update({ where: { id }, data }).catch(() => null);
    if (updated) {
      await recordAuditLog({
        entityType: "CurrentShow",
        entityId: updated.id,
        action: "updated",
        previousValueJson: previous,
        newValueJson: updated,
        reason: "Current show details edited.",
        source: "current_tv_tracker"
      });
    }
  } else {
    const created = await prisma.currentShow.create({ data }).catch(() => null);
    if (created) {
      await recordAuditLog({
        entityType: "CurrentShow",
        entityId: created.id,
        action: "created",
        previousValueJson: null,
        newValueJson: created,
        reason: "Manual current show entry created.",
        source: "current_tv_tracker"
      });
    }
  }

  revalidatePath("/current-tv");
  revalidatePath("/weekly-reports");
}

export async function markPremiereVerifiedAction(formData: FormData) {
  await requireEditorActionAccess();
  const id = String(formData.get("id") ?? "").trim();
  if (!id) return;

  const previous = await prisma.currentShow.findUnique({ where: { id } }).catch(() => null);
  const updated = await prisma.currentShow.update({
    where: { id },
    data: {
      verifiedAt: new Date(),
      needsVerification: false
    }
  }).catch(() => null);

  if (updated) {
    await recordAuditLog({
      entityType: "CurrentShow",
      entityId: updated.id,
      action: "verified",
      previousValueJson: previous,
      newValueJson: updated,
      reason: "Premiere date marked verified.",
      source: "current_tv_tracker"
    });
  }

  revalidatePath("/current-tv");
  revalidatePath("/weekly-reports");
}

export async function flagPremiereConflictAction(formData: FormData) {
  await requireEditorActionAccess();
  const id = String(formData.get("id") ?? "").trim();
  const note = String(formData.get("conflictNote") ?? "").trim();
  if (!id) return;

  const existing = await prisma.currentShow.findUnique({ where: { id }, select: { notes: true } }).catch(() => null);
  const mergedNote = [existing?.notes, note ? `Verification conflict: ${note}` : "Verification conflict flagged."]
    .filter(Boolean)
    .join("\n");

  const previous = await prisma.currentShow.findUnique({ where: { id } }).catch(() => null);
  const updated = await prisma.currentShow.update({
    where: { id },
    data: {
      needsVerification: true,
      notes: mergedNote
    }
  }).catch(() => null);

  if (updated) {
    await recordAuditLog({
      entityType: "CurrentShow",
      entityId: updated.id,
      action: "updated",
      previousValueJson: previous,
      newValueJson: updated,
      reason: note ? `Premiere conflict flagged: ${note}` : "Premiere conflict flagged.",
      source: "current_tv_tracker"
    });
  }

  revalidatePath("/current-tv");
  revalidatePath("/weekly-reports");
}

type ImportedCurrentShowRow = {
  title: string;
  networkOrPlatform: string;
  premiereDate?: string | null;
  finaleDate?: string | null;
  seasonNumber?: string | number | null;
  episodeCount?: string | number | null;
  status?: string | null;
  genre?: string | null;
  studio?: string | null;
  productionCompanies?: string | null;
  country?: string | null;
  sourceType?: string | null;
  sourceReliability?: string | null;
  seasonType?: string | null;
  premiereTime?: string | null;
  episodeTitle?: string | null;
  episodeNumber?: string | number | null;
  airPattern?: string | null;
  sourceUrl?: string | null;
  notes?: string | null;
};

export async function importCurrentShowsCsvAction(formData: FormData) {
  await requireEditorActionAccess();
  const rowsJson = String(formData.get("rowsJson") ?? "").trim();
  if (!rowsJson) return;

  let rows: ImportedCurrentShowRow[] = [];
  try {
    rows = JSON.parse(rowsJson) as ImportedCurrentShowRow[];
  } catch {
    return;
  }

  for (const row of rows) {
    const title = String(row.title ?? "").trim();
    const networkOrPlatform = String(row.networkOrPlatform ?? "").trim();
    if (!title || !networkOrPlatform) continue;

    const safePremiereDate = parseImportedDate(row.premiereDate ?? null);
    const duplicate = await findDuplicateCurrentShow({ title, networkOrPlatform, premiereDate: safePremiereDate });
    if (duplicate) continue;

    const created = await prisma.currentShow.create({
      data: {
        title,
        networkOrPlatform,
        premiereDate: safePremiereDate,
        finaleDate: parseImportedDate(row.finaleDate ?? null),
        seasonNumber: row.seasonNumber == null || row.seasonNumber === "" ? null : Number(row.seasonNumber),
        episodeCount: row.episodeCount == null || row.episodeCount === "" ? null : Number(row.episodeCount),
        status: String(row.status ?? "").trim() || "premiering soon",
        genre: String(row.genre ?? "").trim() || null,
        studio: String(row.studio ?? "").trim() || null,
        productionCompanies: String(row.productionCompanies ?? "").trim() || null,
        country: String(row.country ?? "").trim() || null,
        sourceType: String(row.sourceType ?? "").trim() || "manual_csv",
        sourceReliability: String(row.sourceReliability ?? "").trim() || "high",
        seasonType: normalizeSeasonType(String(row.seasonType ?? "").trim() || null),
        premiereTime: String(row.premiereTime ?? "").trim() || null,
        episodeTitle: String(row.episodeTitle ?? "").trim() || null,
        episodeNumber: row.episodeNumber == null || row.episodeNumber === "" ? null : Number(row.episodeNumber),
        airPattern: String(row.airPattern ?? "").trim() || null,
        verifiedAt: new Date(),
        needsVerification: false,
        sourceUrl: String(row.sourceUrl ?? "").trim() || null,
        notes: String(row.notes ?? "").trim() || "Imported from CSV."
      }
    }).catch(() => null);

    if (created) {
      await recordAuditLog({
        entityType: "CurrentShow",
        entityId: created.id,
        action: "imported",
        previousValueJson: null,
        newValueJson: created,
        reason: "Imported from Current TV CSV flow.",
        source: "current_tv_csv"
      });
    }
  }

  revalidatePath("/current-tv");
  revalidatePath("/weekly-reports");
}
