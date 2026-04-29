"use server";

import { revalidatePath } from "next/cache";
import { requireAdminActionAccess } from "@/lib/admin-auth";
import { createBackfillJobs, runNextBackfillJob } from "@/lib/backfill";
import { logOperationalEvent } from "@/lib/ops-log";

export async function queueBackfillJobs(formData: FormData) {
  await requireAdminActionAccess();
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

  revalidatePath("/sources");
  revalidatePath("/sources/backfill");
  revalidatePath("/admin/status");
}

export async function runNextBackfillJobAction() {
  await requireAdminActionAccess();
  const summary = await runNextBackfillJob("auto");
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
