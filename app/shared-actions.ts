"use server";

import { revalidatePath } from "next/cache";
import { Prisma, type WatchlistType } from "@prisma/client";
import { recordAuditLog } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import { requireApprovedTeamAccess } from "@/lib/team-auth";
import { saveWatchlist } from "@/lib/watchlists";

function parseJsonValue(raw: string) {
  const trimmed = raw.trim();
  if (!trimmed) return Prisma.JsonNull;
  try {
    return JSON.parse(trimmed) as Prisma.InputJsonValue;
  } catch {
    return trimmed as Prisma.InputJsonValue;
  }
}

function toJsonInput(value: Prisma.JsonValue | null) {
  return value === null ? Prisma.JsonNull : (value as Prisma.InputJsonValue);
}

function parseTags(raw: string) {
  return raw
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean)
    .join(", ");
}

export async function saveSavedViewAction(formData: FormData) {
  const auth = await requireApprovedTeamAccess();
  const id = String(formData.get("id") ?? "").trim();
  const pageType = String(formData.get("pageType") ?? "").trim();
  const name = String(formData.get("name") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim() || null;
  const visibilityInput = String(formData.get("visibility") ?? "private").trim();
  const filtersJson = parseJsonValue(String(formData.get("filtersJson") ?? ""));
  const sortJson = parseJsonValue(String(formData.get("sortJson") ?? ""));
  const columnsJson = parseJsonValue(String(formData.get("columnsJson") ?? ""));
  const returnPath = String(formData.get("returnPath") ?? "/").trim() || "/";

  if (!pageType || !name || !auth.user?.email) return;

  const visibility = auth.canEditContent ? (visibilityInput === "team" ? "team" : "private") : "private";
  const previous = id ? await prisma.savedView.findUnique({ where: { id } }).catch(() => null) : null;

  if (previous && !auth.adminUnlocked && !auth.canManageUsers && previous.createdByEmail !== auth.user.email) {
    return;
  }

  const savedView = previous
    ? await prisma.savedView
        .update({
          where: { id: previous.id },
          data: { name, description, pageType, filtersJson, sortJson, columnsJson, visibility }
        })
        .catch(() => null)
    : await prisma.savedView
        .create({
          data: {
            name,
            description,
            pageType,
            filtersJson,
            sortJson,
            columnsJson,
            visibility,
            createdByUserId: auth.user.id,
            createdByEmail: auth.user.email
          }
        })
        .catch(() => null);

  if (savedView) {
    await recordAuditLog({
      entityType: "SavedView",
      entityId: savedView.id,
      action: previous ? "updated" : "created",
      previousValueJson: previous,
      newValueJson: savedView,
      reason: previous ? "Saved view updated." : "Saved view created.",
      source: `saved_view:${pageType}`
    });
  }

  revalidatePath(returnPath);
}

export async function duplicateSavedViewAction(formData: FormData) {
  const auth = await requireApprovedTeamAccess();
  const id = String(formData.get("id") ?? "").trim();
  const returnPath = String(formData.get("returnPath") ?? "/").trim() || "/";
  if (!id || !auth.user?.email) return;

  const existing = await prisma.savedView.findUnique({ where: { id } }).catch(() => null);
  if (!existing) return;
  if (!auth.adminUnlocked && existing.visibility !== "team" && existing.createdByEmail !== auth.user.email) return;

  const duplicated = await prisma.savedView
    .create({
      data: {
        name: `${existing.name} Copy`,
        description: existing.description,
        pageType: existing.pageType,
        filtersJson: toJsonInput(existing.filtersJson),
        sortJson: toJsonInput(existing.sortJson),
        columnsJson: toJsonInput(existing.columnsJson),
        visibility: "private",
        createdByUserId: auth.user.id,
        createdByEmail: auth.user.email
      }
    })
    .catch(() => null);

  if (duplicated) {
    await recordAuditLog({
      entityType: "SavedView",
      entityId: duplicated.id,
      action: "created",
      previousValueJson: existing,
      newValueJson: duplicated,
      reason: "Saved view duplicated.",
      source: `saved_view:${existing.pageType}`
    });
  }

  revalidatePath(returnPath);
}

export async function deleteSavedViewAction(formData: FormData) {
  const auth = await requireApprovedTeamAccess();
  const id = String(formData.get("id") ?? "").trim();
  const returnPath = String(formData.get("returnPath") ?? "/").trim() || "/";
  if (!id || !auth.user?.email) return;

  const existing = await prisma.savedView.findUnique({ where: { id } }).catch(() => null);
  if (!existing) return;
  if (!auth.adminUnlocked && !auth.canManageUsers && existing.createdByEmail !== auth.user.email) return;

  await prisma.savedView.delete({ where: { id } }).catch(() => null);
  await recordAuditLog({
    entityType: "SavedView",
    entityId: existing.id,
    action: "deleted",
    previousValueJson: existing,
    newValueJson: null,
    reason: "Saved view deleted.",
    source: `saved_view:${existing.pageType}`
  });
  revalidatePath(returnPath);
}

export async function saveTeamNoteAction(formData: FormData) {
  const auth = await requireApprovedTeamAccess();
  const id = String(formData.get("id") ?? "").trim();
  const entityType = String(formData.get("entityType") ?? "").trim();
  const entityId = String(formData.get("entityId") ?? "").trim();
  const note = String(formData.get("note") ?? "").trim();
  const tags = parseTags(String(formData.get("tags") ?? ""));
  const includeInNextWeeklyReport = formData.get("includeInNextWeeklyReport") === "on";
  const returnPath = String(formData.get("returnPath") ?? "/").trim() || "/";

  if (!entityType || !entityId || !note || !auth.user?.email) return;
  const previous = id ? await prisma.teamNote.findUnique({ where: { id } }).catch(() => null) : null;
  if (previous && !auth.adminUnlocked && !auth.canManageUsers && previous.createdByEmail !== auth.user.email) return;

  const saved = previous
    ? await prisma.teamNote
        .update({
          where: { id: previous.id },
          data: { note, tags: tags || null, includeInNextWeeklyReport }
        })
        .catch(() => null)
    : await prisma.teamNote
        .create({
          data: {
            entityType,
            entityId,
            note,
            tags: tags || null,
            includeInNextWeeklyReport,
            createdByUserId: auth.user.id,
            createdByEmail: auth.user.email
          }
        })
        .catch(() => null);

  if (saved) {
    await recordAuditLog({
      entityType: "TeamNote",
      entityId: saved.id,
      action: previous ? "updated" : "created",
      previousValueJson: previous,
      newValueJson: saved,
      reason: previous ? "Team note updated." : "Team note created.",
      source: "team_note"
    });
  }

  revalidatePath(returnPath);
}

export async function deleteTeamNoteAction(formData: FormData) {
  const auth = await requireApprovedTeamAccess();
  const id = String(formData.get("id") ?? "").trim();
  const returnPath = String(formData.get("returnPath") ?? "/").trim() || "/";
  if (!id || !auth.user?.email) return;

  const existing = await prisma.teamNote.findUnique({ where: { id } }).catch(() => null);
  if (!existing) return;
  if (!auth.adminUnlocked && !auth.canManageUsers && existing.createdByEmail !== auth.user.email) return;

  await prisma.teamNote.delete({ where: { id } }).catch(() => null);
  await recordAuditLog({
    entityType: "TeamNote",
    entityId: existing.id,
    action: "deleted",
    previousValueJson: existing,
    newValueJson: null,
    reason: "Team note deleted.",
    source: "team_note"
  });
  revalidatePath(returnPath);
}

export async function saveWatchlistAction(formData: FormData) {
  const auth = await requireApprovedTeamAccess();
  const id = String(formData.get("id") ?? "").trim();
  const name = String(formData.get("name") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim() || null;
  const watchType = String(formData.get("watchType") ?? "").trim();
  const visibilityInput = String(formData.get("visibility") ?? "private").trim();
  const criteriaJson = parseJsonValue(String(formData.get("criteriaJson") ?? ""));
  const returnPath = String(formData.get("returnPath") ?? "/watchlists").trim() || "/watchlists";

  if (!name || !watchType || !auth.user?.email) return;

  const visibility = auth.canManageUsers || auth.adminUnlocked ? (visibilityInput === "team" ? "team" : "private") : "private";
  const previous = id ? await prisma.watchlist.findUnique({ where: { id } }).catch(() => null) : null;

  if (previous) {
    const canEdit = auth.canManageUsers || auth.adminUnlocked || previous.createdByEmail === auth.user.email;
    if (!canEdit) return;
    if (previous.visibility === "team" && !auth.canManageUsers && !auth.adminUnlocked) return;
  }

  const saved = await saveWatchlist({
    id: previous?.id,
    name,
    description,
    watchType: watchType as WatchlistType,
    criteriaJson,
    visibility,
    createdByUserId: auth.user.id,
    createdByEmail: auth.user.email
  }).catch(() => null);

  if (saved) {
    await recordAuditLog({
      entityType: "Watchlist",
      entityId: saved.id,
      action: previous ? "updated" : "created",
      previousValueJson: previous,
      newValueJson: saved,
      reason: previous ? "Watchlist updated." : "Watchlist created.",
      source: "watchlist"
    });
  }

  revalidatePath(returnPath);
  revalidatePath("/watchlists");
  revalidatePath("/alerts");
}

export async function deleteWatchlistAction(formData: FormData) {
  const auth = await requireApprovedTeamAccess();
  const id = String(formData.get("id") ?? "").trim();
  const returnPath = String(formData.get("returnPath") ?? "/watchlists").trim() || "/watchlists";
  if (!id || !auth.user?.email) return;

  const existing = await prisma.watchlist.findUnique({ where: { id } }).catch(() => null);
  if (!existing) return;

  const canDelete = auth.canManageUsers || auth.adminUnlocked || existing.createdByEmail === auth.user.email;
  if (!canDelete) return;
  if (existing.visibility === "team" && !auth.canManageUsers && !auth.adminUnlocked) return;

  await prisma.watchlist.delete({ where: { id } }).catch(() => null);
  await recordAuditLog({
    entityType: "Watchlist",
    entityId: existing.id,
    action: "deleted",
    previousValueJson: existing,
    newValueJson: null,
    reason: "Watchlist deleted.",
    source: "watchlist"
  });

  revalidatePath(returnPath);
  revalidatePath("/watchlists");
  revalidatePath("/alerts");
}

export async function markAlertReadAction(formData: FormData) {
  const auth = await requireApprovedTeamAccess();
  const id = String(formData.get("id") ?? "").trim();
  const isRead = String(formData.get("isRead") ?? "true").trim() === "true";
  const returnPath = String(formData.get("returnPath") ?? "/alerts").trim() || "/alerts";
  if (!id || !auth.user?.email) return;

  const existing = await prisma.alert.findUnique({
    where: { id },
    include: { watchlist: true }
  }).catch(() => null);
  if (!existing) return;

  const canEdit =
    !existing.watchlist ||
    existing.watchlist.visibility === "team" ||
    existing.watchlist.createdByEmail === auth.user.email ||
    auth.canManageUsers ||
    auth.adminUnlocked;
  if (!canEdit) return;

  await prisma.alert.update({ where: { id }, data: { isRead } }).catch(() => null);
  revalidatePath(returnPath);
  revalidatePath("/alerts");
}
