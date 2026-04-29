"use server";

import { revalidatePath } from "next/cache";
import { recordAuditLog } from "@/lib/audit";
import { createBackfillJobs, runNextBackfillJob } from "@/lib/backfill";
import { logOperationalEvent } from "@/lib/ops-log";
import { requireAdminCapabilityAccess } from "@/lib/team-auth";

export async function queueBackfillJobs(formData: FormData) {
  await requireAdminCapabilityAccess();
  const source = String(formData.get("source") ?? "").trim();
  const startMonth = String(formData.get("startMonth") ?? "").trim();
  const endMonth = String(formData.get("endMonth") ?? "").trim();
  const keywordSetId = String(formData.get("keywordSetId") ?? "").trim() || undefined;
  const keywords = String(formData.get("keywords") ?? "").trim() || undefined;
  const category = String(formData.get("category") ?? "").trim() || undefined;

  if (!source || !startMonth || !endMonth) return;

  await createBackfillJobs({
    source,
    startMonth,
    endMonth,
    keywordSetId,
    keywords,
    category
  });

  await recordAuditLog({
    entityType: "Article",
    entityId: `backfill-queue-${source}-${startMonth}-${endMonth}`,
    action: "imported",
    newValueJson: { source, startMonth, endMonth, keywordSetId, keywords, category },
    reason: "Backfill jobs queued.",
    source: "backfill_queue"
  });

  revalidatePath("/sources");
  revalidatePath("/sources/backfill");
  revalidatePath("/admin/status");
}

export async function runNextBackfillJobAction() {
  await requireAdminCapabilityAccess();
  const summary = await runNextBackfillJob("auto");
  await recordAuditLog({
    entityType: "Article",
    entityId: `backfill-run-${summary.source ?? "unknown"}-${summary.year ?? "na"}-${summary.month ?? "na"}`,
    action: "imported",
    newValueJson: summary,
    reason: "Backfill batch processed.",
    source: "backfill"
  });
  if (summary.status === "failed") {
    logOperationalEvent("warn", "Backfill job run failed.", {
      source: summary.source ?? "unknown",
      month: summary.month ?? null,
      year: summary.year ?? null
    });
  }
  revalidatePath("/sources");
  revalidatePath("/sources/backfill");
  revalidatePath("/review");
  revalidatePath("/admin/status");
}
