"use server";

import { revalidatePath } from "next/cache";
import { recordAuditLog } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import { requireEditorActionAccess } from "@/lib/team-auth";

export async function markMissingDataFlagResolved(formData: FormData) {
  await requireEditorActionAccess();
  const id = String(formData.get("id") ?? "").trim();
  if (!id) return;

  const previous = await prisma.missingDataFlag.findUnique({ where: { id } }).catch(() => null);
  const updated = await prisma.missingDataFlag.update({
    where: { id },
    data: { resolvedAt: new Date() }
  }).catch(() => null);

  if (updated) {
    await recordAuditLog({
      entityType: updated.entityType as "Article" | "Project" | "CurrentShow" | "Buyer" | "Company" | "Person",
      entityId: updated.entityId,
      action: "updated",
      previousValueJson: previous,
      newValueJson: updated,
      reason: `Missing data flag resolved: ${updated.missingField}.`,
      source: "missing_data_monitor"
    });
  }

  revalidatePath("/sources/missing-data");
  revalidatePath("/review");
  revalidatePath("/development");
  revalidatePath("/current-tv");
}
