import Link from "next/link";
import { PageIntro } from "@/components/layout/page-intro";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input, Select } from "@/components/ui/input";
import { Table, Td, Th } from "@/components/ui/table";
import { getFeedbackList, getFeedbackSummary, getUsageInsights } from "@/lib/feedback";
import { requireAdminCapabilityAccess } from "@/lib/team-auth";
import { formatDate, humanize } from "@/lib/utils";
import { updateFeedbackAction } from "./actions";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{
  status?: string;
  type?: string;
  user?: string;
  priority?: string;
}>;

function priorityTone(priority: string) {
  if (priority === "high") return "bg-rose-50 text-rose-700 ring-rose-200";
  if (priority === "medium") return "bg-amber-50 text-amber-800 ring-amber-200";
  return "bg-sky-50 text-sky-700 ring-sky-200";
}

function statusTone(status: string) {
  if (status === "resolved") return "bg-emerald-50 text-emerald-700 ring-emerald-200";
  if (status === "in_progress") return "bg-sky-50 text-sky-700 ring-sky-200";
  if (status === "triaged") return "bg-violet-50 text-violet-700 ring-violet-200";
  if (status === "dismissed") return "bg-slate-100 text-slate-700 ring-slate-200";
  return "bg-amber-50 text-amber-800 ring-amber-200";
}

export default async function AdminFeedbackPage({ searchParams }: { searchParams: SearchParams }) {
  await requireAdminCapabilityAccess();
  const params = await searchParams;
  const filters = {
    status: params.status ?? "",
    type: params.type ?? "",
    user: params.user ?? "",
    priority: params.priority ?? ""
  };

  const [{ rows, dataSource, errorMessage }, summary, usage] = await Promise.all([
    getFeedbackList(filters),
    getFeedbackSummary(),
    getUsageInsights()
  ]);

  const users = Array.from(new Set(rows.map((row) => row.email).filter(Boolean) as string[])).sort();

  return (
    <div className="space-y-6">
      <PageIntro
        eyebrow="Admin"
        title="Feedback Inbox"
        description="Review beta feedback, triage what the small launch group is running into, and capture the next round of cleanup without losing the thread."
        helperText="Keep this lightweight: triage quickly, leave internal notes, and use the usage signals below to separate one-off frustration from repeated workflow friction."
        dataSource={dataSource}
        errorMessage={errorMessage}
      />

      <section className="grid gap-4 md:grid-cols-4">
        <SummaryCard label="Total Feedback" value={summary.total} />
        <SummaryCard label="Open Items" value={summary.open} />
        <SummaryCard label="High Priority" value={summary.highPriority} />
        <SummaryCard label="Contributors" value={summary.userCount} />
      </section>

      <Card className="shadow-panel">
        <CardHeader>
          <CardTitle>Filter Feedback</CardTitle>
        </CardHeader>
        <CardContent>
          <form className="grid gap-3 md:grid-cols-4">
            <Select name="status" defaultValue={filters.status}>
              <option value="">All statuses</option>
              <option value="new">New</option>
              <option value="triaged">Triaged</option>
              <option value="in_progress">In progress</option>
              <option value="resolved">Resolved</option>
              <option value="dismissed">Dismissed</option>
            </Select>
            <Select name="type" defaultValue={filters.type}>
              <option value="">All feedback types</option>
              <option value="bug">Bug</option>
              <option value="data_issue">Data issue</option>
              <option value="feature_request">Feature request</option>
              <option value="confusion">Confusion</option>
              <option value="other">Other</option>
            </Select>
            <Select name="user" defaultValue={filters.user}>
              <option value="">All users</option>
              {users.map((user) => (
                <option key={user} value={user}>
                  {user}
                </option>
              ))}
            </Select>
            <div className="flex gap-2">
              <Select name="priority" defaultValue={filters.priority}>
                <option value="">All priorities</option>
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
              </Select>
              <Button type="submit">Apply</Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <section className="grid gap-6 xl:grid-cols-[1.25fr_0.75fr]">
        <Card className="shadow-panel">
          <CardHeader>
            <CardTitle>Feedback Queue</CardTitle>
          </CardHeader>
          <CardContent>
            {rows.length ? (
              <div className="space-y-4">
                {rows.map((feedback) => (
                  <div key={feedback.id} className="rounded-lg border p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge className={statusTone(feedback.status)}>{humanize(feedback.status)}</Badge>
                          <Badge className={priorityTone(feedback.priority)}>{humanize(feedback.priority)}</Badge>
                          <Badge className="bg-slate-100 text-slate-700 ring-slate-200">{humanize(feedback.feedbackType)}</Badge>
                        </div>
                        <div className="mt-3 text-sm text-muted-foreground">
                          {feedback.email ?? "Unknown teammate"} · {formatDate(feedback.createdAt)} · {feedback.page}
                        </div>
                      </div>
                      {feedback.entityType && feedback.entityId ? (
                        <Link href={linkedRecordHref(feedback.entityType, feedback.entityId)} className="text-sm font-medium text-primary hover:underline">
                          Open linked record
                        </Link>
                      ) : null}
                    </div>
                    <p className="mt-4 text-sm leading-6 text-slate-800">{feedback.message}</p>
                    {feedback.screenshotUrl ? (
                      <a href={feedback.screenshotUrl} target="_blank" rel="noreferrer" className="mt-3 inline-flex text-sm font-medium text-primary hover:underline">
                        Open screenshot reference
                      </a>
                    ) : null}

                    <form action={updateFeedbackAction} className="mt-4 grid gap-3 md:grid-cols-3">
                      <input type="hidden" name="id" value={feedback.id} />
                      <Select name="status" defaultValue={feedback.status}>
                        <option value="new">New</option>
                        <option value="triaged">Triaged</option>
                        <option value="in_progress">In progress</option>
                        <option value="resolved">Resolved</option>
                        <option value="dismissed">Dismissed</option>
                      </Select>
                      <Select name="priority" defaultValue={feedback.priority}>
                        <option value="high">High</option>
                        <option value="medium">Medium</option>
                        <option value="low">Low</option>
                      </Select>
                      <Button type="submit" variant="secondary">Save Triage</Button>
                      <div className="md:col-span-3">
                        <label className="mb-1 block text-sm font-medium">Internal notes</label>
                        <textarea
                          name="internalNotes"
                          defaultValue={feedback.internalNotes ?? ""}
                          rows={3}
                          className="w-full rounded-md border bg-white px-3 py-2 text-sm outline-none transition placeholder:text-muted-foreground focus:ring-2 focus:ring-ring"
                        />
                      </div>
                    </form>
                  </div>
                ))}
              </div>
            ) : (
              <div className="rounded-lg border border-dashed bg-slate-50 p-8 text-center text-sm text-muted-foreground">
                No feedback matches the current filters yet.
              </div>
            )}
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card className="shadow-panel">
            <CardHeader><CardTitle>Usage Signals</CardTitle></CardHeader>
            <CardContent className="space-y-4 text-sm">
              <UsageList title="Most visited pages" items={usage.mostVisitedPages.map((item) => `${item.page ?? "Unknown"} (${item._count.page})`)} />
              <UsageList title="Most used filters" items={usage.mostUsedFilters.map((item) => `${item.value ?? "Unknown"} (${item._count.value})`)} />
              <UsageList title="Most used saved views" items={usage.mostUsedSavedViews.map((item) => `${item.value ?? "Unknown"} (${item._count.value})`)} />
            </CardContent>
          </Card>
          <Card className="shadow-panel">
            <CardHeader><CardTitle>Workflow Counts</CardTitle></CardHeader>
            <CardContent className="space-y-3 text-sm">
              <CountRow label="Articles reviewed" value={usage.counters.articlesReviewed} />
              <CountRow label="Projects created" value={usage.counters.projectsCreated} />
              <CountRow label="Reports generated" value={usage.counters.reportsGenerated} />
            </CardContent>
          </Card>
        </div>
      </section>
    </div>
  );
}

function SummaryCard({ label, value }: { label: string; value: number }) {
  return (
    <Card className="shadow-panel">
      <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">{label}</CardTitle></CardHeader>
      <CardContent><div className="text-3xl font-semibold">{value}</div></CardContent>
    </Card>
  );
}

function UsageList({ title, items }: { title: string; items: string[] }) {
  return (
    <div>
      <div className="font-medium text-slate-900">{title}</div>
      <div className="mt-2 space-y-2">
        {items.length ? items.map((item) => <div key={item} className="text-muted-foreground">{item}</div>) : <div className="text-muted-foreground">No signal yet.</div>}
      </div>
    </div>
  );
}

function CountRow({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted-foreground">{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function linkedRecordHref(entityType: string, entityId: string) {
  if (entityType === "Project") return `/projects/${entityId}`;
  if (entityType === "CurrentShow") return `/current-tv?showId=${encodeURIComponent(entityId)}`;
  if (entityType === "Article") return `/review?articleId=${encodeURIComponent(entityId)}`;
  return "/admin/feedback";
}

