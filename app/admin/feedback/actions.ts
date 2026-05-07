"use server";

import { revalidatePath } from "next/cache";
import { recordAuditLog } from "@/lib/audit";
import { updateFeedback } from "@/lib/feedback";
import { requireAdminCapabilityAccess } from "@/lib/team-auth";

export async function updateFeedbackAction(formData: FormData) {
  await requireAdminCapabilityAccess();
  const id = String(formData.get("id") ?? "").trim();
  if (!id) return;

  const status = String(formData.get("status") ?? "").trim();
  const priority = String(formData.get("priority") ?? "").trim();
  const internalNotes = String(formData.get("internalNotes") ?? "").trim();

  const result = await updateFeedback({
    id,
    status: status ? (status as "new" | "triaged" | "in_progress" | "resolved" | "dismissed") : undefined,
    priority: priority ? (priority as "low" | "medium" | "high") : undefined,
    internalNotes
  });

  if (result) {
    await recordAuditLog({
      entityType: "Feedback",
      entityId: result.updated.id,
      action: "updated",
      previousValueJson: result.existing,
      newValueJson: result.updated,
      reason: "Feedback triage updated.",
      source: "feedback_admin"
    });
  }

  revalidatePath("/admin/feedback");
}

