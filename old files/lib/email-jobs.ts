import { format } from "date-fns";
import { recordAuditLog } from "@/lib/audit";
import { sendEmail, renderEmailHtml } from "@/lib/email";
import { getAlertDigestRecipients, getEmailPreferenceForEmail, getWeeklyReportRecipients } from "@/lib/email-preferences";
import { logOperationalEvent } from "@/lib/ops-log";
import { getVisibleAlertsForEmail } from "@/lib/watchlists";
import { generateWeeklyReportPayload, getDefaultFriday } from "@/lib/weekly-report";
import { humanize } from "@/lib/utils";

export type EmailJobRun = {
  mode: "weekly_report" | "alert_digest" | "test";
  reportDate?: string | null;
  recipients: number;
  sent: number;
  simulated: number;
  skipped: number;
  previews: Array<{ to: string[]; subject: string; text: string; html: string }>;
};

function getAppUrl() {
  return process.env.NEXT_PUBLIC_APP_URL?.trim() || "http://localhost:3000";
}

function weekdayName(date: Date) {
  return format(date, "EEEE").toLowerCase();
}

function alertDigestText(args: { heading: string; items: Array<{ title: string; message: string; watchlistName?: string | null }> }) {
  const lines = [
    args.heading,
    "",
    ...args.items.map((item) => `- ${item.title}${item.watchlistName ? ` [${item.watchlistName}]` : ""}: ${item.message}`)
  ];
  return lines.join("\n");
}

export async function sendScheduledWeeklyReport(reportDate = getDefaultFriday(new Date())): Promise<EmailJobRun> {
  const payload = await generateWeeklyReportPayload(reportDate.toISOString());
  const recipients = await getWeeklyReportRecipients(weekdayName(reportDate));
  const previews: EmailJobRun["previews"] = [];

  let sent = 0;
  let simulated = 0;
  let skipped = 0;

  for (const recipient of recipients) {
    const appUrl = `${getAppUrl()}/weekly-reports`;
    const subject = `TV Market Intelligence Weekly Report · ${format(reportDate, "MMMM d, yyyy")}`;
    const html = renderEmailHtml({
      title: "Weekly TV Market Report",
      intro: payload.executiveSummary,
      bodyMarkdown: `${payload.markdown}\n\nOpen the app for the full dashboard and exports: ${appUrl}`,
      appUrl
    });
    const result = await sendEmail({
      to: recipient.email,
      subject,
      html,
      text: `${payload.markdown}\n\nOpen the app: ${appUrl}`
    });

    if (result.simulated) {
      simulated += 1;
      if (result.preview) previews.push(result.preview);
    } else {
      sent += 1;
    }

    await recordAuditLog({
      entityType: "WeeklyReport",
      entityId: reportDate.toISOString().slice(0, 10),
      action: "referenced",
      newValueJson: {
        email: recipient.email,
        subject,
        simulated: result.simulated,
        reportDate: reportDate.toISOString()
      },
      reason: "Scheduled weekly report email sent.",
      source: "email_weekly_report"
    });
  }

  if (!recipients.length) skipped = 1;

  logOperationalEvent("info", "Weekly report email job finished.", {
    recipients: recipients.length,
    sent,
    simulated,
    skipped
  });

  return {
    mode: "weekly_report",
    reportDate: reportDate.toISOString().slice(0, 10),
    recipients: recipients.length,
    sent,
    simulated,
    skipped,
    previews
  };
}

export async function sendHighSeverityAlertDigest(): Promise<EmailJobRun> {
  const recipients = await getAlertDigestRecipients();
  const previews: EmailJobRun["previews"] = [];

  let sent = 0;
  let simulated = 0;
  let skipped = 0;

  for (const recipient of recipients) {
    const visibleAlerts = await getVisibleAlertsForEmail(recipient.email, { severity: "high", unreadOnly: true });
    const includedAlerts = visibleAlerts.filter((alert) => {
      const watchlistBound = Boolean(alert.watchlistId);
      if (watchlistBound) return recipient.receiveWatchlistAlerts || recipient.receiveHighSeverityAlerts;
      return recipient.receiveHighSeverityAlerts;
    });

    if (!includedAlerts.length) {
      skipped += 1;
      continue;
    }

    const appUrl = `${getAppUrl()}/alerts`;
    const subject = `TV Market Intelligence Alert Digest · ${includedAlerts.length} high-severity item${includedAlerts.length === 1 ? "" : "s"}`;
    const digestText = alertDigestText({
      heading: "High-severity alerts waiting in TV Market Intelligence Hub",
      items: includedAlerts.map((alert) => ({
        title: alert.title,
        message: alert.message,
        watchlistName: alert.watchlist?.name ?? null
      }))
    });
    const html = renderEmailHtml({
      title: "High-Severity Alert Digest",
      intro: `${includedAlerts.length} unread high-severity alert${includedAlerts.length === 1 ? "" : "s"} matched your notification settings.`,
      bodyMarkdown: `${digestText}\n\nOpen the app for the full alert center: ${appUrl}`,
      appUrl
    });

    const result = await sendEmail({
      to: recipient.email,
      subject,
      html,
      text: `${digestText}\n\nOpen the app: ${appUrl}`
    });

    if (result.simulated) {
      simulated += 1;
      if (result.preview) previews.push(result.preview);
    } else {
      sent += 1;
    }

    await recordAuditLog({
      entityType: "Alert",
      entityId: `digest-${recipient.email}`,
      action: "referenced",
      newValueJson: {
        email: recipient.email,
        subject,
        simulated: result.simulated,
        alertCount: includedAlerts.length
      },
      reason: "High-severity alert digest sent.",
      source: "email_alert_digest"
    });
  }

  logOperationalEvent("info", "Alert digest email job finished.", {
    recipients: recipients.length,
    sent,
    simulated,
    skipped
  });

  return {
    mode: "alert_digest",
    recipients: recipients.length,
    sent,
    simulated,
    skipped,
    previews
  };
}

export async function sendTestEmailForCurrentUser(email: string) {
  const preference = await getEmailPreferenceForEmail(email);
  const defaultFriday = getDefaultFriday(new Date());
  const payload = await generateWeeklyReportPayload(defaultFriday.toISOString(), true);
  const appUrl = `${getAppUrl()}/settings/notifications`;
  const subject = "TV Market Intelligence Test Email";
  const html = renderEmailHtml({
    title: "Notification Test",
    intro: "This is a safe preview of the weekly-report email style and delivery wiring.",
    bodyMarkdown: `Preference snapshot\n\n- Weekly reports: ${preference?.receiveWeeklyReport ? "On" : "Off"}\n- High-severity alerts: ${preference?.receiveHighSeverityAlerts ? "On" : "Off"}\n- Watchlist alerts: ${preference?.receiveWatchlistAlerts ? "On" : "Off"}\n\nWeekly report preview\n\n${payload.markdown}`,
    appUrl
  });

  const result = await sendEmail({
    to: email,
    subject,
    html,
    text: `Notification Test\n\nPreference snapshot\n- Weekly reports: ${preference?.receiveWeeklyReport ? "On" : "Off"}\n- High-severity alerts: ${preference?.receiveHighSeverityAlerts ? "On" : "Off"}\n- Watchlist alerts: ${preference?.receiveWatchlistAlerts ? "On" : "Off"}\n\nWeekly report preview\n\n${payload.markdown}\n\nOpen the app: ${appUrl}`
  });

  await recordAuditLog({
    entityType: "WeeklyReport",
    entityId: `test-${email}`,
    action: "referenced",
    newValueJson: {
      email,
      subject,
      simulated: result.simulated,
      previewMode: result.simulated
    },
    reason: "Notification test email sent.",
    source: "email_test"
  });

  return result;
}

export function summarizeEmailRun(run: EmailJobRun) {
  return `${humanize(run.mode)} · recipients ${run.recipients} · sent ${run.sent} · simulated ${run.simulated} · skipped ${run.skipped}`;
}
