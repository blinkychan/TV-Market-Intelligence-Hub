import Link from "next/link";
import { CalendarClock, Clock3, History, Play, Search } from "lucide-react";
import { queueBackfillJobs, runNextBackfillJobAction } from "./actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input, Select } from "@/components/ui/input";
import { Table, Td, Th } from "@/components/ui/table";
import { BACKFILL_KEYWORD_SETS, mockBackfillJobs } from "@/lib/mock-backfill";
import { mockFeeds } from "@/lib/mock-sources";
import { formatJobMonth, getBackfillDashboardData } from "@/lib/backfill";
import { formatDate, humanize } from "@/lib/utils";

export const dynamic = "force-dynamic";

function statusTone(status: string) {
  if (status === "completed") return "bg-emerald-50 text-emerald-700 ring-emerald-200";
  if (status === "failed") return "bg-rose-50 text-rose-700 ring-rose-200";
  if (status === "running") return "bg-amber-50 text-amber-800 ring-amber-200";
  if (status === "paused") return "bg-slate-100 text-slate-700 ring-slate-200";
  return "bg-sky-50 text-sky-700 ring-sky-200";
}

export default async function BackfillQueuePage() {
  const { jobs, logs, dataSource, statusPanel, errorMessage } = await getBackfillDashboardData();
  const sources = Array.from(new Set([...mockFeeds.map((feed) => feed.publicationName), ...mockBackfillJobs.map((job) => job.source), ...jobs.map((job) => job.source)])).sort();

  return (
    <div className="space-y-6">
      <section className="rounded-lg border bg-white p-6 shadow-panel">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-primary">Historical Backfill</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight">Backfill Queue</h1>
            <p className="mt-3 max-w-3xl text-muted-foreground">
              Backfill 2023-onward TV development coverage in deliberate monthly batches. Each run only touches the next queued job, saves metadata, and routes new items into the review queue.
            </p>
            <div className="mt-4 flex flex-wrap gap-3 text-sm">
              <Link href="/sources" className="font-medium text-primary hover:underline">
                Back to Sources / Ingestion
              </Link>
              <a href="/api/cron/backfill-next" className="font-medium text-primary hover:underline">
                Cron endpoint
              </a>
            </div>
          </div>
          <Badge className={dataSource === "database" ? "bg-emerald-50 text-emerald-700 ring-emerald-200" : "bg-amber-50 text-amber-800 ring-amber-200"}>
            Data Source: {dataSource === "database" ? "Database" : "Mock Preview Data"}
          </Badge>
        </div>
        {errorMessage ? (
          <div className="mt-4 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
            Preview data is active because the backfill queue could not be read: {errorMessage}
          </div>
        ) : null}
      </section>

      <section className="grid gap-4 md:grid-cols-5">
        <Card className="shadow-panel">
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Queued Jobs</CardTitle></CardHeader>
          <CardContent><div className="text-3xl font-semibold">{statusPanel.queuedJobs}</div></CardContent>
        </Card>
        <Card className="shadow-panel">
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Completed Jobs</CardTitle></CardHeader>
          <CardContent><div className="text-3xl font-semibold">{statusPanel.completedJobs}</div></CardContent>
        </Card>
        <Card className="shadow-panel">
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Failed Jobs</CardTitle></CardHeader>
          <CardContent><div className="text-3xl font-semibold">{statusPanel.failedJobs}</div></CardContent>
        </Card>
        <Card className="shadow-panel">
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Articles Saved</CardTitle></CardHeader>
          <CardContent><div className="text-3xl font-semibold">{statusPanel.articlesSaved}</div></CardContent>
        </Card>
        <Card className="shadow-panel">
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Remaining Jobs</CardTitle></CardHeader>
          <CardContent><div className="text-3xl font-semibold">{statusPanel.estimatedRemainingJobs}</div></CardContent>
        </Card>
      </section>

      <div className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
        <Card className="shadow-panel">
          <CardHeader>
            <CardTitle>Generate Backfill Jobs</CardTitle>
            <p className="text-sm text-muted-foreground">Create one queued job per month in the selected range so each run stays small and easy to review.</p>
          </CardHeader>
          <CardContent className="space-y-4">
            <form action={queueBackfillJobs} className="grid gap-3 md:grid-cols-2">
              <Select name="source" required defaultValue={sources[0] ?? ""}>
                {sources.map((source) => (
                  <option key={source} value={source}>
                    {source}
                  </option>
                ))}
              </Select>
              <Select name="keywordSetId" defaultValue={BACKFILL_KEYWORD_SETS[0]?.id}>
                {BACKFILL_KEYWORD_SETS.map((keywordSet) => (
                  <option key={keywordSet.id} value={keywordSet.id}>
                    {keywordSet.label}
                  </option>
                ))}
              </Select>
              <Input name="startMonth" type="month" required defaultValue="2023-01" />
              <Input name="endMonth" type="month" required defaultValue="2023-03" />
              <Input name="category" placeholder="Category / status focus" />
              <Input name="keywords" placeholder="Optional extra keywords" />
              <div className="md:col-span-2 flex items-center justify-between gap-3">
                <p className="text-sm text-muted-foreground">Keyword sets are only search hints. Articles still land in review before anything becomes a project or show.</p>
                <Button type="submit">
                  <Search className="h-4 w-4" /> Queue Jobs
                </Button>
              </div>
            </form>

            <div className="grid gap-3 md:grid-cols-2">
              {BACKFILL_KEYWORD_SETS.map((keywordSet) => (
                <div key={keywordSet.id} className="rounded-lg border bg-slate-50 p-4">
                  <div className="text-sm font-medium">{keywordSet.label}</div>
                  <div className="mt-2 text-xs leading-5 text-muted-foreground">{keywordSet.query}</div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-panel">
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <div>
              <CardTitle>Run Next Backfill Job</CardTitle>
              <p className="text-sm text-muted-foreground">Runs one queued job at a time so the queue stays slow, safe, and reviewable.</p>
            </div>
            <form action={runNextBackfillJobAction}>
              <Button type="submit">
                <Play className="h-4 w-4" /> Run Next
              </Button>
            </form>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-lg border bg-slate-50 p-4 text-sm text-muted-foreground">
              Daily automation should call <code>/api/cron/backfill-next</code>. That endpoint uses the same one-job runner as this button and never auto-creates Project records.
            </div>
            <div className="rounded-lg border bg-slate-50 p-4 text-sm text-muted-foreground">
              Article body fetch stays off unless a future Step 12 body extractor exists and robots rules allow it. For now, backfill stores metadata and links only.
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="shadow-panel">
        <CardHeader>
          <CardTitle>Queue</CardTitle>
          <p className="text-sm text-muted-foreground">One job equals one source-month batch, with the most recent queued months prioritized first.</p>
        </CardHeader>
        <CardContent>
          {jobs.length ? (
            <div className="overflow-x-auto rounded-lg border">
              <Table>
                <thead className="bg-slate-50">
                  <tr>
                    <Th>Source</Th>
                    <Th>Month</Th>
                    <Th>Status</Th>
                    <Th>Keywords</Th>
                    <Th>Found</Th>
                    <Th>Saved</Th>
                    <Th>Skipped</Th>
                    <Th>Updated</Th>
                  </tr>
                </thead>
                <tbody>
                  {jobs.map((job) => (
                    <tr key={job.id}>
                      <Td>
                        <div className="font-medium">{job.source}</div>
                        {job.lastError ? <div className="mt-1 text-xs text-rose-700">{job.lastError}</div> : null}
                      </Td>
                      <Td>{formatJobMonth(job)}</Td>
                      <Td>
                        <Badge className={statusTone(job.status)}>{humanize(job.status)}</Badge>
                      </Td>
                      <Td className="min-w-72 text-sm text-muted-foreground">{job.keywords ?? "None"}</Td>
                      <Td>{job.articlesFound}</Td>
                      <Td>{job.articlesSaved}</Td>
                      <Td>{job.duplicatesSkipped}</Td>
                      <Td className="text-sm text-muted-foreground">
                        {formatDate(job.updatedAt)}
                        {job.completedAt ? <div>{formatDate(job.completedAt)}</div> : null}
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </div>
          ) : (
            <div className="rounded-lg border border-dashed bg-slate-50 p-8 text-center text-sm text-muted-foreground">
              No backfill jobs yet. Generate a monthly range to start slow historical coverage.
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="shadow-panel">
        <CardHeader>
          <CardTitle>Backfill Logs</CardTitle>
          <p className="text-sm text-muted-foreground">Every queued or executed job writes a run log here.</p>
        </CardHeader>
        <CardContent>
          {logs.length ? (
            <div className="overflow-x-auto rounded-lg border">
              <Table>
                <thead className="bg-slate-50">
                  <tr>
                    <Th>Run</Th>
                    <Th>Status</Th>
                    <Th>Fetched</Th>
                    <Th>Saved</Th>
                    <Th>Skipped</Th>
                    <Th>Started</Th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map((run) => (
                    <tr key={run.id}>
                      <Td>
                        <div className="font-medium">{run.sourceName ?? "Backfill"}</div>
                        <div className="mt-1 text-xs text-muted-foreground">{run.notes ?? "Backfill run"}</div>
                      </Td>
                      <Td>
                        <Badge className={statusTone(run.status)}>{humanize(run.status)}</Badge>
                      </Td>
                      <Td>{run.itemsFetched}</Td>
                      <Td>{run.itemsSaved}</Td>
                      <Td>{run.itemsSkipped}</Td>
                      <Td className="text-sm text-muted-foreground">
                        {formatDate(run.startedAt)}
                        {run.completedAt ? <div>{formatDate(run.completedAt)}</div> : null}
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </div>
          ) : (
            <div className="rounded-lg border border-dashed bg-slate-50 p-8 text-center text-sm text-muted-foreground">
              No backfill logs yet. Queue a job and run the next batch to populate the log.
            </div>
          )}
        </CardContent>
      </Card>

      <section className="grid gap-4 md:grid-cols-3">
        <Card className="shadow-panel">
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <CardTitle>Small Batches</CardTitle>
            <Clock3 className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Each run handles a single source-month job. That keeps the queue slow enough for human review and avoids surprise scraping volume.
          </CardContent>
        </Card>
        <Card className="shadow-panel">
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <CardTitle>No Auto-Creation</CardTitle>
            <History className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Backfill only creates Article metadata and review queue entries. Projects and shows still require human approval.
          </CardContent>
        </Card>
        <Card className="shadow-panel">
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <CardTitle>Future Search Adapters</CardTitle>
            <CalendarClock className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Live historical retrieval is intentionally adapter-based, so a search API can plug in later without reworking the queue and review flow.
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
