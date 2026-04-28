import Link from "next/link";
import { Activity, Database, FileText, Plus, Radio, Upload } from "lucide-react";
import { addManualArticle, runMockRssIngestion, runRssIngestion, saveRssFeed } from "./actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, Td, Th } from "@/components/ui/table";
import { readMockPreviewState } from "@/lib/mock-preview-store";
import { mockFeeds, mockIngestionRuns } from "@/lib/mock-sources";
import { prisma } from "@/lib/prisma";
import { formatDate, humanize } from "@/lib/utils";

export const dynamic = "force-dynamic";

type FeedRecord = {
  id: string;
  publicationName: string;
  feedUrl: string;
  category: string;
  enabled: boolean;
  lastChecked: Date | null;
};

type RunRecord = {
  id: string;
  sourceType: string;
  sourceName: string | null;
  status: string;
  itemsFetched: number;
  itemsSaved: number;
  itemsSkipped: number;
  startedAt: Date;
  completedAt: Date | null;
  notes: string | null;
};

export default async function SourcesPage() {
  let dataSource: "database" | "mock" = "database";
  let feeds: FeedRecord[] = [];
  let history: RunRecord[] = [];

  try {
    const [dbFeeds, dbHistory] = await Promise.all([
      prisma.rssFeed.findMany({ orderBy: [{ enabled: "desc" }, { publicationName: "asc" }] }),
      prisma.ingestionRun.findMany({ orderBy: { startedAt: "desc" }, take: 10 })
    ]);

    feeds = dbFeeds;
    history = dbHistory;
  } catch {
    dataSource = "mock";
    feeds = mockFeeds;
    history = (await readMockPreviewState().catch(() => null))?.ingestionRuns ?? mockIngestionRuns;
  }

  const totalFeeds = feeds.length;
  const enabledFeeds = feeds.filter((feed) => feed.enabled).length;
  const networkPressFeeds = feeds.filter((feed) => feed.category.toLowerCase().includes("press")).length;
  const latestRssRun = history.find((run) => run.sourceType === "rss" || run.sourceType === "rss_mock" || run.sourceType === "rss_placeholder");

  return (
    <div className="space-y-6">
      <section className="rounded-lg border bg-white p-6 shadow-panel">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-primary">Source Management</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight">Sources / Ingestion Settings</h1>
            <p className="mt-3 max-w-3xl text-muted-foreground">
              Set up feed coverage, stage manual URLs, and capture backfill requests so incoming market intelligence has a clean home when ingestion is turned on.
            </p>
          </div>
          <Badge className={dataSource === "database" ? "bg-emerald-50 text-emerald-700 ring-emerald-200" : "bg-amber-50 text-amber-800 ring-amber-200"}>
            Data Source: {dataSource === "database" ? "Database" : "Mock Preview Data"}
          </Badge>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        <Card className="shadow-panel">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Configured Feeds</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-semibold">{totalFeeds}</div>
            <p className="mt-2 text-sm text-muted-foreground">Trade and press-source endpoints staged for future ingestion.</p>
          </CardContent>
        </Card>
        <Card className="shadow-panel">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Enabled Feeds</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-semibold">{enabledFeeds}</div>
            <p className="mt-2 text-sm text-muted-foreground">Active monitoring coverage once RSS runs are switched on.</p>
          </CardContent>
        </Card>
        <Card className="shadow-panel">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Network Press Sites</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-semibold">{networkPressFeeds}</div>
            <p className="mt-2 text-sm text-muted-foreground">Press-office endpoints reserved for schedule and pickup announcements.</p>
          </CardContent>
        </Card>
      </section>

      <div className="grid gap-6 xl:grid-cols-[1.35fr_0.65fr]">
        <Card className="shadow-panel">
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <div>
              <CardTitle>RSS Feeds</CardTitle>
              <p className="text-sm text-muted-foreground">Editable local feed registry with metadata-only RSS ingestion for article routing.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <form action={runRssIngestion}>
                <Button type="submit" variant="secondary" disabled={dataSource === "mock"}>
                  <Radio className="h-4 w-4" /> Run RSS Ingestion
                </Button>
              </form>
              <form action={runMockRssIngestion}>
                <Button type="submit">
                  <Activity className="h-4 w-4" /> Run Mock Ingestion
                </Button>
              </form>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 rounded-lg border bg-slate-50 p-4 md:grid-cols-4">
              <div>
                <div className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Last Run</div>
                <div className="mt-2 text-sm font-medium">{latestRssRun ? formatDate(latestRssRun.completedAt ?? latestRssRun.startedAt) : "No runs yet"}</div>
              </div>
              <div>
                <div className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Fetched</div>
                <div className="mt-2 text-sm font-medium">{latestRssRun?.itemsFetched ?? 0}</div>
              </div>
              <div>
                <div className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Saved</div>
                <div className="mt-2 text-sm font-medium">{latestRssRun?.itemsSaved ?? 0}</div>
              </div>
              <div>
                <div className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Skipped</div>
                <div className="mt-2 text-sm font-medium">{latestRssRun?.itemsSkipped ?? 0}</div>
              </div>
            </div>
            {feeds.length ? (
              <div className="overflow-x-auto rounded-lg border">
                <Table>
                  <thead className="bg-slate-50">
                    <tr>
                      <Th>Publication</Th>
                      <Th>Feed URL</Th>
                      <Th>Category</Th>
                      <Th>Enabled</Th>
                      <Th>Last Checked</Th>
                      <Th className="w-28">Action</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {feeds.map((feed) => {
                      const formId = `feed-form-${feed.id}`;

                      return (
                        <tr key={feed.id}>
                          <Td className="min-w-44">
                            <Input form={formId} name="publicationName" defaultValue={feed.publicationName} disabled={dataSource === "mock"} />
                          </Td>
                          <Td className="min-w-80">
                            <Input form={formId} name="feedUrl" defaultValue={feed.feedUrl} disabled={dataSource === "mock"} />
                          </Td>
                          <Td className="min-w-40">
                            <Input form={formId} name="category" defaultValue={feed.category} disabled={dataSource === "mock"} />
                          </Td>
                          <Td>
                            <label className="inline-flex items-center gap-2 text-sm">
                              <input form={formId} type="checkbox" name="enabled" defaultChecked={feed.enabled} disabled={dataSource === "mock"} />
                              <span>{feed.enabled ? "On" : "Off"}</span>
                            </label>
                          </Td>
                          <Td className="text-sm text-muted-foreground">{formatDate(feed.lastChecked)}</Td>
                          <Td>
                            <form id={formId} action={saveRssFeed}>
                              <input type="hidden" name="id" value={feed.id} />
                              <Button type="submit" variant="ghost" className="w-full" disabled={dataSource === "mock"}>
                                Save
                              </Button>
                            </form>
                          </Td>
                        </tr>
                      );
                    })}
                  </tbody>
                </Table>
              </div>
            ) : (
              <div className="rounded-lg border border-dashed bg-slate-50 p-8 text-center text-sm text-muted-foreground">
                No RSS feeds configured yet. Add a feed below to establish your local source registry.
              </div>
            )}

            <form action={saveRssFeed} className="grid gap-3 rounded-lg border bg-slate-50 p-4 md:grid-cols-[1fr_1.4fr_0.7fr_auto]">
              <Input name="publicationName" placeholder="Publication name" disabled={dataSource === "mock"} />
              <Input name="feedUrl" placeholder="https://example.com/feed.xml" disabled={dataSource === "mock"} />
              <Input name="category" placeholder="Category" disabled={dataSource === "mock"} />
              <Button type="submit" disabled={dataSource === "mock"}>
                <Plus className="h-4 w-4" /> Add Feed
              </Button>
            </form>

            {dataSource === "mock" ? (
              <p className="text-sm text-amber-800">
                Preview mode uses a local mock ingestion store. Feed edits are still disabled, but mock runs will add articles to the Review Queue.
              </p>
            ) : null}
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card className="shadow-panel">
            <CardHeader>
              <CardTitle>Manual Article URL Entry</CardTitle>
              <p className="text-sm text-muted-foreground">Queue individual trade links for later review without scraping or extraction.</p>
            </CardHeader>
            <CardContent>
              <form action={addManualArticle} className="space-y-3">
                <Input name="url" type="url" placeholder="https://publication.example/story" />
                <Input name="publication" placeholder="Publication (optional)" />
                <textarea
                  name="notes"
                  rows={4}
                  placeholder="Quick note for the review queue"
                  className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                />
                <Button type="submit" className="w-full">
                  <FileText className="h-4 w-4" /> Add to Review Queue
                </Button>
              </form>
            </CardContent>
          </Card>

          <Card className="shadow-panel">
            <CardHeader>
              <CardTitle>CSV Import</CardTitle>
              <p className="text-sm text-muted-foreground">File-based import is staged here, but processing is intentionally deferred.</p>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="rounded-lg border border-dashed bg-slate-50 p-5 text-sm text-muted-foreground">
                Use this drop zone later for editorial exports, article trackers, or old development slates.
              </div>
              <Input type="file" disabled />
              <Button type="button" variant="secondary" className="w-full" disabled>
                <Upload className="h-4 w-4" /> CSV import coming next
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
        <Card className="shadow-panel">
          <CardHeader>
            <CardTitle>Backfill Queue</CardTitle>
            <p className="text-sm text-muted-foreground">Process historical coverage in small monthly batches with a safe one-job-at-a-time queue.</p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-lg border bg-slate-50 p-4 text-sm text-muted-foreground">
              Generate month-sized jobs by source, date range, keyword set, and category. Each run processes only the next queued batch and routes saved articles into the review queue.
            </div>
            <Link
              href="/sources/backfill"
              className="inline-flex h-9 items-center justify-center gap-2 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground transition hover:bg-primary/90"
            >
              Open Backfill Queue
            </Link>
          </CardContent>
        </Card>

        <Card className="shadow-panel">
          <CardHeader>
            <CardTitle>Ingestion History</CardTitle>
            <p className="text-sm text-muted-foreground">Run history, manual submissions, and saved backfill drafts all land here.</p>
          </CardHeader>
          <CardContent>
            {history.length ? (
              <div className="overflow-x-auto rounded-lg border">
                <Table>
                  <thead className="bg-slate-50">
                    <tr>
                      <Th>Source</Th>
                      <Th>Status</Th>
                      <Th>Fetched</Th>
                      <Th>Saved</Th>
                      <Th>Skipped</Th>
                      <Th>Started</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {history.map((run) => (
                      <tr key={run.id}>
                        <Td>
                          <div className="font-medium">{run.sourceName || humanize(run.sourceType)}</div>
                          <div className="mt-1 text-xs text-muted-foreground">{run.notes || humanize(run.sourceType)}</div>
                        </Td>
                        <Td>
                          <Badge className={run.status === "completed" ? "bg-emerald-50 text-emerald-700 ring-emerald-200" : run.status === "queued" ? "bg-sky-50 text-sky-700 ring-sky-200" : "bg-amber-50 text-amber-800 ring-amber-200"}>
                            {humanize(run.status)}
                          </Badge>
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
                No ingestion history yet. Once feeds, manual URLs, or backfill drafts are saved, the history table will populate here.
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="shadow-panel">
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <div>
            <CardTitle>Foundation Notes</CardTitle>
            <p className="text-sm text-muted-foreground">This pass adds metadata-only RSS ingestion. Full scraping and AI extraction remain intentionally out of scope.</p>
          </div>
          <Database className="h-5 w-5 text-primary" />
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-3">
          <div className="rounded-lg border bg-slate-50 p-4 text-sm text-muted-foreground">
            RSS runs fetch only metadata and links, apply a simple relevance filter, and route matching items into the review queue.
          </div>
          <div className="rounded-lg border bg-slate-50 p-4 text-sm text-muted-foreground">
            Manual URLs create review-ready article placeholders without scraping or full-text storage.
          </div>
          <div className="rounded-lg border bg-slate-50 p-4 text-sm text-muted-foreground">
            Historical backfill now runs through a slow queue, one batch at a time, so review stays manageable and infrastructure costs stay low.
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
