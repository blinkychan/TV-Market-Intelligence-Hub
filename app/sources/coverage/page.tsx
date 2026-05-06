import Link from "next/link";
import { Activity, ArrowUpRight, Database, RefreshCcw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, Td, Th } from "@/components/ui/table";
import { defaultCurrentTvSources } from "@/lib/current-tv-sources";
import { mockFeeds, mockIngestionRuns } from "@/lib/mock-sources";
import { prisma } from "@/lib/prisma";
import { canUseMockPreview } from "@/lib/runtime-mode";
import { inferSourceReliability, sourceReliabilityTone } from "@/lib/source-reliability";
import { formatDate, humanize } from "@/lib/utils";

export const dynamic = "force-dynamic";

type CoverageRow = {
  id: string;
  sourceName: string;
  sourceType: string;
  enabled: boolean;
  lastCheckedAt: Date | null;
  lastSuccessfulFetchAt: Date | null;
  articlesFetchedLastRun: number;
  articlesSavedLastRun: number;
  failuresLast7Days: number;
  sourceReliability: string | null;
  notes: string | null;
};

export default async function SourceCoveragePage() {
  let rows: CoverageRow[] = [];
  let dataSource: "database" | "mock" = "database";
  let errorMessage: string | null = null;

  try {
    rows = await prisma.sourceCoverage.findMany({
      orderBy: [{ enabled: "desc" }, { sourceName: "asc" }]
    });

    if (!rows.length) {
      const [feeds, currentTvSources] = await Promise.all([
        prisma.rssFeed.findMany({ orderBy: { publicationName: "asc" } }),
        prisma.currentTvSource.findMany({ orderBy: { name: "asc" } })
      ]);

      rows = [
        ...feeds.map((feed) => ({
          id: `rss-${feed.id}`,
          sourceName: feed.publicationName,
          sourceType: "rss",
          enabled: feed.enabled,
          lastCheckedAt: feed.lastChecked,
          lastSuccessfulFetchAt: feed.lastChecked,
          articlesFetchedLastRun: 0,
          articlesSavedLastRun: 0,
          failuresLast7Days: 0,
          sourceReliability: inferSourceReliability(feed.publicationName, feed.feedUrl),
          notes: feed.category
        })),
        ...currentTvSources.map((source) => ({
          id: `tv-${source.id}`,
          sourceName: source.name,
          sourceType: source.sourceType,
          enabled: source.enabled,
          lastCheckedAt: source.lastChecked,
          lastSuccessfulFetchAt: source.lastChecked,
          articlesFetchedLastRun: 0,
          articlesSavedLastRun: 0,
          failuresLast7Days: 0,
          sourceReliability: source.sourceReliability,
          notes: source.notes ?? source.category
        }))
      ];
    }
  } catch (error) {
    errorMessage = error instanceof Error ? error.message : "Unknown database error.";
    dataSource = "mock";
    rows = [
      ...mockFeeds.map((feed) => ({
        id: feed.id,
        sourceName: feed.publicationName,
        sourceType: "rss",
        enabled: feed.enabled,
        lastCheckedAt: feed.lastChecked,
        lastSuccessfulFetchAt: feed.lastChecked,
        articlesFetchedLastRun: mockIngestionRuns.find((run) => run.sourceName === feed.publicationName)?.itemsFetched ?? 0,
        articlesSavedLastRun: mockIngestionRuns.find((run) => run.sourceName === feed.publicationName)?.itemsSaved ?? 0,
        failuresLast7Days: mockIngestionRuns.filter((run) => run.sourceName === feed.publicationName && run.status === "failed").length,
        sourceReliability: inferSourceReliability(feed.publicationName, feed.feedUrl),
        notes: feed.category
      })),
      ...defaultCurrentTvSources.map((source) => ({
        id: source.id,
        sourceName: source.name,
        sourceType: source.sourceType,
        enabled: source.enabled,
        lastCheckedAt: source.lastChecked ? new Date(source.lastChecked) : null,
        lastSuccessfulFetchAt: source.lastChecked ? new Date(source.lastChecked) : null,
        articlesFetchedLastRun: 0,
        articlesSavedLastRun: 0,
        failuresLast7Days: 0,
        sourceReliability: source.sourceReliability,
        notes: source.notes ?? source.category
      }))
    ];
  }

  const enabledCount = rows.filter((row) => row.enabled).length;
  const failedCount = rows.filter((row) => row.failuresLast7Days > 0).length;
  const activeCount = rows.filter((row) => row.articlesSavedLastRun > 0).length;

  return (
    <div className="space-y-6">
      <section className="rounded-lg border bg-white p-6 shadow-panel">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-primary">Coverage Health</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight">Source Coverage</h1>
            <p className="mt-3 max-w-3xl text-muted-foreground">
              Track which sources are active, which ones are failing, and where article flow is thin before gaps make it into the dashboard.
            </p>
          </div>
          <Badge className={dataSource === "database" ? "bg-emerald-50 text-emerald-700 ring-emerald-200" : "bg-amber-50 text-amber-800 ring-amber-200"}>
            Data Source: {dataSource === "database" ? "Database" : "Mock Preview Data"}
          </Badge>
        </div>
        {errorMessage ? (
          <div className="mt-4 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
            {canUseMockPreview() ? `Preview coverage is active because the database view could not be read: ${errorMessage}` : errorMessage}
          </div>
        ) : null}
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        <Card className="shadow-panel"><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Enabled Sources</CardTitle></CardHeader><CardContent><div className="text-3xl font-semibold">{enabledCount}</div></CardContent></Card>
        <Card className="shadow-panel"><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Sources With Failures</CardTitle></CardHeader><CardContent><div className="text-3xl font-semibold">{failedCount}</div></CardContent></Card>
        <Card className="shadow-panel"><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Sources Saving Articles</CardTitle></CardHeader><CardContent><div className="text-3xl font-semibold">{activeCount}</div></CardContent></Card>
      </section>

      <Card className="shadow-panel">
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <div>
            <CardTitle>Coverage Grid</CardTitle>
            <p className="text-sm text-muted-foreground">Source-level ingestion status with last checks, yield, reliability, and failure pressure.</p>
          </div>
          <div className="flex gap-2">
            <ButtonLink href="/sources"><Activity className="h-4 w-4" /> Ingestion Settings</ButtonLink>
            <ButtonLink href="/sources/missing-data" variant="secondary"><Database className="h-4 w-4" /> Missing Data</ButtonLink>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto rounded-lg border">
            <Table>
              <thead className="bg-slate-50">
                <tr>
                  <Th>Source</Th>
                  <Th>Type</Th>
                  <Th>Enabled</Th>
                  <Th>Last Checked</Th>
                  <Th>Last Success</Th>
                  <Th>Fetched</Th>
                  <Th>Saved</Th>
                  <Th>Failures (7d)</Th>
                  <Th>Reliability</Th>
                  <Th>Notes</Th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id}>
                    <Td className="font-medium">{row.sourceName}</Td>
                    <Td>{humanize(row.sourceType)}</Td>
                    <Td>{row.enabled ? "Enabled" : "Disabled"}</Td>
                    <Td>{formatDate(row.lastCheckedAt)}</Td>
                    <Td>{formatDate(row.lastSuccessfulFetchAt)}</Td>
                    <Td>{row.articlesFetchedLastRun}</Td>
                    <Td>{row.articlesSavedLastRun}</Td>
                    <Td>{row.failuresLast7Days}</Td>
                    <Td><Badge className={sourceReliabilityTone(row.sourceReliability)}>{humanize(row.sourceReliability ?? "low")}</Badge></Td>
                    <Td className="text-sm text-muted-foreground">{row.notes ?? "—"}</Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Link href="/sources" className="inline-flex items-center gap-2 text-sm font-medium text-primary hover:underline">
          Back to Sources / Ingestion <ArrowUpRight className="h-4 w-4" />
        </Link>
      </div>
    </div>
  );
}
