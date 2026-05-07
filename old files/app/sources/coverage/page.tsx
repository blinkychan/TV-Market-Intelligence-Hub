import Link from "next/link";
import { Activity, ArrowUpRight, Database, RefreshCcw } from "lucide-react";
import { saveSourceCoverageConfig } from "@/app/sources/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ButtonLink } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, Td, Th } from "@/components/ui/table";
import { defaultCurrentTvSources } from "@/lib/current-tv-sources";
import { mockFeeds, mockIngestionRuns } from "@/lib/mock-sources";
import { prisma } from "@/lib/prisma";
import { canUseMockPreview } from "@/lib/runtime-mode";
import { SOURCE_CONNECTORS } from "@/lib/source-connectors";
import { inferSourceReliability, sourceReliabilityTone } from "@/lib/source-reliability";
import { getCurrentUserContext } from "@/lib/team-auth";
import { formatDate, humanize } from "@/lib/utils";

export const dynamic = "force-dynamic";

type CoverageRow = {
  id: string;
  sourceName: string;
  sourceType: string;
  enabled: boolean;
  baseUrl: string | null;
  reliabilityScore: number | null;
  allowedCategories: string | null;
  blockedKeywords: string | null;
  preferredKeywords: string | null;
  lastCheckedAt: Date | null;
  lastSuccessfulFetchAt: Date | null;
  articlesFetchedLastRun: number;
  articlesSavedLastRun: number;
  articlesExcludedLastRun: number;
  highRelevanceCountLastRun: number;
  mediumRelevanceCountLastRun: number;
  lowRelevanceCountLastRun: number;
  commonExclusionReasons: string | null;
  failuresLast7Days: number;
  sourceReliability: string | null;
  notes: string | null;
};

export default async function SourceCoveragePage() {
  const auth = await getCurrentUserContext();
  let rows: CoverageRow[] = [];
  let dataSource: "database" | "mock" = "database";
  let errorMessage: string | null = null;

  try {
    rows = await prisma.sourceCoverage.findMany({
      orderBy: [{ enabled: "desc" }, { sourceName: "asc" }]
    }).then((items) =>
      items.map(
        (row): CoverageRow => ({
          id: row.id,
          sourceName: row.sourceName,
          sourceType: row.sourceType,
          enabled: row.enabled,
          baseUrl: row.baseUrl,
          reliabilityScore: row.reliabilityScore,
          allowedCategories: row.allowedCategories,
          blockedKeywords: row.blockedKeywords,
          preferredKeywords: row.preferredKeywords,
          lastCheckedAt: row.lastCheckedAt,
          lastSuccessfulFetchAt: row.lastSuccessfulFetchAt,
          articlesFetchedLastRun: row.articlesFetchedLastRun,
          articlesSavedLastRun: row.articlesSavedLastRun,
          articlesExcludedLastRun: row.articlesExcludedLastRun,
          highRelevanceCountLastRun: row.highRelevanceCountLastRun,
          mediumRelevanceCountLastRun: row.mediumRelevanceCountLastRun,
          lowRelevanceCountLastRun: row.lowRelevanceCountLastRun,
          commonExclusionReasons: row.commonExclusionReasons,
          failuresLast7Days: row.failuresLast7Days,
          sourceReliability: row.sourceReliability,
          notes: row.notes
        })
      )
    );

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
          baseUrl: null,
          reliabilityScore: null,
          allowedCategories: null,
          blockedKeywords: null,
          preferredKeywords: null,
          lastCheckedAt: feed.lastChecked,
          lastSuccessfulFetchAt: feed.lastChecked,
          articlesFetchedLastRun: 0,
          articlesSavedLastRun: 0,
          articlesExcludedLastRun: 0,
          highRelevanceCountLastRun: 0,
          mediumRelevanceCountLastRun: 0,
          lowRelevanceCountLastRun: 0,
          commonExclusionReasons: null,
          failuresLast7Days: 0,
          sourceReliability: inferSourceReliability(feed.publicationName, feed.feedUrl),
          notes: feed.category
        })),
        ...currentTvSources.map((source) => ({
          id: `tv-${source.id}`,
          sourceName: source.name,
          sourceType: source.sourceType,
          enabled: source.enabled,
          baseUrl: source.url ?? null,
          reliabilityScore: null,
          allowedCategories: source.category,
          blockedKeywords: null,
          preferredKeywords: null,
          lastCheckedAt: source.lastChecked,
          lastSuccessfulFetchAt: source.lastChecked,
          articlesFetchedLastRun: 0,
          articlesSavedLastRun: 0,
          articlesExcludedLastRun: 0,
          highRelevanceCountLastRun: 0,
          mediumRelevanceCountLastRun: 0,
          lowRelevanceCountLastRun: 0,
          commonExclusionReasons: null,
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
        baseUrl: feed.feedUrl,
        reliabilityScore: null,
        allowedCategories: feed.category,
        blockedKeywords: null,
        preferredKeywords: null,
        lastCheckedAt: feed.lastChecked,
        lastSuccessfulFetchAt: feed.lastChecked,
        articlesFetchedLastRun: mockIngestionRuns.find((run) => run.sourceName === feed.publicationName)?.itemsFetched ?? 0,
        articlesSavedLastRun: mockIngestionRuns.find((run) => run.sourceName === feed.publicationName)?.itemsSaved ?? 0,
        articlesExcludedLastRun: 0,
        highRelevanceCountLastRun: 0,
        mediumRelevanceCountLastRun: 0,
        lowRelevanceCountLastRun: 0,
        commonExclusionReasons: null,
        failuresLast7Days: mockIngestionRuns.filter((run) => run.sourceName === feed.publicationName && run.status === "failed").length,
        sourceReliability: inferSourceReliability(feed.publicationName, feed.feedUrl),
        notes: feed.category
      })),
      ...defaultCurrentTvSources.map((source) => ({
        id: source.id,
        sourceName: source.name,
        sourceType: source.sourceType,
        enabled: source.enabled,
        baseUrl: source.url ?? null,
        reliabilityScore: null,
        allowedCategories: source.category,
        blockedKeywords: null,
        preferredKeywords: null,
        lastCheckedAt: source.lastChecked ? new Date(source.lastChecked) : null,
        lastSuccessfulFetchAt: source.lastChecked ? new Date(source.lastChecked) : null,
        articlesFetchedLastRun: 0,
        articlesSavedLastRun: 0,
        articlesExcludedLastRun: 0,
        highRelevanceCountLastRun: 0,
        mediumRelevanceCountLastRun: 0,
        lowRelevanceCountLastRun: 0,
        commonExclusionReasons: null,
        failuresLast7Days: 0,
        sourceReliability: source.sourceReliability,
        notes: source.notes ?? source.category
      }))
    ];
  }

  const connectorMap = new Map(SOURCE_CONNECTORS.map((connector) => [connector.name, connector]));
  rows = rows.map((row) => {
    const connector = connectorMap.get(row.sourceName);
    return {
      ...row,
      baseUrl: row.baseUrl ?? connector?.baseUrl ?? null,
      reliabilityScore: row.reliabilityScore ?? connector?.reliabilityScore ?? null,
      allowedCategories: row.allowedCategories ?? connector?.allowedCategories.join(", ") ?? null,
      blockedKeywords: row.blockedKeywords ?? connector?.blockedKeywords.join(", ") ?? null,
      preferredKeywords: row.preferredKeywords ?? connector?.preferredKeywords.join(", ") ?? null,
      notes: row.notes ?? connector?.notes ?? null
    };
  });

  const enabledCount = rows.filter((row) => row.enabled).length;
  const failedCount = rows.filter((row) => row.failuresLast7Days > 0).length;
  const activeCount = rows.filter((row) => row.articlesSavedLastRun > 0).length;
  const totalExcluded = rows.reduce((sum, row) => sum + row.articlesExcludedLastRun, 0);

  return (
    <div className="space-y-6">
      <section className="rounded-lg border bg-white p-6 shadow-panel">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-primary">Coverage Health</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight">Source Health</h1>
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

      <section className="grid gap-4 md:grid-cols-4">
        <Card className="shadow-panel"><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Enabled Sources</CardTitle></CardHeader><CardContent><div className="text-3xl font-semibold">{enabledCount}</div></CardContent></Card>
        <Card className="shadow-panel"><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Sources With Failures</CardTitle></CardHeader><CardContent><div className="text-3xl font-semibold">{failedCount}</div></CardContent></Card>
        <Card className="shadow-panel"><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Sources Saving Articles</CardTitle></CardHeader><CardContent><div className="text-3xl font-semibold">{activeCount}</div></CardContent></Card>
        <Card className="shadow-panel"><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Excluded Last Run</CardTitle></CardHeader><CardContent><div className="text-3xl font-semibold">{totalExcluded}</div></CardContent></Card>
      </section>

      <Card className="shadow-panel">
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <div>
            <CardTitle>Source Health Grid</CardTitle>
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
                    <Th>Excluded</Th>
                    <Th>High / Med / Low</Th>
                    <Th>Failures (7d)</Th>
                    <Th>Reliability</Th>
                    <Th>Most Common Exclusion Reasons</Th>
                    <Th>Tuning</Th>
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
                      <Td>{row.articlesExcludedLastRun}</Td>
                      <Td>{row.highRelevanceCountLastRun} / {row.mediumRelevanceCountLastRun} / {row.lowRelevanceCountLastRun}</Td>
                      <Td>{row.failuresLast7Days}</Td>
                      <Td>
                        <div className="space-y-1">
                          <Badge className={sourceReliabilityTone(row.sourceReliability)}>{humanize(row.sourceReliability ?? "low")}</Badge>
                          {row.reliabilityScore != null ? <div className="text-xs text-muted-foreground">{Math.round(row.reliabilityScore * 100)} / 100</div> : null}
                        </div>
                      </Td>
                      <Td className="text-sm text-muted-foreground">{row.commonExclusionReasons ?? "—"}</Td>
                      <Td className="min-w-[24rem]">
                        <form action={saveSourceCoverageConfig} className="grid gap-2">
                          <input type="hidden" name="sourceName" value={row.sourceName} />
                          <input type="hidden" name="sourceType" value={row.sourceType} />
                          <label className="text-xs text-muted-foreground">Base URL</label>
                          <Input name="baseUrl" defaultValue={row.baseUrl ?? ""} disabled={!auth.canManageIngestion} />
                          <label className="text-xs text-muted-foreground">Allowed Categories</label>
                          <Input name="allowedCategories" defaultValue={row.allowedCategories ?? ""} disabled={!auth.canManageIngestion} />
                          <label className="text-xs text-muted-foreground">Preferred Keywords</label>
                          <Input name="preferredKeywords" defaultValue={row.preferredKeywords ?? ""} disabled={!auth.canManageIngestion} />
                          <label className="text-xs text-muted-foreground">Blocked Keywords</label>
                          <Input name="blockedKeywords" defaultValue={row.blockedKeywords ?? ""} disabled={!auth.canManageIngestion} />
                          <label className="text-xs text-muted-foreground">Reliability Score</label>
                          <Input name="reliabilityScore" type="number" min="0" max="1" step="0.01" defaultValue={row.reliabilityScore ?? ""} disabled={!auth.canManageIngestion} />
                          <label className="inline-flex items-center gap-2 text-sm">
                            <input type="checkbox" name="enabled" defaultChecked={row.enabled} disabled={!auth.canManageIngestion} />
                            <span>Enabled</span>
                          </label>
                          <Input name="notes" defaultValue={row.notes ?? ""} disabled={!auth.canManageIngestion} />
                          <Button type="submit" variant="secondary" disabled={!auth.canManageIngestion}>Save Tuning</Button>
                        </form>
                      </Td>
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
