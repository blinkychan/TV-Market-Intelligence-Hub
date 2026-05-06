"use server";

import { redirect } from "next/navigation";
import { recordAuditLog } from "@/lib/audit";
import { sendHighSeverityAlertDigest, sendScheduledWeeklyReport, sendTestEmailForCurrentUser, summarizeEmailRun } from "@/lib/email-jobs";
import { upsertEmailPreference } from "@/lib/email-preferences";
import { withControlledJob } from "@/lib/job-control";
import { requireAdminCapabilityAccess, requireApprovedTeamAccess } from "@/lib/team-auth";

function parseBool(value: FormDataEntryValue | null) {
  return value === "on" || value === "true";
}

export async function saveEmailPreferenceAction(formData: FormData) {
  const auth = await requireApprovedTeamAccess();
  const email = auth.user?.email?.trim();
  if (!email) {
    redirect("/settings/notifications?error=missing_email");
  }

  const saved = await upsertEmailPreference({
    userId: auth.user?.id ?? null,
    email,
    receiveWeeklyReport: parseBool(formData.get("receiveWeeklyReport")),
    receiveHighSeverityAlerts: parseBool(formData.get("receiveHighSeverityAlerts")),
    receiveWatchlistAlerts: parseBool(formData.get("receiveWatchlistAlerts")),
    weeklyReportDay: String(formData.get("weeklyReportDay") ?? "friday").trim().toLowerCase(),
    weeklyReportTime: String(formData.get("weeklyReportTime") ?? "09:00").trim() || "09:00"
  });

  await recordAuditLog({
    entityType: "EmailPreference",
    entityId: saved.id,
    action: "updated",
    newValueJson: saved,
    reason: "Email preferences updated.",
    source: "email_preferences"
  });

  redirect("/settings/notifications?saved=1");
}

export async function sendTestEmailAction() {
  const auth = await requireApprovedTeamAccess();
  const email = auth.user?.email?.trim();
  if (!email) {
    redirect("/settings/notifications?error=missing_email");
  }

  const result = await withControlledJob({
    jobType: "email_send",
    createdByUserId: auth.user?.id ?? null,
    createdByEmail: auth.user?.email ?? null,
    inputJson: { mode: "test", email },
    lockKey: `email-test:${email}`,
    dedupeMinutes: 2,
    handler: async () => sendTestEmailForCurrentUser(email)
  });
  redirect(`/settings/notifications?test=${result.simulated ? "preview" : "sent"}`);
}

export async function sendWeeklyReportNowAction() {
  const auth = await requireAdminCapabilityAccess();
  const run = await withControlledJob({
    jobType: "email_send",
    createdByUserId: auth.user?.id ?? null,
    createdByEmail: auth.user?.email ?? null,
    inputJson: { mode: "weekly_report" },
    lockKey: `weekly-report:${new Date().toISOString().slice(0, 10)}`,
    dedupeMinutes: 60,
    handler: async () => sendScheduledWeeklyReport()
  });
  redirect(`/admin/status?weeklyEmail=${encodeURIComponent(summarizeEmailRun(run))}`);
}

export async function sendAlertDigestNowAction() {
  const auth = await requireAdminCapabilityAccess();
  const run = await withControlledJob({
    jobType: "email_send",
    createdByUserId: auth.user?.id ?? null,
    createdByEmail: auth.user?.email ?? null,
    inputJson: { mode: "alert_digest" },
    lockKey: `alert-digest:${new Date().toISOString().slice(0, 13)}`,
    dedupeMinutes: 30,
    handler: async () => sendHighSeverityAlertDigest()
  });
  redirect(`/admin/status?alertEmail=${encodeURIComponent(summarizeEmailRun(run))}`);
}
