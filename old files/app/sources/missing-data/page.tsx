import Link from "next/link";
import { ArrowUpRight, CheckCircle2, Download, Filter, ShieldAlert } from "lucide-react";
import { markMissingDataFlagResolved } from "./actions";
import { Badge } from "@/components/ui/badge";
import { Button, ButtonLink } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select } from "@/components/ui/input";
import { Table, Td, Th } from "@/components/ui/table";
import {
  detectArticleMissingData,
  detectCurrentShowMissingData,
  detectProjectMissingData,
  refreshAllMissingDataFlags
} from "@/lib/data-quality";
import { mockBuyerDetails } from "@/lib/mock-buyers";
import { mockCurrentShows } from "@/lib/mock-current-tv";
import { readMockPreviewState } from "@/lib/mock-preview-store";
import { prisma } from "@/lib/prisma";
import { canUseMockPreview } from "@/lib/runtime-mode";
import { formatDate, humanize } from "@/lib/utils";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{ field?: string; severity?: string; entityType?: string }>;

type FlagRow = {
  id: string;
  entityType: string;
  entityId: string;
  missingField: string;
  severity: string;
  reason: string;
  createdAt: Date;
  resolvedAt: Date | null;
};

function severityTone(value: string) {
  if (value === "high") return "bg-rose-50 text-rose-700 ring-rose-200";
  if (value === "medium") return "bg-amber-50 text-amber-800 ring-amber-200";
  return "bg-sky-50 text-sky-700 ring-sky-200";
}

function jumpHref(flag: FlagRow) {
  if (flag.entityType === "Article") {
    return `/review?missing=${encodeURIComponent(flag.missingField)}`;
  }
  if (flag.entityType === "Project") {
    return `/projects/${flag.entityId}`;
  }
  if (flag.entityType === "CurrentShow") {
    return `/current-tv?confidence=low`;
  }
  return "/sources";
}

export default async function MissingDataPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const fieldFilter = params.field ?? "all";
  const severityFilter = params.severity ?? "all";
  const entityTypeFilter = params.entityType ?? "all";

  let flags: FlagRow[] = [];
  let dataSource: "database" | "mock" = "database";
  let errorMessage: string | null = null;

  try {
    await refreshAllMissingDataFlags();
    flags = await prisma.missingDataFlag.findMany({
      where: { resolvedAt: null },
      orderBy: [{ severity: "desc" }, { createdAt: "desc" }]
    });
  } catch (error) {
    errorMessage = error instanceof Error ? error.message : "Unknown database error.";
    dataSource = "mock";
    const preview = await readMockPreviewState().catch(() => null);
    flags = [
      ...(preview?.reviewArticles ?? []).flatMap((article, index) =>
        detectArticleMissingData(article).map((flag, nestedIndex) => ({
          id: `mock-article-${index}-${nestedIndex}`,
          ...flag,
          createdAt: new Date(),
          resolvedAt: null
        }))
      ),
      ...mockBuyerDetails.flatMap((buyer, index) =>
        buyer.projects.flatMap((project, nestedIndex) =>
          detectProjectMissingData({
            id: project.id,
            buyerId: buyer.id,
            networkOrPlatform: buyer.name,
            studioId: project.studio ? project.studio : null,
            sourceUrl: project.sourceUrl,
            confidenceLevel: project.status === "stale" ? "low" : "medium",
            productionCompanies: project.productionCompanies
          }).map((flag, flagIndex) => ({
            id: `mock-project-${index}-${nestedIndex}-${flagIndex}`,
            ...flag,
            createdAt: new Date(),
            resolvedAt: null
          }))
        )
      ),
      ...mockCurrentShows.flatMap((show, index) =>
        detectCurrentShowMissingData({
          id: show.id,
          premiereDate: show.premiereDate ? new Date(show.premiereDate) : null,
          sourceUrl: show.sourceUrl,
          confidenceLevel: show.confidenceLevel,
          productionCompanies: show.productionCompanies
        }).map((flag, nestedIndex) => ({
          id: `mock-show-${index}-${nestedIndex}`,
          ...flag,
          createdAt: new Date(),
          resolvedAt: null
        }))
      )
    ];
  }

  const filteredFlags = flags.filter((flag) => {
    if (fieldFilter !== "all" && flag.missingField !== fieldFilter) return false;
    if (severityFilter !== "all" && flag.severity !== severityFilter) return false;
    if (entityTypeFilter !== "all" && flag.entityType !== entityTypeFilter) return false;
    return true;
  });

  const uniqueFields = Array.from(new Set(flags.map((flag) => flag.missingField))).sort();
  const uniqueEntities = Array.from(new Set(flags.map((flag) => flag.entityType))).sort();

  return (
    <div className="space-y-6">
      <section className="rounded-lg border bg-white p-6 shadow-panel">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-primary">Data Quality Monitor</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight">Missing Data</h1>
            <p className="mt-3 max-w-3xl text-muted-foreground">
              Make coverage gaps visible: missing buyers, missing studios, missing premiere dates, weak source traces, low-confidence records, and headline-only extractions.
            </p>
          </div>
          <Badge className={dataSource === "database" ? "bg-emerald-50 text-emerald-700 ring-emerald-200" : "bg-amber-50 text-amber-800 ring-amber-200"}>
            Data Source: {dataSource === "database" ? "Database" : "Mock Preview Data"}
          </Badge>
        </div>
        {errorMessage ? (
          <div className="mt-4 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
            {canUseMockPreview() ? `Preview missing-data view is active because the database monitor could not be read: ${errorMessage}` : errorMessage}
          </div>
        ) : null}
      </section>

      <section className="grid gap-4 md:grid-cols-4">
        <Card className="shadow-panel"><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Open Flags</CardTitle></CardHeader><CardContent><div className="text-3xl font-semibold">{flags.length}</div></CardContent></Card>
        <Card className="shadow-panel"><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">High Severity</CardTitle></CardHeader><CardContent><div className="text-3xl font-semibold">{flags.filter((flag) => flag.severity === "high").length}</div></CardContent></Card>
        <Card className="shadow-panel"><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Headline-only</CardTitle></CardHeader><CardContent><div className="text-3xl font-semibold">{flags.filter((flag) => flag.missingField === "headline_only").length}</div></CardContent></Card>
        <Card className="shadow-panel"><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Missing Body Text</CardTitle></CardHeader><CardContent><div className="text-3xl font-semibold">{flags.filter((flag) => flag.missingField === "body_text").length}</div></CardContent></Card>
      </section>

      <Card className="shadow-panel">
        <CardHeader>
          <CardTitle>Filters</CardTitle>
        </CardHeader>
        <CardContent>
          <form className="grid gap-3 md:grid-cols-4">
            <Select name="field" defaultValue={fieldFilter}>
              <option value="all">All missing fields</option>
              {uniqueFields.map((field) => <option key={field} value={field}>{humanize(field)}</option>)}
            </Select>
            <Select name="severity" defaultValue={severityFilter}>
              <option value="all">All severities</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </Select>
            <Select name="entityType" defaultValue={entityTypeFilter}>
              <option value="all">All entity types</option>
              {uniqueEntities.map((entityType) => <option key={entityType} value={entityType}>{entityType}</option>)}
            </Select>
            <div className="flex gap-2">
              <Button type="submit"><Filter className="h-4 w-4" /> Apply</Button>
              <ButtonLink href="/api/data-quality/missing/export" variant="secondary">
                <Download className="h-4 w-4" /> Export CSV
              </ButtonLink>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card className="shadow-panel">
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <div>
            <CardTitle>Open Missing-Data Flags</CardTitle>
            <p className="text-sm text-muted-foreground">Jump straight to the record or resolve the flag once the gap is actually fixed.</p>
          </div>
          <div className="flex gap-2">
            <ButtonLink href="/sources/coverage" variant="secondary"><ShieldAlert className="h-4 w-4" /> Source Coverage</ButtonLink>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto rounded-lg border">
            <Table>
              <thead className="bg-slate-50">
                <tr>
                  <Th>Record</Th>
                  <Th>Missing Field</Th>
                  <Th>Severity</Th>
                  <Th>Reason</Th>
                  <Th>Created</Th>
                  <Th>Actions</Th>
                </tr>
              </thead>
              <tbody>
                {filteredFlags.map((flag) => (
                  <tr key={flag.id}>
                    <Td>{flag.entityType}</Td>
                    <Td>{humanize(flag.missingField)}</Td>
                    <Td><Badge className={severityTone(flag.severity)}>{humanize(flag.severity)}</Badge></Td>
                    <Td className="text-sm text-muted-foreground">{flag.reason}</Td>
                    <Td>{formatDate(flag.createdAt)}</Td>
                    <Td>
                      <div className="flex flex-wrap gap-2">
                        <Link href={jumpHref(flag)} className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline">
                          Jump <ArrowUpRight className="h-3.5 w-3.5" />
                        </Link>
                        {dataSource === "database" ? (
                          <form action={markMissingDataFlagResolved}>
                            <input type="hidden" name="id" value={flag.id} />
                            <Button type="submit" variant="ghost" className="h-auto px-0 py-0 text-sm">
                              <CheckCircle2 className="h-3.5 w-3.5" /> Resolve
                            </Button>
                          </form>
                        ) : null}
                      </div>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
