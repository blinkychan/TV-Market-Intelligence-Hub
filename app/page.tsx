import Link from "next/link";
import { ArrowUpRight, ClipboardList, Globe2, Radar, Sparkles, TrendingUp } from "lucide-react";
import { BreakdownBars } from "@/components/charts/breakdown-bars";
import { Badge } from "@/components/ui/badge";
import { Button, ButtonLink } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input, Select } from "@/components/ui/input";
import {
  getDashboardMetrics,
  getDashboardReportInsights,
  getDashboardSnapshot,
  getDashboardTrendModules,
  getFilterSummary,
  getOpportunitySignals,
  getThisWeekSnapshot,
  type DashboardFilters,
  type DashboardProjectRecord,
  type DashboardShowRecord
} from "@/lib/dashboard-insights";
import { formatDate, humanize } from "@/lib/utils";

export const dynamic = "force-dynamic";

function cleanFilter(value?: string) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function parseFilters(params: Record<string, string | undefined>): DashboardFilters {
  return {
    from: cleanFilter(params.from),
    to: cleanFilter(params.to),
    buyer: cleanFilter(params.buyer),
    genre: cleanFilter(params.genre),
    status: cleanFilter(params.status),
    country: cleanFilter(params.country),
    type: cleanFilter(params.type),
    acquisition: cleanFilter(params.acquisition),
    coProduction: cleanFilter(params.coProduction),
    international: cleanFilter(params.international)
  };
}

export default async function DashboardPage({
  searchParams
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const params = await searchParams;
  const filters = parseFilters(params);
  const snapshot = await getDashboardSnapshot(filters);
  const metrics = getDashboardMetrics(snapshot);
  const trends = getDashboardTrendModules(snapshot);
  const thisWeek = getThisWeekSnapshot(snapshot);
  const signals = getOpportunitySignals(snapshot);
  const reportInsights = getDashboardReportInsights(snapshot);

  return (
    <div className="space-y-6">
      <section className="rounded-lg border bg-white p-6 shadow-panel">
        <div className="flex flex-col justify-between gap-5 lg:flex-row lg:items-end">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-primary">Executive Snapshot</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight">TV Market Intelligence Hub</h1>
            <p className="mt-3 max-w-3xl text-muted-foreground">
              A working market snapshot for development flow, airing schedules, buyer momentum, and review pressure.
              Signals are marked as signals and stay traceable to underlying projects, shows, and review items.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge className={snapshot.dataSource === "database" ? "bg-emerald-50 text-emerald-700 ring-emerald-200" : "bg-amber-50 text-amber-800 ring-amber-200"}>
              Data Source: {snapshot.dataSource === "database" ? "Database" : "Mock Preview Data"}
            </Badge>
            <ButtonLink href="/development">
              Open Tracker <ArrowUpRight className="h-4 w-4" />
            </ButtonLink>
          </div>
        </div>
        {snapshot.errorMessage ? (
          <div className={`mt-4 rounded-md px-3 py-2 text-sm ${snapshot.dataSource === "mock" ? "border border-amber-200 bg-amber-50 text-amber-900" : "border border-rose-200 bg-rose-50 text-rose-900"}`}>
            {snapshot.dataSource === "mock"
              ? `Preview data is active because the dashboard database could not be read: ${snapshot.errorMessage}`
              : snapshot.errorMessage}
          </div>
        ) : null}
        <div className="mt-4 text-sm text-muted-foreground">Current lens: {getFilterSummary(filters)}</div>
      </section>

      <Card className="shadow-panel">
        <CardHeader>
          <CardTitle>Dashboard Filters</CardTitle>
        </CardHeader>
        <CardContent>
          <form className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
            <Input type="date" name="from" defaultValue={filters.from ?? ""} />
            <Input type="date" name="to" defaultValue={filters.to ?? ""} />
            <Select name="buyer" defaultValue={filters.buyer ?? "all"}>
              <option value="all">All buyers</option>
              {snapshot.availableBuyers.map((buyer) => (
                <option key={buyer} value={buyer}>
                  {buyer}
                </option>
              ))}
            </Select>
            <Select name="genre" defaultValue={filters.genre ?? "all"}>
              <option value="all">All genres</option>
              {snapshot.availableGenres.map((genre) => (
                <option key={genre} value={genre}>
                  {genre}
                </option>
              ))}
            </Select>
            <Select name="status" defaultValue={filters.status ?? "all"}>
              <option value="all">All statuses</option>
              {snapshot.availableStatuses.map((status) => (
                <option key={status} value={status}>
                  {humanize(status)}
                </option>
              ))}
            </Select>
            <Select name="country" defaultValue={filters.country ?? "all"}>
              <option value="all">All countries</option>
              {snapshot.availableCountries.map((country) => (
                <option key={country} value={country}>
                  {country}
                </option>
              ))}
            </Select>
            <Select name="type" defaultValue={filters.type ?? "all"}>
              <option value="all">All project types</option>
              {snapshot.availableTypes.map((type) => (
                <option key={type} value={type}>
                  {humanize(type)}
                </option>
              ))}
            </Select>
            <Select name="acquisition" defaultValue={filters.acquisition ?? "all"}>
              <option value="all">Acquisition: All</option>
              <option value="yes">Acquisition only</option>
              <option value="no">Exclude acquisitions</option>
            </Select>
            <Select name="coProduction" defaultValue={filters.coProduction ?? "all"}>
              <option value="all">Co-production: All</option>
              <option value="yes">Co-productions only</option>
              <option value="no">Exclude co-productions</option>
            </Select>
            <Select name="international" defaultValue={filters.international ?? "all"}>
              <option value="all">International: All</option>
              <option value="yes">International only</option>
              <option value="no">Domestic only</option>
            </Select>
            <div className="flex gap-2 xl:col-span-5">
              <Button type="submit">Apply Filters</Button>
              <ButtonLink href="/" variant="ghost">Reset</ButtonLink>
            </div>
          </form>
        </CardContent>
      </Card>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        {metrics.map((metric) => (
          <Link key={metric.label} href={metric.href}>
            <Card className="h-full transition hover:shadow-panel">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-muted-foreground">{metric.label}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-semibold tracking-tight">{metric.value}</div>
                <div className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-primary">
                  Open filtered view <ArrowUpRight className="h-3.5 w-3.5" />
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </section>

      <section className="grid gap-6 xl:grid-cols-2">
        <TrendCard
          title="Buyer Activity Over Time"
          icon={TrendingUp}
          subtitle="Tracked development announcements by month inside the current dashboard lens."
          items={trends.buyerActivityOverTime}
          emptyText="No buyer activity matched the current filters."
        />
        <TrendCard
          title="Genre Activity Over Time"
          icon={ClipboardList}
          subtitle="Genre-tagged development activity over the last six rolling months."
          items={trends.genreActivityOverTime}
          emptyText="No genre activity matched the current filters."
        />
        <TrendCard
          title="Status Movement Over Time"
          icon={Radar}
          subtitle="Sold, pilot-order, series-order, renewal, and cancellation moves over time."
          items={trends.statusMovementOverTime}
          emptyText="No status movement matched the current filters."
        />
        <TrendCard
          title="Acquisition / Co-Production Activity"
          icon={Sparkles}
          subtitle="Flagged deal types in the currently filtered set."
          items={trends.acquisitionCoProductionActivity}
          emptyText="No acquisition or co-production activity matched the current filters."
        />
        <TrendCard
          title="International Activity"
          icon={Globe2}
          subtitle="International and co-production activity grouped by country of origin."
          items={trends.internationalActivity}
          emptyText="No international activity matched the current filters."
        />
        <TrendCard
          title="Most Active Buyers"
          icon={Radar}
          subtitle="Buyers with the most tracked development activity in the current lens."
          items={trends.mostActiveBuyers}
          emptyText="No buyer concentration yet."
        />
        <TrendCard
          title="Most Active Studios / Prodcos"
          icon={ClipboardList}
          subtitle="Studios and production companies showing up most often across tracked projects."
          items={trends.mostActiveStudiosProdcos}
          emptyText="No studio or prodco concentration yet."
        />
        <TrendCard
          title="Most Attached Talent / Creators"
          icon={Sparkles}
          subtitle="Most frequently attached creators and talent in the current filtered set."
          items={trends.mostAttachedTalentCreators}
          emptyText="No attachment concentration yet."
        />
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <Card className="shadow-panel">
          <CardHeader>
            <CardTitle>This Week</CardTitle>
            <p className="text-sm text-muted-foreground">Recent announcements and next-week scheduling pulled directly from tracked records.</p>
          </CardHeader>
          <CardContent className="grid gap-5 md:grid-cols-2">
            <HighlightList title="Sales Announced This Week" items={thisWeek.sales} kind="project" emptyText="No sales logged this week." />
            <HighlightList title="Pilot / Series Orders This Week" items={thisWeek.orders} kind="project" emptyText="No pilot or series orders logged this week." />
            <HighlightList title="Major Attachments" items={thisWeek.majorAttachments} kind="project" emptyText="No notable attachments logged this week." />
            <HighlightList title="Acquisitions / Co-Productions" items={thisWeek.acquisitions} kind="project" emptyText="No acquisitions or co-productions logged this week." />
            <HighlightList title="Premieres Next Week" items={thisWeek.premieresNextWeek} kind="show" emptyText="No premieres next week in the current lens." />
            <HighlightList title="Items Needing Review" items={thisWeek.reviewItems} kind="article" emptyText="No review items currently queued." />
          </CardContent>
        </Card>

        <Card className="shadow-panel">
          <CardHeader>
            <CardTitle>Opportunity Signals</CardTitle>
            <p className="text-sm text-muted-foreground">Signals are directional inferences from tracked data, not hard conclusions.</p>
          </CardHeader>
          <CardContent className="space-y-3">
            {signals.length ? (
              signals.map((signal) => (
                <Link key={signal.title} href={signal.href} className="block rounded-lg border p-4 transition hover:shadow-panel">
                  <div className="flex items-center gap-2">
                    <Badge className="bg-amber-50 text-amber-800 ring-amber-200">Signal</Badge>
                    <div className="font-medium">{signal.title}</div>
                  </div>
                  <p className="mt-2 text-sm leading-6 text-slate-700">{signal.signal}</p>
                  <div className="mt-3 text-xs text-muted-foreground">Support: {signal.support.join(", ")}</div>
                </Link>
              ))
            ) : (
              <EmptyState
                icon={Sparkles}
                title="No opportunity signals yet"
                copy="The current filter set does not clear the threshold for a directional signal. Broaden the lens or let more tracked activity accumulate."
              />
            )}
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-6 xl:grid-cols-[1fr_0.8fr]">
        <Card className="shadow-panel">
          <CardHeader>
            <CardTitle>Weekly Report Insight Preview</CardTitle>
            <p className="text-sm text-muted-foreground">These dashboard signals can flow into the weekly report so the Friday snapshot reflects the same lens.</p>
          </CardHeader>
          <CardContent>
            <pre className="max-h-[28rem] overflow-auto rounded-lg bg-slate-950 p-4 text-xs leading-6 text-slate-100">
              {reportInsights.markdown}
            </pre>
          </CardContent>
        </Card>

        <Card className="shadow-panel">
          <CardHeader>
            <CardTitle>Coverage Notes</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <p>Every card and signal above is derived from tracked projects, current-show schedules, or review-queue records already in the app.</p>
            <p>Signals are intentionally labeled as signals when they compare recent activity windows or infer buyer momentum from tracked movement.</p>
            <p>Use the filtered cards to jump straight into the underlying tracker view when you want to validate the underlying records.</p>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}

function TrendCard({
  title,
  subtitle,
  items,
  emptyText,
  icon: Icon
}: {
  title: string;
  subtitle: string;
  items: { label: string; count: number }[];
  emptyText: string;
  icon: React.ComponentType<{ className?: string }>;
}) {
  return (
    <Card className="shadow-panel">
      <CardHeader>
        <div className="flex items-center gap-2">
          <Icon className="h-4 w-4 text-primary" />
          <CardTitle>{title}</CardTitle>
        </div>
        <p className="text-sm text-muted-foreground">{subtitle}</p>
      </CardHeader>
      <CardContent>
        {items.some((item) => item.count > 0) ? (
          <BreakdownBars items={items.filter((item) => item.count > 0)} />
        ) : (
          <div className="rounded-md border border-dashed bg-slate-50 p-4 text-sm text-muted-foreground">{emptyText}</div>
        )}
      </CardContent>
    </Card>
  );
}

function HighlightList({
  title,
  items,
  kind,
  emptyText
}: {
  title: string;
  items: DashboardProjectRecord[] | DashboardShowRecord[] | Array<{ headline: string; publication: string | null; publishedDate: Date | null }>;
  kind: "project" | "show" | "article";
  emptyText: string;
}) {
  return (
    <div className="space-y-3">
      <div className="text-sm font-semibold uppercase tracking-[0.16em] text-muted-foreground">{title}</div>
      {items.length ? (
        <div className="space-y-2">
          {items.slice(0, 4).map((item) => {
            if (kind === "project") {
              const project = item as DashboardProjectRecord;
              return (
                <Link key={project.id} href={`/projects/${project.id}`} className="block rounded-md border p-3 transition hover:shadow-panel">
                  <div className="font-medium">{project.title}</div>
                  <div className="mt-1 text-sm text-muted-foreground">
                    {humanize(project.status)} · {project.buyer ?? "Unknown buyer"} · {project.genre ?? "Genre TBD"}
                  </div>
                </Link>
              );
            }

            if (kind === "show") {
              const show = item as DashboardShowRecord;
              return (
                <Link key={show.id} href={`/current-tv?view=next-week`} className="block rounded-md border p-3 transition hover:shadow-panel">
                  <div className="font-medium">{show.title}</div>
                  <div className="mt-1 text-sm text-muted-foreground">
                    {show.networkOrPlatform} · {formatDate(show.premiereDate)} · {humanize(show.seasonType ?? show.status)}
                  </div>
                </Link>
              );
            }

            const article = item as { headline: string; publication: string | null; publishedDate: Date | null };
            return (
              <Link key={article.headline} href="/review?status=Needs%20Review" className="block rounded-md border p-3 transition hover:shadow-panel">
                <div className="font-medium">{article.headline}</div>
                <div className="mt-1 text-sm text-muted-foreground">
                  {article.publication ?? "Unknown publication"} · {formatDate(article.publishedDate)}
                </div>
              </Link>
            );
          })}
        </div>
      ) : (
        <div className="rounded-md border border-dashed bg-slate-50 p-4 text-sm text-muted-foreground">{emptyText}</div>
      )}
    </div>
  );
}

function EmptyState({
  icon: Icon,
  title,
  copy
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  copy: string;
}) {
  return (
    <div className="rounded-lg border border-dashed bg-slate-50 p-8 text-center">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-white shadow-sm">
        <Icon className="h-5 w-5 text-primary" />
      </div>
      <div className="mt-4 font-medium">{title}</div>
      <p className="mt-2 text-sm text-muted-foreground">{copy}</p>
    </div>
  );
}
