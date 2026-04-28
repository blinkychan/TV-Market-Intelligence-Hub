"use server";

import { revalidatePath } from "next/cache";
import { createBackfillJobs, runNextBackfillJob } from "@/lib/backfill";

export async function queueBackfillJobs(formData: FormData) {
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
}

export async function runNextBackfillJobAction() {
  await runNextBackfillJob("auto");
  revalidatePath("/sources");
  revalidatePath("/sources/backfill");
  revalidatePath("/review");
}
