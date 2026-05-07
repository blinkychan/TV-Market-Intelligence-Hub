import Link from "next/link";
import { Mail, Send } from "lucide-react";
import { saveEmailPreferenceAction, sendTestEmailAction } from "./actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input, Select } from "@/components/ui/input";
import { emailDeliveryConfigured, renderEmailHtml } from "@/lib/email";
import { getDefaultFriday, generateWeeklyReportPayload } from "@/lib/weekly-report";
import { getEmailPreferenceForEmail } from "@/lib/email-preferences";
import { getCurrentUserContext, requireApprovedTeamAccess } from "@/lib/team-auth";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{ saved?: string; test?: string; error?: string }>;

export default async function NotificationSettingsPage({ searchParams }: { searchParams: SearchParams }) {
  await requireApprovedTeamAccess();
  const auth = await getCurrentUserContext();
  const params = await searchParams;
  const email = auth.user?.email ?? null;
  const preference = email ? await getEmailPreferenceForEmail(email).catch(() => null) : null;
  const deliveryConfigured = emailDeliveryConfigured();
  const previewPayload = await generateWeeklyReportPayload(getDefaultFriday(new Date()).toISOString(), true);
  const previewHtml = renderEmailHtml({
    title: "Weekly TV Market Report",
    intro: previewPayload.executiveSummary,
    bodyMarkdown: previewPayload.markdown,
    appUrl: `${process.env.NEXT_PUBLIC_APP_URL?.trim() || "http://localhost:3000"}/weekly-reports`
  });

  return (
    <div className="space-y-6">
      <section className="rounded-lg border bg-white p-6 shadow-panel">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-primary">Notifications</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">Email Preferences</h1>
        <p className="mt-3 max-w-3xl text-muted-foreground">
          Choose whether you want scheduled weekly reports and important alert digests delivered to your inbox. Nothing sends unless you opt in.
        </p>
      </section>

      <div className="flex flex-wrap items-center gap-2">
        <Badge className={deliveryConfigured ? "bg-emerald-50 text-emerald-700 ring-emerald-200" : "bg-amber-50 text-amber-800 ring-amber-200"}>
          {deliveryConfigured ? "Resend configured" : "Preview-only email mode"}
        </Badge>
        {email ? (
          <Badge className="bg-slate-100 text-slate-700 ring-slate-200">{email}</Badge>
        ) : null}
      </div>

      {params.saved ? (
        <div className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">Email preferences saved.</div>
      ) : null}
      {params.test === "preview" ? (
        <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          Test email ran in preview mode because `RESEND_API_KEY` or `REPORT_FROM_EMAIL` is not configured yet.
        </div>
      ) : null}
      {params.test === "sent" ? (
        <div className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">Test email sent.</div>
      ) : null}
      {params.error ? (
        <div className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-900">Could not complete that request: {params.error}</div>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[1.15fr_1fr]">
        <Card className="shadow-panel">
          <CardHeader>
            <CardTitle>Preference Controls</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <form action={saveEmailPreferenceAction} className="space-y-4">
              <label className="flex items-start gap-3 rounded-lg border bg-slate-50 p-4 text-sm">
                <input type="checkbox" name="receiveWeeklyReport" defaultChecked={preference?.receiveWeeklyReport ?? false} className="mt-1" />
                <div>
                  <div className="font-medium">Receive weekly report</div>
                  <div className="text-muted-foreground">Get the executive Friday market snapshot in your inbox.</div>
                </div>
              </label>

              <label className="flex items-start gap-3 rounded-lg border bg-slate-50 p-4 text-sm">
                <input
                  type="checkbox"
                  name="receiveHighSeverityAlerts"
                  defaultChecked={preference?.receiveHighSeverityAlerts ?? false}
                  className="mt-1"
                />
                <div>
                  <div className="font-medium">Receive high-severity alert digests</div>
                  <div className="text-muted-foreground">Bundle urgent low-confidence, duplicate, and missing-data alerts into a digest.</div>
                </div>
              </label>

              <label className="flex items-start gap-3 rounded-lg border bg-slate-50 p-4 text-sm">
                <input
                  type="checkbox"
                  name="receiveWatchlistAlerts"
                  defaultChecked={preference?.receiveWatchlistAlerts ?? false}
                  className="mt-1"
                />
                <div>
                  <div className="font-medium">Receive watchlist alert digests</div>
                  <div className="text-muted-foreground">Include high-severity watchlist matches in your digest when they surface.</div>
                </div>
              </label>

              <div className="grid gap-3 md:grid-cols-2">
                <div>
                  <div className="mb-2 text-sm font-medium">Weekly report day</div>
                  <Select name="weeklyReportDay" defaultValue={preference?.weeklyReportDay ?? "friday"}>
                    <option value="friday">Friday</option>
                    <option value="monday">Monday</option>
                    <option value="thursday">Thursday</option>
                  </Select>
                </div>
                <div>
                  <div className="mb-2 text-sm font-medium">Weekly report time</div>
                  <Input name="weeklyReportTime" type="time" defaultValue={preference?.weeklyReportTime ?? "09:00"} />
                </div>
              </div>

              <div className="flex flex-wrap gap-3">
                <Button type="submit">
                  <Mail className="h-4 w-4" /> Save Preferences
                </Button>
              </div>
            </form>

            <form action={sendTestEmailAction}>
              <Button type="submit" variant="secondary">
                <Send className="h-4 w-4" /> Send Test Email
              </Button>
            </form>

            <div className="text-xs text-muted-foreground">
              Team-wide scheduling still runs through Vercel Cron. Your personal preferences decide whether you are included when those sends happen.
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-panel">
          <CardHeader>
            <CardTitle>Email Preview</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-lg border bg-slate-50 p-4 text-sm text-muted-foreground">
              This is the shape of the weekly email that gets sent. When delivery keys are missing, test sends stay in preview mode and no real message leaves the app.
            </div>
            <div className="rounded-lg border bg-white p-4">
              <div className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">Preview Subject</div>
              <div className="mt-2 font-medium">TV Market Intelligence Weekly Report · {getDefaultFriday(new Date()).toISOString().slice(0, 10)}</div>
            </div>
            <details className="rounded-lg border bg-white p-4">
              <summary className="cursor-pointer font-medium">Preview email HTML</summary>
              <pre className="mt-4 max-h-[32rem] overflow-auto whitespace-pre-wrap text-xs text-slate-700">{previewHtml}</pre>
            </details>
            <Link href="/weekly-reports" className="text-sm font-medium text-primary hover:underline">
              Open Weekly Reports
            </Link>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
