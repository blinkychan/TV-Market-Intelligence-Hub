"use client";

import { Fragment, useMemo, useState } from "react";
import Link from "next/link";
import { addDays, endOfMonth, isWithinInterval, startOfDay, startOfMonth } from "date-fns";
import { CalendarDays, ChevronDown, ChevronRight, ExternalLink, ListFilter, Search, Table2 } from "lucide-react";
import { Badge, StatusBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { Table, Td, Th } from "@/components/ui/table";
import { formatDate } from "@/lib/utils";

export type CurrentTvRow = {
  id: string;
  title: string;
  networkOrPlatform: string;
  buyerHref: string | null;
  premiereDate: string | null;
  finaleDate: string | null;
  seasonNumber: number | null;
  episodeCount: number | null;
  status: string;
  genre: string | null;
  studio: string | null;
  productionCompanies: string | null;
  country: string | null;
  sourceUrl: string | null;
  notes: string | null;
};

type CurrentTvTrackerProps = {
  rows: CurrentTvRow[];
  dataSource: "database" | "mock";
  errorMessage?: string;
};

const savedViews = [
  { id: "next-week", label: "Premiering Next Week" },
  { id: "new-month", label: "New This Month" },
  { id: "airing", label: "Currently Airing" },
  { id: "returning", label: "Returning Shows" },
  { id: "finales", label: "Finales" }
] as const;

function unique(values: Array<string | null>) {
  return Array.from(new Set(values.filter(Boolean) as string[])).sort();
}

function inRange(value: string | null, start: Date, end: Date) {
  if (!value) return false;
  return isWithinInterval(new Date(value), { start, end });
}

function savedViewMatches(row: CurrentTvRow, view: string, now: Date) {
  const today = startOfDay(now);
  if (view === "next-week") return inRange(row.premiereDate, today, addDays(today, 7));
  if (view === "new-month") return inRange(row.premiereDate, startOfMonth(today), endOfMonth(today));
  if (view === "airing") return row.status.toLowerCase().includes("airing");
  if (view === "returning") return row.status.toLowerCase().includes("returning") || (row.seasonNumber ?? 0) > 1;
  if (view === "finales") return row.status.toLowerCase().includes("finale") || inRange(row.finaleDate, today, addDays(today, 14));
  return true;
}

export function CurrentTvTracker({ rows, dataSource, errorMessage }: CurrentTvTrackerProps) {
  const [mode, setMode] = useState<"table" | "timeline">("table");
  const [savedView, setSavedView] = useState("airing");
  const [query, setQuery] = useState("");
  const [platform, setPlatform] = useState("all");
  const [premiereFrom, setPremiereFrom] = useState("");
  const [premiereTo, setPremiereTo] = useState("");
  const [genre, setGenre] = useState("all");
  const [studio, setStudio] = useState("all");
  const [status, setStatus] = useState("all");
  const [country, setCountry] = useState("all");
  const [expandedRows, setExpandedRows] = useState<Record<string, boolean>>({});

  const now = useMemo(() => new Date(), []);

  const filteredRows = useMemo(
    () =>
      rows.filter((row) => {
        if (!savedViewMatches(row, savedView, now)) return false;
        const haystack = [
          row.title,
          row.networkOrPlatform,
          row.genre,
          row.studio,
          row.status,
          row.productionCompanies,
          row.country,
          row.notes,
          row.sourceUrl
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        if (query && !haystack.includes(query.toLowerCase())) return false;
        if (platform !== "all" && row.networkOrPlatform !== platform) return false;
        if (genre !== "all" && row.genre !== genre) return false;
        if (studio !== "all" && row.studio !== studio) return false;
        if (status !== "all" && row.status !== status) return false;
        if (country !== "all" && row.country !== country) return false;
        if (premiereFrom && row.premiereDate && new Date(row.premiereDate) < new Date(premiereFrom)) return false;
        if (premiereTo && row.premiereDate && new Date(row.premiereDate) > new Date(premiereTo)) return false;
        return true;
      }),
    [rows, savedView, now, query, platform, genre, studio, status, country, premiereFrom, premiereTo]
  );

  const platforms = unique(rows.map((row) => row.networkOrPlatform));
  const genres = unique(rows.map((row) => row.genre));
  const studios = unique(rows.map((row) => row.studio));
  const statuses = unique(rows.map((row) => row.status));
  const countries = unique(rows.map((row) => row.country));

  const upcomingPremieres = useMemo(
    () =>
      rows
        .filter((row) => row.premiereDate && new Date(row.premiereDate) >= startOfDay(now))
        .sort((a, b) => new Date(a.premiereDate ?? 0).getTime() - new Date(b.premiereDate ?? 0).getTime())
        .slice(0, 8),
    [rows, now]
  );

  const timelineGroups = useMemo(() => {
    const groups = new Map<string, CurrentTvRow[]>();
    filteredRows
      .slice()
      .sort((a, b) => new Date(a.premiereDate ?? a.finaleDate ?? 0).getTime() - new Date(b.premiereDate ?? b.finaleDate ?? 0).getTime())
      .forEach((row) => {
        const key = formatDate(row.premiereDate ?? row.finaleDate);
        groups.set(key, [...(groups.get(key) ?? []), row]);
      });
    return Array.from(groups.entries());
  }, [filteredRows]);

  const activeSavedView = savedViews.find((view) => view.id === savedView)?.label;

  return (
    <div className="space-y-4">
      <div className="rounded-lg border bg-white p-4 shadow-panel">
        <div className="flex flex-col justify-between gap-3 xl:flex-row xl:items-center">
          <div className="flex flex-wrap gap-2">
            {savedViews.map((view) => (
              <button
                key={view.id}
                onClick={() => setSavedView(view.id)}
                className={`rounded-md px-3 py-2 text-sm font-medium transition ${
                  savedView === view.id ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-secondary"
                }`}
              >
                {view.label}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge className={dataSource === "database" ? "bg-emerald-50 text-emerald-700 ring-emerald-200" : "bg-amber-50 text-amber-800 ring-amber-200"}>
              Data Source: {dataSource === "database" ? "Database" : "Mock Preview Data"}
            </Badge>
            <Button variant={mode === "table" ? "primary" : "secondary"} onClick={() => setMode("table")} type="button">
              <Table2 className="h-4 w-4" /> Table
            </Button>
            <Button variant={mode === "timeline" ? "primary" : "secondary"} onClick={() => setMode("timeline")} type="button">
              <CalendarDays className="h-4 w-4" /> Timeline
            </Button>
          </div>
        </div>
        {errorMessage ? (
          <div className="mt-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
            Database unavailable, showing mock preview data. Detail: {errorMessage}
          </div>
        ) : null}
      </div>

      <div className="rounded-lg border bg-white p-4 shadow-panel">
        <div className="mb-3 flex items-center gap-2 text-sm font-medium">
          <ListFilter className="h-4 w-4 text-primary" /> Filters
        </div>
        <div className="grid gap-3 md:grid-cols-4 xl:grid-cols-8">
          <div className="relative md:col-span-2">
            <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              className="pl-9"
              placeholder="Search shows, platforms, studios, genres"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </div>
          <Select value={platform} onChange={(event) => setPlatform(event.target.value)}>
            <option value="all">All networks/platforms</option>
            {platforms.map((item) => <option key={item} value={item}>{item}</option>)}
          </Select>
          <Input aria-label="Premiere date from" type="date" value={premiereFrom} onChange={(event) => setPremiereFrom(event.target.value)} />
          <Input aria-label="Premiere date to" type="date" value={premiereTo} onChange={(event) => setPremiereTo(event.target.value)} />
          <Select value={genre} onChange={(event) => setGenre(event.target.value)}>
            <option value="all">All genres</option>
            {genres.map((item) => <option key={item} value={item}>{item}</option>)}
          </Select>
          <Select value={studio} onChange={(event) => setStudio(event.target.value)}>
            <option value="all">All studios</option>
            {studios.map((item) => <option key={item} value={item}>{item}</option>)}
          </Select>
          <Select value={status} onChange={(event) => setStatus(event.target.value)}>
            <option value="all">All statuses</option>
            {statuses.map((item) => <option key={item} value={item}>{item}</option>)}
          </Select>
          <Select value={country} onChange={(event) => setCountry(event.target.value)}>
            <option value="all">All countries</option>
            {countries.map((item) => <option key={item} value={item}>{item}</option>)}
          </Select>
        </div>
      </div>

      <div className="rounded-lg border bg-white p-4 shadow-panel">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <h2 className="font-semibold">Upcoming Premieres</h2>
            <p className="text-sm text-muted-foreground">A quick schedule strip for executive scanning.</p>
          </div>
          <div className="text-sm font-medium">{upcomingPremieres.length} upcoming</div>
        </div>
        {upcomingPremieres.length ? (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {upcomingPremieres.map((show) => (
              <div key={show.id} className="rounded-md border bg-slate-50 p-3">
                <div className="text-xs font-semibold uppercase text-primary">{formatDate(show.premiereDate)}</div>
                <div className="mt-1 font-semibold">{show.title}</div>
                <div className="mt-1 text-sm text-muted-foreground"><BuyerName show={show} /> · {show.genre ?? "Genre TBD"}</div>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState title="No upcoming premieres" copy="Add premiere dates or adjust the seeded dates to populate this strip." />
        )}
      </div>

      {mode === "table" ? (
        <div className="overflow-hidden rounded-lg border bg-white shadow-panel">
          <div className="flex items-center justify-between border-b bg-slate-50 px-4 py-3">
            <div className="text-sm font-medium">{filteredRows.length} shows shown</div>
            <div className="text-xs text-muted-foreground">Saved view: {activeSavedView}</div>
          </div>
          {filteredRows.length ? (
            <div className="overflow-x-auto">
              <Table>
                <thead className="bg-white">
                  <tr>
                    <Th />
                    <Th>Show</Th>
                    <Th>Network / Platform</Th>
                    <Th>Premiere</Th>
                    <Th>Finale</Th>
                    <Th>Season</Th>
                    <Th>Status</Th>
                    <Th>Genre</Th>
                    <Th>Studio</Th>
                    <Th>Country</Th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRows.map((show) => (
                    <Fragment key={show.id}>
                      <tr className="hover:bg-slate-50">
                        <Td>
                          <button
                            className="rounded p-1 transition hover:bg-muted"
                            onClick={() => setExpandedRows((current) => ({ ...current, [show.id]: !current[show.id] }))}
                            aria-label={expandedRows[show.id] ? "Collapse row" : "Expand row"}
                          >
                            {expandedRows[show.id] ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                          </button>
                        </Td>
                        <Td>
                          <div className="font-semibold">{show.title}</div>
                          <div className="mt-1 text-xs text-muted-foreground">{show.productionCompanies ?? "Production company TBD"}</div>
                        </Td>
        <Td>
          <BuyerName show={show} strong />
        </Td>
                        <Td>{formatDate(show.premiereDate)}</Td>
                        <Td>{formatDate(show.finaleDate)}</Td>
                        <Td>{show.seasonNumber ? `Season ${show.seasonNumber}` : "TBD"}</Td>
                        <Td><StatusBadge status={show.status} /></Td>
                        <Td>{show.genre ?? "Unknown"}</Td>
                        <Td>{show.studio ?? "Unknown"}</Td>
                        <Td>{show.country ?? "Unknown"}</Td>
                      </tr>
                      {expandedRows[show.id] ? (
                        <tr>
                          <Td colSpan={10} className="bg-slate-50">
                            <ShowDetail show={show} />
                          </Td>
                        </tr>
                      ) : null}
                    </Fragment>
                  ))}
                </tbody>
              </Table>
            </div>
          ) : (
            <EmptyState title="No shows match this view" copy="Try another saved view or loosen the filters." />
          )}
        </div>
      ) : (
        <div className="rounded-lg border bg-white p-4 shadow-panel">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="font-semibold">Timeline View</h2>
              <p className="text-sm text-muted-foreground">Premieres and finales grouped by schedule date.</p>
            </div>
            <div className="text-sm font-medium">{filteredRows.length} schedule items</div>
          </div>
          {timelineGroups.length ? (
            <div className="space-y-4">
              {timelineGroups.map(([dateLabel, shows]) => (
                <div key={dateLabel} className="grid gap-3 border-l-2 border-primary/30 pl-4 md:grid-cols-[12rem_1fr]">
                  <div className="font-semibold text-primary">{dateLabel}</div>
                  <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                    {shows.map((show) => (
                      <div key={show.id} className="rounded-md border bg-slate-50 p-3">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div className="font-medium">{show.title}</div>
                            <div className="mt-1 text-xs text-muted-foreground"><BuyerName show={show} /> · {show.genre ?? "Genre TBD"}</div>
                          </div>
                          <StatusBadge status={show.status} />
                        </div>
                        <div className="mt-3 text-xs text-muted-foreground">
                          Premiere {formatDate(show.premiereDate)} · Finale {formatDate(show.finaleDate)}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState title="No timeline items" copy="There are no shows in the selected saved view and filter set." />
          )}
        </div>
      )}
    </div>
  );
}

function ShowDetail({ show }: { show: CurrentTvRow }) {
  return (
    <div className="grid gap-4 md:grid-cols-4">
      <div className="md:col-span-2">
        <div className="text-xs font-semibold uppercase text-muted-foreground">Logline / Notes</div>
        <p className="mt-1 text-sm leading-6">{show.notes ?? "No notes or logline logged yet."}</p>
      </div>
      <DetailItem label="Season" value={show.seasonNumber ? `Season ${show.seasonNumber}` : "TBD"} />
      <DetailItem label="Episodes" value={show.episodeCount?.toString() ?? "TBD"} />
      <DetailItem label="Studio" value={show.studio ?? "Unknown"} />
      <DetailItem label="Production Companies" value={show.productionCompanies ?? "Unknown"} />
      <DetailItem label="Country" value={show.country ?? "Unknown"} />
      <div>
        <div className="text-xs font-semibold uppercase text-muted-foreground">Source URL</div>
        {show.sourceUrl ? (
          <a className="mt-1 inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline" href={show.sourceUrl} target="_blank" rel="noreferrer">
            Open source <ExternalLink className="h-3.5 w-3.5" />
          </a>
        ) : (
          <p className="mt-1 text-sm">No source URL logged.</p>
        )}
      </div>
    </div>
  );
}

function BuyerName({ show, strong = false }: { show: CurrentTvRow; strong?: boolean }) {
  const className = strong ? "font-medium text-primary hover:underline" : "text-primary hover:underline";
  return show.buyerHref ? (
    <Link className={className} href={show.buyerHref}>
      {show.networkOrPlatform}
    </Link>
  ) : (
    <span>{show.networkOrPlatform}</span>
  );
}

function DetailItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs font-semibold uppercase text-muted-foreground">{label}</div>
      <p className="mt-1 text-sm">{value}</p>
    </div>
  );
}

function EmptyState({ title, copy }: { title: string; copy: string }) {
  return (
    <div className="rounded-lg border border-dashed bg-slate-50 p-8 text-center">
      <div className="font-semibold">{title}</div>
      <p className="mt-2 text-sm text-muted-foreground">{copy}</p>
    </div>
  );
}
