"use server";

import { revalidatePath } from "next/cache";
import { runNextBackfillJob } from "@/lib/backfill";
import { sendHighSeverityAlertDigest, sendScheduledWeeklyReport } from "@/lib/email-jobs";
import { cancelJobRun, getJobRunById, withControlledJob } from "@/lib/job-control";
import { ingestRSSFeeds } from "@/lib/rss-ingestion";
import { fetchArticleBodyAction, runAiExtractionAction } from "@/app/review/actions";
import { requireAdminCapabilityAccess } from "@/lib/team-auth";

export async function cancelJobAction(formData: FormData) {
  await requireAdminCapabilityAccess();
  const jobId = String(formData.get("jobId") ?? "").trim();
  if (!jobId) return;

  await cancelJobRun(jobId);
  revalidatePath("/admin/jobs");
}

export async function rerunJobAction(formData: FormData) {
  const auth = await requireAdminCapabilityAccess();
  const jobId = String(formData.get("jobId") ?? "").trim();
  if (!jobId) return;

  const job = await getJobRunById(jobId);
  if (!job) return;

  const input = (job.inputJson ?? null) as Record<string, unknown> | null;

  switch (job.jobType) {
    case "rss_ingestion":
      await withControlledJob({
        jobType: "rss_ingestion",
        createdByUserId: auth.user?.id ?? null,
        createdByEmail: auth.user?.email ?? null,
        inputJson: input ?? { mode: "real" },
        lockKey: `rss-rerun:${job.id}`,
        handler: async () => ingestRSSFeeds((input?.mode as "real" | "mock" | undefined) ?? "real")
      });
      break;
    case "backfill":
      await withControlledJob({
        jobType: "backfill",
        createdByUserId: auth.user?.id ?? null,
        createdByEmail: auth.user?.email ?? null,
        inputJson: input ?? { mode: "auto" },
        lockKey: `backfill-rerun:${job.id}`,
        handler: async () => runNextBackfillJob((input?.mode as "auto" | "mock" | undefined) ?? "auto")
      });
      break;
    case "email_send":
      if (input?.mode === "alert_digest") {
        await withControlledJob({
          jobType: "email_send",
          createdByUserId: auth.user?.id ?? null,
          createdByEmail: auth.user?.email ?? null,
          inputJson: input,
          lockKey: `email-rerun:${job.id}`,
          handler: async () => sendHighSeverityAlertDigest()
        });
      } else {
        await withControlledJob({
          jobType: "email_send",
          createdByUserId: auth.user?.id ?? null,
          createdByEmail: auth.user?.email ?? null,
          inputJson: input,
          lockKey: `email-rerun:${job.id}`,
          handler: async () => sendScheduledWeeklyReport()
        });
      }
      break;
    case "body_extraction": {
      const articleId = String(input?.articleId ?? "").trim();
      if (!articleId) break;
      const retryForm = new FormData();
      retryForm.set("articleId", articleId);
      await fetchArticleBodyAction(retryForm);
      break;
    }
    case "ai_extraction": {
      const articleId = String(input?.articleId ?? "").trim();
      if (!articleId) break;
      const retryForm = new FormData();
      retryForm.set("articleId", articleId);
      retryForm.set("force", "true");
      await runAiExtractionAction(retryForm);
      break;
    }
    default:
      break;
  }

  revalidatePath("/admin/jobs");
  revalidatePath("/admin/status");
}
