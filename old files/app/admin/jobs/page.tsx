import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageIntro } from "@/components/layout/page-intro";
import { getAdminJobRuns } from "@/lib/job-control";
import { requireAdminCapabilityAccess } from "@/lib/team-auth";
import { formatDate } from "@/lib/utils";
import { cancelJobAction, rerunJobAction } from "./actions";

export const dynamic = "force-dynamic";
type AdminJob = Awaited<ReturnType<typeof getAdminJobRuns>>[number];

function tone(status: string) {
  if (status === "completed") return "bg-emerald-50 text-emerald-700 ring-emerald-200";
  if (status === "failed") return "bg-rose-50 text-rose-700 ring-rose-200";
  if (status === "running") return "bg-sky-50 text-sky-700 ring-sky-200";
  if (status === "canceled") return "bg-amber-50 text-amber-800 ring-amber-200";
  return "bg-slate-100 text-slate-700 ring-slate-200";
}

function prettyJson(value: unknown) {
  if (value == null) return "None";
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return "Unavailable";
  }
}

export default async function AdminJobsPage() {
  await requireAdminCapabilityAccess();
  const jobs = await getAdminJobRuns();
  const running = jobs.filter((job: AdminJob) => job.status === "running");
  const failed = jobs.filter((job: AdminJob) => job.status === "failed");

  return (
    <div className="space-y-6">
      <PageIntro
        eyebrow="Admin"
        title="Background Jobs"
        description="See what operational work is running, inspect the inputs and results, cancel jobs where it is safe, and rerun failed jobs through the same guarded paths."
        helperText="Background jobs cover ingestion, extraction, email delivery, and reporting. If something feels stuck, start here before you reach for logs."
      />

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="shadow-panel">
          <CardHeader><CardTitle>Running</CardTitle></CardHeader>
          <CardContent className="text-3xl font-semibold">{running.length}</CardContent>
        </Card>
        <Card className="shadow-panel">
          <CardHeader><CardTitle>Failed</CardTitle></CardHeader>
          <CardContent className="text-3xl font-semibold">{failed.length}</CardContent>
        </Card>
        <Card className="shadow-panel">
          <CardHeader><CardTitle>Tracked Jobs</CardTitle></CardHeader>
          <CardContent className="text-3xl font-semibold">{jobs.length}</CardContent>
        </Card>
      </div>

      <div className="space-y-4">
        {jobs.map((job: AdminJob) => (
          <Card key={job.id} className="shadow-panel">
            <CardHeader className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <CardTitle className="text-lg">{job.jobType.replaceAll("_", " ")}</CardTitle>
                <p className="mt-2 text-sm text-muted-foreground">
                  Created {formatDate(job.createdAt)} {job.createdByEmail ? `by ${job.createdByEmail}` : ""}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Badge className={tone(job.status)}>{job.status}</Badge>
                {job.status === "running" || job.status === "queued" ? (
                  <form action={cancelJobAction}>
                    <input type="hidden" name="jobId" value={job.id} />
                    <Button type="submit" variant="secondary">Cancel</Button>
                  </form>
                ) : null}
                {job.status === "failed" ? (
                  <form action={rerunJobAction}>
                    <input type="hidden" name="jobId" value={job.id} />
                    <Button type="submit">Rerun Failed Job</Button>
                  </form>
                ) : null}
              </div>
            </CardHeader>
            <CardContent className="grid gap-4 lg:grid-cols-2">
              <div className="space-y-2">
                <div className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Job details</div>
                <dl className="space-y-2 text-sm">
                  <div><dt className="font-medium">Lock key</dt><dd className="text-muted-foreground">{job.lockKey ?? "None"}</dd></div>
                  <div><dt className="font-medium">Started</dt><dd className="text-muted-foreground">{job.startedAt ? formatDate(job.startedAt) : "Not started"}</dd></div>
                  <div><dt className="font-medium">Completed</dt><dd className="text-muted-foreground">{job.completedAt ? formatDate(job.completedAt) : "Still active"}</dd></div>
                  <div><dt className="font-medium">Error</dt><dd className="text-muted-foreground">{job.errorMessage ?? "None"}</dd></div>
                </dl>
              </div>
              <div className="space-y-3">
                <div>
                  <div className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Input</div>
                  <pre className="mt-2 overflow-x-auto rounded-lg border bg-slate-50 p-3 text-xs">{prettyJson(job.inputJson)}</pre>
                </div>
                <div>
                  <div className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Result</div>
                  <pre className="mt-2 overflow-x-auto rounded-lg border bg-slate-50 p-3 text-xs">{prettyJson(job.resultJson)}</pre>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
