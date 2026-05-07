import { AlertTriangle, CheckCircle2, ClipboardCheck, Download, RefreshCcw, XCircle } from "lucide-react";
import { runLaunchChecksAction } from "./actions";
import { PageIntro } from "@/components/layout/page-intro";
import { getLaunchChecklistReport, type LaunchChecklistItem } from "@/lib/launch-checklist";
import { requireAdminCapabilityAccess } from "@/lib/team-auth";
import { formatDate } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button, ButtonLink } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const dynamic = "force-dynamic";

function statusTone(status: LaunchChecklistItem["status"]) {
  if (status === "pass") return "bg-emerald-50 text-emerald-700 ring-emerald-200";
  if (status === "warning") return "bg-amber-50 text-amber-800 ring-amber-200";
  return "bg-rose-50 text-rose-700 ring-rose-200";
}

function StatusIcon({ status }: { status: LaunchChecklistItem["status"] }) {
  if (status === "pass") return <CheckCircle2 className="h-4 w-4 text-emerald-600" />;
  if (status === "warning") return <AlertTriangle className="h-4 w-4 text-amber-600" />;
  return <XCircle className="h-4 w-4 text-rose-600" />;
}

function SummaryCard({
  label,
  value,
  tone
}: {
  label: string;
  value: number;
  tone: string;
}) {
  return (
    <Card className="shadow-panel">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm text-muted-foreground">{label}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className={`text-3xl font-semibold ${tone}`}>{value}</div>
      </CardContent>
    </Card>
  );
}

export default async function AdminLaunchChecklistPage() {
  await requireAdminCapabilityAccess();
  const report = await getLaunchChecklistReport();

  return (
    <div className="space-y-6">
      <PageIntro
        eyebrow="Launch Readiness"
        title="Production QA Checklist"
        description="Final pre-launch checks for the hosted app. This keeps the last mile honest: auth, database, ingestion, reporting, automation, and the operational seams that matter most once a team starts using the product for real."
        helperText={`Last checked ${formatDate(report.checkedAt)}. Use this page as the final go/no-go board before inviting more teammates in.`}
      >
        <form action={runLaunchChecksAction}>
          <Button type="submit">
            <RefreshCcw className="mr-2 h-4 w-4" />
            Run QA Checks
          </Button>
        </form>
        <ButtonLink href="/api/admin/launch-checklist/export" variant="secondary">
          <Download className="mr-2 h-4 w-4" />
          Export QA Report
        </ButtonLink>
      </PageIntro>

      {report.productionWarnings.length ? (
        <Card className="border-amber-200 bg-amber-50 shadow-panel">
          <CardHeader>
            <CardTitle className="text-amber-900">Production warnings</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-amber-900">
            {report.productionWarnings.map((warning) => (
              <div key={warning} className="rounded-lg border border-amber-200 bg-white px-4 py-3">
                {warning}
              </div>
            ))}
          </CardContent>
        </Card>
      ) : null}

      <section className="grid gap-4 md:grid-cols-3">
        <SummaryCard label="Pass" value={report.summary.pass} tone="text-emerald-700" />
        <SummaryCard label="Warnings" value={report.summary.warning} tone="text-amber-700" />
        <SummaryCard label="Failures" value={report.summary.fail} tone="text-rose-700" />
      </section>

      <div className="space-y-4">
        {report.items.map((item) => (
          <Card key={item.id} className="shadow-panel">
            <CardHeader className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <StatusIcon status={item.status} />
                  <CardTitle className="text-lg">{item.label}</CardTitle>
                </div>
                <p className="text-sm text-muted-foreground">{item.explanation}</p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Badge className={statusTone(item.status)}>{item.status}</Badge>
                <ButtonLink href={item.href} variant="ghost" className="h-8 px-2 text-sm">
                  Open
                </ButtonLink>
              </div>
            </CardHeader>
            <CardContent className="flex items-center justify-between text-sm text-muted-foreground">
              <span>Last checked {formatDate(item.lastCheckedAt)}</span>
              <span className="inline-flex items-center gap-2">
                <ClipboardCheck className="h-4 w-4" />
                Ready link: {item.href}
              </span>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
