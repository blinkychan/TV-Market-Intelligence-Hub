import Link from "next/link";
import { Activity, Database, FileText, Play, Radio, RefreshCcw, ShieldCheck } from "lucide-react";
import { logoutAdmin } from "../login/actions";
import { saveUserProfileAction } from "./actions";
import { logoutTeamSession } from "@/app/login/actions";
import { fetchArticleBodyAction, fetchBodiesForNeedsReview, fetchSelectedBodiesAction } from "@/app/review/actions";
import { runRssIngestion } from "@/app/sources/actions";
import { runNextBackfillJobAction } from "@/app/sources/backfill/actions";
import { prisma } from "@/lib/prisma";
import { getCurrentUserContext, requireAdminCapabilityAccess } from "@/lib/team-auth";
import { formatDate } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select } from "@/components/ui/input";

export const dynamic = "force-dynamic";

type StatusSnapshot = {
  appEnvironment: string;
  databaseConnected: boolean;
  articleCount: number;
  projectCount: number;
  currentShowCount: number;
  reviewQueueCount: number;
  latestRssRun: { startedAt: Date; completedAt: Date | null; status: string; notes: string | null } | null;
  latestBackfillRun: { startedAt: Date; completedAt: Date | null; status: string; notes: string | null } | null;
  latestBodyFetchRun: { startedAt: Date; completedAt: Date | null; status: string; notes: string | null } | null;
  reviewArticles: Array<{
    id: string;
    headline: string;
    publication: string | null;
    bodyFetchStatus: string | null;
    publishedDate: Date | null;
  }>;
  userProfiles: Array<{
    id: string;
    email: string;
    role: "admin" | "editor" | "viewer";
    updatedAt: Date;
  }>;
  emptyDatabase: boolean;
  databaseError: string | null;
};

function runTone(status?: string | null) {
  if (status === "completed") return "bg-emerald-50 text-emerald-700 ring-emerald-200";
  if (status === "failed") return "bg-rose-50 text-rose-700 ring-rose-200";
  if (status === "blocked") return "bg-amber-50 text-amber-800 ring-amber-200";
  if (status === "queued" || status === "running") return "bg-sky-50 text-sky-700 ring-sky-200";
  return "bg-slate-100 text-slate-700 ring-slate-200";
}

async function getStatusSnapshot(): Promise<StatusSnapshot> {
  const appEnvironment = process.env.VERCEL_ENV || process.env.NODE_ENV || "development";

  try {
    await prisma.$queryRaw`SELECT 1`;

    const [articleCount, projectCount, currentShowCount, reviewQueueCount, latestRssRun, latestBackfillRun, latestBodyFetchRun, reviewArticles, userProfiles] =
      await Promise.all([
        prisma.article.count(),
        prisma.project.count(),
        prisma.currentShow.count(),
        prisma.article.count({ where: { extractionStatus: { in: ["Needs Review", "New"] } } }),
        prisma.ingestionRun.findFirst({
          where: { sourceType: { in: ["rss", "rss_mock", "rss_placeholder"] } },
          orderBy: { startedAt: "desc" },
          select: { startedAt: true, completedAt: true, status: true, notes: true }
        }),
        prisma.ingestionRun.findFirst({
          where: { sourceType: "backfill" },
          orderBy: { startedAt: "desc" },
          select: { startedAt: true, completedAt: true, status: true, notes: true }
        }),
        prisma.ingestionRun.findFirst({
          where: { sourceType: "body_fetch" },
          orderBy: { startedAt: "desc" },
          select: { startedAt: true, completedAt: true, status: true, notes: true }
        }),
        prisma.article.findMany({
          where: { extractionStatus: { in: ["Needs Review", "New"] } },
          orderBy: [{ publishedDate: "desc" }, { createdAt: "desc" }],
          take: 8,
          select: {
            id: true,
            headline: true,
            publication: true,
            bodyFetchStatus: true,
            publishedDate: true
          }
        }),
        prisma.userProfile.findMany({
          orderBy: [{ role: "asc" }, { email: "asc" }],
          select: { id: true, email: true, role: true, updatedAt: true }
        })
      ]);

    return {
      appEnvironment,
      databaseConnected: true,
      articleCount,
      projectCount,
      currentShowCount,
      reviewQueueCount,
      latestRssRun,
      latestBackfillRun,
      latestBodyFetchRun,
      reviewArticles,
      userProfiles,
      emptyDatabase: articleCount + projectCount + currentShowCount === 0,
      databaseError: null
    };
  } catch (error) {
    return {
      appEnvironment,
      databaseConnected: false,
      articleCount: 0,
      projectCount: 0,
      currentShowCount: 0,
      reviewQueueCount: 0,
      latestRssRun: null,
      latestBackfillRun: null,
      latestBodyFetchRun: null,
      reviewArticles: [],
      userProfiles: [],
      emptyDatabase: true,
      databaseError: error instanceof Error ? error.message : "Unknown database error."
    };
  }
}

function RunMeta({ label, run }: { label: string; run: StatusSnapshot["latestRssRun"] }) {
  return (
    <div className="rounded-lg border bg-slate-50 p-4">
      <div className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">{label}</div>
      {run ? (
        <div className="mt-3 space-y-2">
          <Badge className={runTone(run.status)}>{run.status}</Badge>
          <div className="text-sm font-medium">{formatDate(run.completedAt ?? run.startedAt)}</div>
          <div className="text-sm text-muted-foreground">{run.notes ?? "No notes recorded."}</div>
        </div>
      ) : (
        <div className="mt-3 text-sm text-muted-foreground">No run logged yet.</div>
      )}
    </div>
  );
}

export default async function AdminStatusPage() {
  await requireAdminCapabilityAccess();
  const snapshot = await getStatusSnapshot();
  const auth = await getCurrentUserContext();

  return (
    <div className="space-y-6">
      <section className="rounded-lg border bg-white p-6 shadow-panel">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-primary">Production Readiness</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight">Admin Status</h1>
            <p className="mt-3 max-w-3xl text-muted-foreground">
              Hosted operations view for database health, ingestion activity, and review-queue readiness. This page always shows live infrastructure state and never swaps in mock preview data on its own.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge className={snapshot.databaseConnected ? "bg-emerald-50 text-emerald-700 ring-emerald-200" : "bg-rose-50 text-rose-700 ring-rose-200"}>
              Database: {snapshot.databaseConnected ? "Connected" : "Disconnected"}
            </Badge>
            <Badge className="bg-sky-50 text-sky-700 ring-sky-200">Environment: {snapshot.appEnvironment}</Badge>
            {auth.sessionSource === "supabase" ? (
              <form action={logoutTeamSession}>
                <Button type="submit" variant="secondary">Team log out</Button>
              </form>
            ) : null}
            {auth.adminUnlocked ? (
              <form action={logoutAdmin}>
                <Button type="submit" variant="secondary">End admin unlock</Button>
              </form>
            ) : null}
          </div>
        </div>
      </section>

      {!snapshot.databaseConnected ? (
        <Card className="border-rose-200 bg-rose-50 shadow-panel">
          <CardHeader>
            <CardTitle className="text-rose-900">Database connection needs attention</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-rose-900">
            <p>The hosted app could not connect to Supabase/Postgres, so operational actions are intentionally limited until the connection is restored.</p>
            <p>{snapshot.databaseError}</p>
            <div className="rounded-lg border border-rose-200 bg-white p-4 font-mono text-xs">
              DATABASE_URL=...
              <br />
              DIRECT_URL=...
              <br />
              NEXT_PUBLIC_SUPABASE_URL=...
              <br />
              NEXT_PUBLIC_SUPABASE_ANON_KEY=...
              <br />
              NEXT_PUBLIC_APP_URL=...
              <br />
              ADMIN_PASSWORD=...
            </div>
          </CardContent>
        </Card>
      ) : null}

      {snapshot.databaseConnected && snapshot.emptyDatabase ? (
        <Card className="border-amber-200 bg-amber-50 shadow-panel">
          <CardHeader>
            <CardTitle className="text-amber-900">Starter data has not been loaded yet</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-amber-900">
            <p>The tables are connected, but the app is effectively empty right now. That is fine for production, but it helps to seed starter data during QA and onboarding.</p>
            <div className="rounded-lg border border-amber-200 bg-white p-4 font-mono text-xs">
              npx prisma db push
              <br />
              npx prisma db seed
              <br />
              npx prisma studio
            </div>
            <Link href="/sources" className="font-medium text-primary hover:underline">
              Open Sources / Ingestion
            </Link>
          </CardContent>
        </Card>
      ) : null}

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card className="shadow-panel">
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Articles</CardTitle></CardHeader>
          <CardContent><div className="text-3xl font-semibold">{snapshot.articleCount}</div></CardContent>
        </Card>
        <Card className="shadow-panel">
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Projects</CardTitle></CardHeader>
          <CardContent><div className="text-3xl font-semibold">{snapshot.projectCount}</div></CardContent>
        </Card>
        <Card className="shadow-panel">
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Current Shows</CardTitle></CardHeader>
          <CardContent><div className="text-3xl font-semibold">{snapshot.currentShowCount}</div></CardContent>
        </Card>
        <Card className="shadow-panel">
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Needs Review</CardTitle></CardHeader>
          <CardContent><div className="text-3xl font-semibold">{snapshot.reviewQueueCount}</div></CardContent>
        </Card>
      </section>

      <section className="grid gap-4 lg:grid-cols-3">
        <RunMeta label="Last RSS Ingestion" run={snapshot.latestRssRun} />
        <RunMeta label="Last Backfill Run" run={snapshot.latestBackfillRun} />
        <RunMeta label="Last Body Extraction Run" run={snapshot.latestBodyFetchRun} />
      </section>

      <div className="grid gap-6 xl:grid-cols-[1fr_1fr]">
        <Card className="shadow-panel">
          <CardHeader>
            <CardTitle>Operational Controls</CardTitle>
            <p className="text-sm text-muted-foreground">Manual controls for hosted QA and low-volume team use.</p>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <form action={runRssIngestion} className="rounded-lg border bg-slate-50 p-4">
              <div className="flex items-center gap-2 text-sm font-medium">
                <Radio className="h-4 w-4 text-primary" />
                Run RSS ingestion
              </div>
              <p className="mt-2 text-sm text-muted-foreground">Fetch configured RSS feeds, dedupe by URL, and route relevant stories into review.</p>
              <Button type="submit" className="mt-4 w-full" disabled={!snapshot.databaseConnected}>
                Run RSS now
              </Button>
            </form>

            <form action={runNextBackfillJobAction} className="rounded-lg border bg-slate-50 p-4">
              <div className="flex items-center gap-2 text-sm font-medium">
                <Play className="h-4 w-4 text-primary" />
                Run next backfill job
              </div>
              <p className="mt-2 text-sm text-muted-foreground">Process exactly one queued historical batch and leave all new records in review.</p>
              <Button type="submit" className="mt-4 w-full" disabled={!snapshot.databaseConnected}>
                Run next batch
              </Button>
            </form>

            <form action={fetchArticleBodyAction} className="rounded-lg border bg-slate-50 p-4 md:col-span-2">
              <div className="flex items-center gap-2 text-sm font-medium">
                <RefreshCcw className="h-4 w-4 text-primary" />
                Fetch article body for one review item
              </div>
              <p className="mt-2 text-sm text-muted-foreground">Reads article text only when robots rules allow it, then stores internal extraction text and a short excerpt.</p>
              <div className="mt-4 flex flex-col gap-3 md:flex-row">
                <Select name="articleId" defaultValue={snapshot.reviewArticles[0]?.id ?? ""} className="md:flex-1" disabled={!snapshot.reviewArticles.length || !snapshot.databaseConnected}>
                  {snapshot.reviewArticles.length ? (
                    snapshot.reviewArticles.map((article) => (
                      <option key={article.id} value={article.id}>
                        {article.headline}
                      </option>
                    ))
                  ) : (
                    <option value="">No review articles available</option>
                  )}
                </Select>
                <Button type="submit" disabled={!snapshot.reviewArticles.length || !snapshot.databaseConnected}>
                  Fetch selected body
                </Button>
              </div>
            </form>

            <form action={fetchBodiesForNeedsReview} className="rounded-lg border bg-slate-50 p-4 md:col-span-2">
              <div className="flex items-center gap-2 text-sm font-medium">
                <Activity className="h-4 w-4 text-primary" />
                Fetch bodies for the queue
              </div>
              <p className="mt-2 text-sm text-muted-foreground">Runs polite body fetch attempts for all articles still marked New or Needs Review.</p>
              <Button type="submit" className="mt-4 w-full" disabled={!snapshot.reviewQueueCount || !snapshot.databaseConnected}>
                Fetch bodies for needs review
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card className="shadow-panel">
          <CardHeader>
            <CardTitle>Selected Review Articles</CardTitle>
            <p className="text-sm text-muted-foreground">Quick operational slice for bulk body extraction and queue triage.</p>
          </CardHeader>
          <CardContent className="space-y-4">
            {snapshot.reviewArticles.length ? (
              <form action={fetchSelectedBodiesAction} className="space-y-4">
                <div className="space-y-3">
                  {snapshot.reviewArticles.map((article) => (
                    <label key={article.id} className="flex items-start gap-3 rounded-lg border bg-slate-50 p-4">
                      <input type="checkbox" name="articleIds" value={article.id} className="mt-1" />
                      <div className="min-w-0 flex-1">
                        <div className="font-medium">{article.headline}</div>
                        <div className="mt-1 text-sm text-muted-foreground">
                          {article.publication ?? "Unknown source"} · {formatDate(article.publishedDate)}
                        </div>
                      </div>
                      <Badge className={runTone(article.bodyFetchStatus)}>{article.bodyFetchStatus ?? "not fetched"}</Badge>
                    </label>
                  ))}
                </div>
                <Button type="submit" className="w-full" disabled={!snapshot.databaseConnected}>
                  <FileText className="h-4 w-4" /> Fetch bodies for selected articles
                </Button>
              </form>
            ) : (
              <div className="rounded-lg border border-dashed bg-slate-50 p-8 text-center text-sm text-muted-foreground">
                No review articles are waiting right now. Once RSS, manual URLs, or backfill create articles, they will show up here.
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="shadow-panel">
        <CardHeader>
          <CardTitle>Team Roles</CardTitle>
          <p className="text-sm text-muted-foreground">Approved access is granted by matching Supabase Auth email addresses to this role list.</p>
        </CardHeader>
        <CardContent className="space-y-4">
          <form action={saveUserProfileAction} className="grid gap-3 rounded-lg border bg-slate-50 p-4 md:grid-cols-[1.2fr_0.6fr_auto]">
            <input
              name="email"
              type="email"
              placeholder="teammate@company.com"
              className="h-9 w-full rounded-md border bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
            />
            <Select name="role" defaultValue="viewer">
              <option value="admin">admin</option>
              <option value="editor">editor</option>
              <option value="viewer">viewer</option>
            </Select>
            <Button type="submit">Add / Update User</Button>
          </form>

          {snapshot.userProfiles.length ? (
            <div className="overflow-x-auto rounded-lg border">
              <table className="min-w-full divide-y divide-slate-200 text-sm">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">Email</th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">Role</th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">Updated</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {snapshot.userProfiles.map((profile) => (
                    <tr key={profile.id}>
                      <td className="px-4 py-3">{profile.email}</td>
                      <td className="px-4 py-3">
                        <Badge className="bg-slate-100 text-slate-700 ring-slate-200">{profile.role}</Badge>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{formatDate(profile.updatedAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="rounded-lg border border-dashed bg-slate-50 p-6 text-sm text-muted-foreground">
              No approved users are listed yet. Create user accounts in Supabase Auth first, then add their email and role here.
            </div>
          )}
        </CardContent>
      </Card>

      <section className="grid gap-4 lg:grid-cols-2">
        <Card className="shadow-panel">
          <CardHeader>
            <CardTitle>Hosted Setup Notes</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <p>Required Vercel environment variables:</p>
            <div className="rounded-lg border bg-slate-50 p-4 font-mono text-xs text-slate-700">
              DATABASE_URL=
              <br />
              DIRECT_URL=
              <br />
              NEXT_PUBLIC_SUPABASE_URL=
              <br />
              NEXT_PUBLIC_SUPABASE_ANON_KEY=
              <br />
              ADMIN_PASSWORD=
              <br />
              NEXT_PUBLIC_APP_URL=
            </div>
            <p>
              Confirm the database by opening <Link href="/sources" className="font-medium text-primary hover:underline">Sources / Ingestion</Link>, then checking this page’s counts and latest run panels.
            </p>
          </CardContent>
        </Card>

        <Card className="shadow-panel">
          <CardHeader>
            <CardTitle>Safety Guardrails</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <div className="flex items-start gap-2">
              <ShieldCheck className="mt-0.5 h-4 w-4 text-primary" />
              <span>Supabase Auth protects the full app, while the temporary admin password can still unlock admin-only operational controls.</span>
            </div>
            <div className="flex items-start gap-2">
              <Database className="mt-0.5 h-4 w-4 text-primary" />
              <span>Production pages should use the real database only. This admin surface never drops into mock preview on its own.</span>
            </div>
            <div className="flex items-start gap-2">
              <Link href="/review" className="font-medium text-primary hover:underline">Open Review Queue</Link>
              <span>for final human approval before anything becomes a tracked project or current show.</span>
            </div>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
