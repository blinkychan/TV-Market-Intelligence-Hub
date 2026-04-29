"use client";

import { Fragment, useMemo, useState, type ChangeEvent } from "react";
import Link from "next/link";
import { addDays, endOfMonth, format, isWithinInterval, startOfDay, startOfMonth } from "date-fns";
import { CalendarDays, CheckCircle2, ChevronDown, ChevronRight, ExternalLink, FileSpreadsheet, ListFilter, Search, ShieldAlert, Table2 } from "lucide-react";
import { flagPremiereConflictAction, importCurrentShowsCsvAction, markPremiereVerifiedAction, saveCurrentShowAction } from "@/app/current-tv/actions";
import type { AuditLogEntry } from "@/lib/audit";
import type { TeamNoteRecord } from "@/lib/team-notes";
import { SavedViewsPanel } from "@/components/shared/saved-views-panel";
import { Badge, StatusBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { TeamNotesPanel } from "@/components/shared/team-notes-panel";
import { Table, Td, Th } from "@/components/ui/table";
import type { CurrentTvSourceRecord } from "@/lib/current-tv-sources";
import type { SavedViewRecord } from "@/lib/saved-views";
import { cn, formatDate, humanize } from "@/lib/utils";

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
  sourceType?: string | null;
  sourceReliability?: string | null;
  seasonType?: string | null;
  premiereTime?: string | null;
  episodeTitle?: string | null;
  episodeNumber?: number | null;
  airPattern?: string | null;
  verifiedAt?: string | null;
  needsVerification?: boolean;
  sourceUrl: string | null;
  notes: string | null;
  auditHistory?: AuditLogEntry[];
  teamNotes?: TeamNoteRecord[];
};

type CurrentTvTrackerProps = {
  rows: CurrentTvRow[];
  sources: CurrentTvSourceRecord[];
  dataSource: "database" | "mock";
  errorMessage?: string;
  canEdit: boolean;
  currentUserEmail?: string | null;
  canManageAllNotes?: boolean;
  savedViewsData?: SavedViewRecord[];
  canCreateTeamView?: boolean;
  canManageAllSavedViews?: boolean;
};

const savedViews = [
  { id: "next-week", label: "Premiering Next Week" },
  { id: "new-month", label: "New This Month" },
  { id: "airing", label: "Currently Airing" },
  { id: "returning", label: "Returning Shows" },
  { id: "finales", label: "Finales" }
] as const;

const calendarWindows = [
  { id: "week", label: "Weekly" },
  { id: "month", label: "Monthly" },
  { id: "7days", label: "Next 7 Days" },
  { id: "30days", label: "Next 30 Days" }
] as const;

type CsvPreviewState = {
  headers: string[];
  rows: string[][];
  mapping: Record<string, string>;
  fileName: string;
  validation: string[];
};

function unique(values: Array<string | null | undefined>) {
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
  if (view === "returning") return row.seasonType === "returning_series" || row.status.toLowerCase().includes("returning") || (row.seasonNumber ?? 0) > 1;
  if (view === "finales") return row.seasonType === "finale" || row.status.toLowerCase().includes("finale") || inRange(row.finaleDate, today, addDays(today, 14));
  return true;
}

function sourceReliabilityTone(value?: string | null) {
  if (value === "high") return "bg-emerald-50 text-emerald-700 ring-emerald-200";
  if (value === "medium") return "bg-amber-50 text-amber-800 ring-amber-200";
  return "bg-slate-100 text-slate-700 ring-slate-200";
}

function seasonTypeTone(value?: string | null) {
  if (value === "new_series") return "bg-sky-50 text-sky-700 ring-sky-200";
  if (value === "returning_series") return "bg-indigo-50 text-indigo-700 ring-indigo-200";
  if (value === "limited_series") return "bg-violet-50 text-violet-700 ring-violet-200";
  if (value === "special") return "bg-amber-50 text-amber-800 ring-amber-200";
  if (value === "finale") return "bg-rose-50 text-rose-700 ring-rose-200";
  return "bg-slate-100 text-slate-700 ring-slate-200";
}

function parseCsvLine(line: string) {
  const values: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    if (char === "\"") {
      if (inQuotes && line[index + 1] === "\"") {
        current += "\"";
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }
    if (char === "," && !inQuotes) {
      values.push(current.trim());
      current = "";
      continue;
    }
    current += char;
  }

  values.push(current.trim());
  return values;
}

function guessMapping(headers: string[]) {
  const normalized = headers.map((header) => header.toLowerCase().replace(/[^a-z0-9]+/g, ""));
  const findKey = (candidates: string[]) => headers[normalized.findIndex((header) => candidates.includes(header))] ?? "";

  return {
    title: findKey(["title", "showtitle", "series"]),
    networkOrPlatform: findKey(["network", "platform", "networkplatform", "networkorplatform"]),
    premiereDate: findKey(["premieredate", "premiere"]),
    finaleDate: findKey(["finaledate", "finale"]),
    seasonNumber: findKey(["seasonnumber", "season"]),
    episodeCount: findKey(["episodecount", "episodes"]),
    status: findKey(["status"]),
    genre: findKey(["genre"]),
    studio: findKey(["studio"]),
    productionCompanies: findKey(["productioncompanies", "productioncompany", "prodcos"]),
    country: findKey(["country"]),
    seasonType: findKey(["seasontype"]),
    sourceUrl: findKey(["sourceurl", "url"]),
    notes: findKey(["notes", "summary"])
  };
}

function buildCalendarWindow(windowId: string, now: Date) {
  const start = startOfDay(now);
  if (windowId === "month") {
    return { start, end: endOfMonth(now) };
  }
  if (windowId === "30days") {
    return { start, end: addDays(start, 30) };
  }
  if (windowId === "week") {
    return { start, end: addDays(start, 6) };
  }
  return { start, end: addDays(start, 7) };
}

function BuyerName({ show, strong = false }: { show: CurrentTvRow; strong?: boolean }) {
  if (!show.buyerHref) return <span className={strong ? "font-medium" : undefined}>{show.networkOrPlatform}</span>;

  return (
    <Link href={show.buyerHref} className={cn("text-primary hover:underline", strong && "font-medium")}>
      {show.networkOrPlatform}
    </Link>
  );
}

export function CurrentTvTracker({
  rows,
  sources,
  dataSource,
  errorMessage,
  canEdit,
  currentUserEmail,
  canManageAllNotes,
  savedViewsData = [],
  canCreateTeamView = false,
  canManageAllSavedViews = false
}: CurrentTvTrackerProps) {
  const [mode, setMode] = useState<"table" | "calendar">("table");
  const [savedView, setSavedView] = useState("airing");
  const [calendarWindow, setCalendarWindow] = useState("week");
  const [query, setQuery] = useState("");
  const [platform, setPlatform] = useState("all");
  const [premiereFrom, setPremiereFrom] = useState("");
  const [premiereTo, setPremiereTo] = useState("");
  const [genre, setGenre] = useState("all");
  const [studio, setStudio] = useState("all");
  const [status, setStatus] = useState("all");
  const [country, setCountry] = useState("all");
  const [expandedRows, setExpandedRows] = useState<Record<string, boolean>>({});
  const [csvPreview, setCsvPreview] = useState<CsvPreviewState | null>(null);
  const now = useMemo(() => new Date(), []);

  function applySavedView(view: SavedViewRecord) {
    const filters = (view.filtersJson ?? {}) as Record<string, unknown>;
    setMode(String(filters.mode ?? "table") === "calendar" ? "calendar" : "table");
    setSavedView(String(filters.savedView ?? "airing"));
    setCalendarWindow(String(filters.calendarWindow ?? "week"));
    setQuery(String(filters.query ?? ""));
    setPlatform(String(filters.platform ?? "all"));
    setPremiereFrom(String(filters.premiereFrom ?? ""));
    setPremiereTo(String(filters.premiereTo ?? ""));
    setGenre(String(filters.genre ?? "all"));
    setStudio(String(filters.studio ?? "all"));
    setStatus(String(filters.status ?? "all"));
    setCountry(String(filters.country ?? "all"));
  }

  const calendarRange = useMemo(() => buildCalendarWindow(calendarWindow, now), [calendarWindow, now]);

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

  const calendarRows = useMemo(
    () =>
      filteredRows.filter((row) => {
        const primaryDate = row.premiereDate ?? row.finaleDate;
        return primaryDate ? inRange(primaryDate, calendarRange.start, calendarRange.end) : false;
      }),
    [filteredRows, calendarRange]
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

  const calendarGroups = useMemo(() => {
    const groups = new Map<string, CurrentTvRow[]>();
    calendarRows
      .slice()
      .sort((a, b) => new Date(a.premiereDate ?? a.finaleDate ?? 0).getTime() - new Date(b.premiereDate ?? b.finaleDate ?? 0).getTime())
      .forEach((row) => {
        const key = formatDate(row.premiereDate ?? row.finaleDate);
        groups.set(key, [...(groups.get(key) ?? []), row]);
      });
    return Array.from(groups.entries());
  }, [calendarRows]);

  const activeSavedView = savedViews.find((view) => view.id === savedView)?.label;
  const verificationCount = rows.filter((row) => row.needsVerification).length;
  const enabledSources = sources.filter((source) => source.enabled).length;

  async function handleCsvFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) {
      setCsvPreview(null);
      return;
    }

    const text = await file.text();
    const lines = text.split(/\r?\n/).filter((line) => line.trim());
    if (lines.length < 2) {
      setCsvPreview({
        headers: [],
        rows: [],
        mapping: {},
        fileName: file.name,
        validation: ["CSV needs a header row and at least one data row."]
      });
      return;
    }

    const headers = parseCsvLine(lines[0]);
    const rowsPreview = lines.slice(1).map(parseCsvLine);
    const mapping = guessMapping(headers);
    const validation: string[] = [];

    if (!mapping.title) validation.push("Map a title column before importing.");
    if (!mapping.networkOrPlatform) validation.push("Map a network/platform column before importing.");
    if (!mapping.premiereDate) validation.push("Map a premiere date column before importing.");

    const premiereDateHeader = mapping.premiereDate;
    if (premiereDateHeader) {
      const premiereIndex = headers.indexOf(premiereDateHeader);
      const invalidPremiereDates = rowsPreview.filter((row) => {
        const value = row[premiereIndex];
        return value && Number.isNaN(new Date(value).getTime());
      }).length;
      if (invalidPremiereDates) {
        validation.push(`${invalidPremiereDates} row(s) have invalid premiere dates.`);
      }
    }

    const finaleDateHeader = mapping.finaleDate;
    if (finaleDateHeader) {
      const finaleIndex = headers.indexOf(finaleDateHeader);
      const invalidFinaleDates = rowsPreview.filter((row) => {
        const value = row[finaleIndex];
        return value && Number.isNaN(new Date(value).getTime());
      }).length;
      if (invalidFinaleDates) {
        validation.push(`${invalidFinaleDates} row(s) have invalid finale dates.`);
      }
    }

    setCsvPreview({
      headers,
      rows: rowsPreview,
      mapping,
      fileName: file.name,
      validation
    });
  }

  function updateCsvMapping(field: string, value: string) {
    setCsvPreview((current) => (current ? { ...current, mapping: { ...current.mapping, [field]: value } } : current));
  }

  function buildImportRowsJson() {
    if (!csvPreview) return "[]";
    const headerIndex = new Map(csvPreview.headers.map((header, index) => [header, index]));

    const getValue = (row: string[], columnName: string) => {
      const index = headerIndex.get(columnName);
      return index == null ? "" : row[index] ?? "";
    };

    const normalizedRows = csvPreview.rows
      .map((row) => ({
        title: getValue(row, csvPreview.mapping.title),
        networkOrPlatform: getValue(row, csvPreview.mapping.networkOrPlatform),
        premiereDate: getValue(row, csvPreview.mapping.premiereDate),
        finaleDate: getValue(row, csvPreview.mapping.finaleDate),
        seasonNumber: getValue(row, csvPreview.mapping.seasonNumber),
        episodeCount: getValue(row, csvPreview.mapping.episodeCount),
        status: getValue(row, csvPreview.mapping.status),
        genre: getValue(row, csvPreview.mapping.genre),
        studio: getValue(row, csvPreview.mapping.studio),
        productionCompanies: getValue(row, csvPreview.mapping.productionCompanies),
        country: getValue(row, csvPreview.mapping.country),
        seasonType: getValue(row, csvPreview.mapping.seasonType),
        sourceUrl: getValue(row, csvPreview.mapping.sourceUrl),
        notes: getValue(row, csvPreview.mapping.notes),
        sourceType: "manual_csv",
        sourceReliability: "high"
      }))
      .filter((row) => row.title && row.networkOrPlatform);

    return JSON.stringify(normalizedRows);
  }

  return (
    <div className="space-y-4">
      <SavedViewsPanel
        pageType="current_tv_tracker"
        savedViews={savedViewsData}
        returnPath="/current-tv"
        currentState={{
          filtersJson: {
            mode,
            savedView,
            calendarWindow,
            query,
            platform,
            premiereFrom,
            premiereTo,
            genre,
            studio,
            status,
            country
          }
        }}
        canCreateTeamView={canCreateTeamView}
        currentUserEmail={currentUserEmail}
        canManageAll={canManageAllSavedViews}
        canWrite={dataSource === "database"}
        onLoadView={applySavedView}
      />
      <div className="rounded-lg border bg-white p-4 shadow-panel">
        <div className="flex flex-col justify-between gap-3 xl:flex-row xl:items-center">
          <div className="flex flex-wrap gap-2">
            {savedViews.map((view) => (
              <button
                key={view.id}
                onClick={() => setSavedView(view.id)}
                className={cn(
                  "rounded-md px-3 py-2 text-sm font-medium transition",
                  savedView === view.id ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-secondary"
                )}
                type="button"
              >
                {view.label}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge className={dataSource === "database" ? "bg-emerald-50 text-emerald-700 ring-emerald-200" : "bg-amber-50 text-amber-800 ring-amber-200"}>
              Data Source: {dataSource === "database" ? "Database" : "Mock Preview Data"}
            </Badge>
            <Badge className="bg-slate-100 text-slate-700 ring-slate-200">{enabledSources} source feeds configured</Badge>
            <Badge className={verificationCount ? "bg-amber-50 text-amber-800 ring-amber-200" : "bg-emerald-50 text-emerald-700 ring-emerald-200"}>
              {verificationCount} need verification
            </Badge>
            <Button variant={mode === "table" ? "primary" : "secondary"} onClick={() => setMode("table")} type="button">
              <Table2 className="h-4 w-4" /> Table
            </Button>
            <Button variant={mode === "calendar" ? "primary" : "secondary"} onClick={() => setMode("calendar")} type="button">
              <CalendarDays className="h-4 w-4" /> Calendar
            </Button>
          </div>
        </div>
        {errorMessage ? (
          <div className="mt-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
            Database unavailable, showing mock preview data. Detail: {errorMessage}
          </div>
        ) : null}
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
        <div className="rounded-lg border bg-white p-4 shadow-panel">
          <div className="mb-3 flex items-center gap-2 text-sm font-medium">
            <ListFilter className="h-4 w-4 text-primary" /> Filters
          </div>
          <div className="grid gap-3 md:grid-cols-4 xl:grid-cols-8">
            <div className="relative md:col-span-2">
              <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input className="pl-9" placeholder="Search shows, platforms, studios, genres" value={query} onChange={(event) => setQuery(event.target.value)} />
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
          <div className="mb-3 flex items-center justify-between">
            <div>
              <h2 className="font-semibold">Current TV Data Sources</h2>
              <p className="text-sm text-muted-foreground">Official press calendars first, roundup sources second, manual CSV as the curated fallback.</p>
            </div>
          </div>
          <div className="space-y-3">
            {sources.map((source) => (
              <div key={source.id} className="rounded-md border bg-slate-50 p-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="font-medium">{source.name}</div>
                    <div className="mt-1 text-xs text-muted-foreground">{source.category} · {humanize(source.sourceType)}</div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Badge className={source.enabled ? "bg-emerald-50 text-emerald-700 ring-emerald-200" : "bg-slate-100 text-slate-700 ring-slate-200"}>
                      {source.enabled ? "Enabled" : "Standby"}
                    </Badge>
                    <Badge className={sourceReliabilityTone(source.sourceReliability)}>{humanize(source.sourceReliability ?? "low")}</Badge>
                  </div>
                </div>
                {source.url ? (
                  <a href={source.url} target="_blank" rel="noreferrer" className="mt-2 inline-flex items-center gap-1 text-sm text-primary hover:underline">
                    Source link <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                ) : null}
                {source.notes ? <p className="mt-2 text-sm text-muted-foreground">{source.notes}</p> : null}
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="rounded-lg border bg-white p-4 shadow-panel">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <h2 className="font-semibold">Upcoming Premieres</h2>
            <p className="text-sm text-muted-foreground">Quick scan of new series, returning seasons, specials, and finales.</p>
          </div>
          <div className="text-sm font-medium">{upcomingPremieres.length} upcoming</div>
        </div>
        {upcomingPremieres.length ? (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {upcomingPremieres.map((show) => (
              <div key={show.id} className="rounded-md border bg-slate-50 p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="text-xs font-semibold uppercase text-primary">{formatDate(show.premiereDate)}</div>
                  <Badge className={seasonTypeTone(show.seasonType)}>{humanize(show.seasonType ?? "scheduled")}</Badge>
                </div>
                <div className="mt-1 font-semibold">{show.title}</div>
                <div className="mt-1 text-sm text-muted-foreground"><BuyerName show={show} /> · {show.genre ?? "Genre TBD"}</div>
                <div className="mt-2 text-xs text-muted-foreground">{show.premiereTime ?? "Time TBD"} · {show.airPattern ?? "Pattern TBD"}</div>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState title="No upcoming premieres" copy="Add premiere dates or adjust the seeded dates to populate this strip." />
        )}
      </div>

      {canEdit ? (
        <div className="grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
          <form action={saveCurrentShowAction} className="rounded-lg border bg-white p-4 shadow-panel">
            <div className="mb-3 flex items-center gap-2 text-sm font-medium">
              <CheckCircle2 className="h-4 w-4 text-primary" /> Manual Current Show Entry
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <Input name="title" placeholder="Show title" required />
              <Input name="networkOrPlatform" placeholder="Network / platform" required />
              <Input name="premiereDate" type="date" />
              <Input name="finaleDate" type="date" />
              <Input name="seasonNumber" type="number" placeholder="Season" />
              <Input name="episodeCount" type="number" placeholder="Episodes" />
              <Input name="status" placeholder="Status" />
              <Select name="seasonType" defaultValue="">
                <option value="">Season type</option>
                <option value="new_series">new_series</option>
                <option value="returning_series">returning_series</option>
                <option value="limited_series">limited_series</option>
                <option value="special">special</option>
                <option value="finale">finale</option>
              </Select>
              <Input name="genre" placeholder="Genre" />
              <Input name="studio" placeholder="Studio" />
              <Input name="productionCompanies" placeholder="Production companies" className="md:col-span-2" />
              <Input name="country" placeholder="Country" />
              <Input name="premiereTime" placeholder="Premiere time" />
              <Input name="episodeTitle" placeholder="Episode title" />
              <Input name="episodeNumber" type="number" placeholder="Episode number" />
              <Input name="airPattern" placeholder="Air pattern" />
              <Input name="sourceType" placeholder="Source type" defaultValue="manual_entry" />
              <Select name="sourceReliability" defaultValue="high">
                <option value="high">high</option>
                <option value="medium">medium</option>
                <option value="low">low</option>
              </Select>
              <Input name="sourceUrl" placeholder="Source URL" className="md:col-span-2" />
            </div>
            <label className="mt-3 flex items-center gap-2 text-sm text-muted-foreground">
              <input type="checkbox" name="needsVerification" defaultChecked />
              Needs verification
            </label>
            <textarea name="notes" rows={3} placeholder="Notes" className="mt-3 w-full rounded-md border bg-background px-3 py-2 text-sm" />
            <Button type="submit" className="mt-4 w-full">Save Current Show</Button>
          </form>

          <div className="rounded-lg border bg-white p-4 shadow-panel">
            <div className="mb-3 flex items-center gap-2 text-sm font-medium">
              <FileSpreadsheet className="h-4 w-4 text-primary" /> CSV Import
            </div>
            <p className="mb-3 text-sm text-muted-foreground">
              Upload a current-show calendar, preview the rows, map columns, validate dates, then confirm import. Duplicate title + platform + premiere date rows are skipped.
            </p>
            <input type="file" accept=".csv,text/csv" onChange={handleCsvFileChange} className="block w-full text-sm" />

            {csvPreview ? (
              <div className="mt-4 space-y-4">
                <div className="rounded-md border bg-slate-50 p-3 text-sm">
                  <div className="font-medium">{csvPreview.fileName}</div>
                  <div className="mt-1 text-muted-foreground">{csvPreview.rows.length} rows detected</div>
                  {csvPreview.validation.length ? (
                    <ul className="mt-2 list-disc pl-5 text-amber-800">
                      {csvPreview.validation.map((item) => <li key={item}>{item}</li>)}
                    </ul>
                  ) : null}
                </div>

                <div className="grid gap-3 md:grid-cols-2">
                  {[
                    ["title", "Title"],
                    ["networkOrPlatform", "Network / Platform"],
                    ["premiereDate", "Premiere Date"],
                    ["finaleDate", "Finale Date"],
                    ["seasonNumber", "Season Number"],
                    ["episodeCount", "Episode Count"],
                    ["status", "Status"],
                    ["genre", "Genre"],
                    ["studio", "Studio"],
                    ["productionCompanies", "Production Companies"],
                    ["country", "Country"],
                    ["seasonType", "Season Type"],
                    ["sourceUrl", "Source URL"],
                    ["notes", "Notes"]
                  ].map(([key, label]) => (
                    <Select key={key} value={csvPreview.mapping[key] ?? ""} onChange={(event) => updateCsvMapping(key, event.target.value)}>
                      <option value="">{label}: not mapped</option>
                      {csvPreview.headers.map((header) => (
                        <option key={header} value={header}>
                          {label}: {header}
                        </option>
                      ))}
                    </Select>
                  ))}
                </div>

                <div className="overflow-x-auto rounded-lg border">
                  <Table>
                    <thead className="bg-slate-50">
                      <tr>
                        {csvPreview.headers.slice(0, 6).map((header) => <Th key={header}>{header}</Th>)}
                      </tr>
                    </thead>
                    <tbody>
                      {csvPreview.rows.slice(0, 5).map((row, rowIndex) => (
                        <tr key={`${rowIndex}-${row.join("-")}`}>
                          {row.slice(0, 6).map((cell, cellIndex) => <Td key={`${rowIndex}-${cellIndex}`}>{cell || "—"}</Td>)}
                        </tr>
                      ))}
                    </tbody>
                  </Table>
                </div>

                <form action={importCurrentShowsCsvAction}>
                  <input type="hidden" name="rowsJson" value={buildImportRowsJson()} />
                  <Button type="submit" className="w-full" disabled={csvPreview.validation.length > 0}>
                    Confirm Import
                  </Button>
                </form>
              </div>
            ) : (
              <div className="mt-4 rounded-lg border border-dashed bg-slate-50 p-6 text-center text-sm text-muted-foreground">
                Upload a CSV to preview rows and map columns.
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="rounded-lg border border-sky-200 bg-sky-50 p-4 text-sm text-sky-900 shadow-panel">
          This is currently read-only. Editors can add or update current shows, import CSV schedules, and verify premiere dates when the database is connected.
        </div>
      )}

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
                    <Th>Season Type</Th>
                    <Th>Status</Th>
                    <Th>Genre</Th>
                    <Th>Verified</Th>
                    <Th>Source</Th>
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
                            type="button"
                          >
                            {expandedRows[show.id] ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                          </button>
                        </Td>
                        <Td>
                          <div className="font-semibold">{show.title}</div>
                          <div className="mt-1 text-xs text-muted-foreground">{show.productionCompanies ?? "Production company TBD"}</div>
                        </Td>
                        <Td><BuyerName show={show} strong /></Td>
                        <Td>
                          <div>{formatDate(show.premiereDate)}</div>
                          <div className="text-xs text-muted-foreground">{show.premiereTime ?? "Time TBD"}</div>
                        </Td>
                        <Td><Badge className={seasonTypeTone(show.seasonType)}>{humanize(show.seasonType ?? "scheduled")}</Badge></Td>
                        <Td><StatusBadge status={show.status} /></Td>
                        <Td>{show.genre ?? "Unknown"}</Td>
                        <Td>
                          {show.verifiedAt ? (
                            <div className="text-sm">{formatDate(show.verifiedAt)}</div>
                          ) : (
                            <span className="text-sm text-muted-foreground">Unverified</span>
                          )}
                          {show.needsVerification ? <div className="text-xs text-amber-800">Needs check</div> : null}
                        </Td>
                        <Td>
                          <Badge className={sourceReliabilityTone(show.sourceReliability)}>{humanize(show.sourceReliability ?? "low")}</Badge>
                        </Td>
                      </tr>
                      {expandedRows[show.id] ? (
                        <tr>
                          <Td colSpan={9} className="bg-slate-50">
                            <ShowDetail
                              show={show}
                              canEdit={canEdit}
                              currentUserEmail={currentUserEmail ?? null}
                              canManageAllNotes={Boolean(canManageAllNotes)}
                              canWriteNotes={dataSource === "database"}
                            />
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
          <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="font-semibold">Premiere Calendar</h2>
              <p className="text-sm text-muted-foreground">
                Weekly and monthly schedule views for premieres, finales, returning seasons, and specials.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {calendarWindows.map((window) => (
                <Button key={window.id} type="button" variant={calendarWindow === window.id ? "primary" : "secondary"} onClick={() => setCalendarWindow(window.id)}>
                  {window.label}
                </Button>
              ))}
            </div>
          </div>

          {calendarGroups.length ? (
            <div className="space-y-4">
              {calendarGroups.map(([dateLabel, shows]) => (
                <div key={dateLabel} className="grid gap-3 border-l-2 border-primary/30 pl-4 md:grid-cols-[13rem_1fr]">
                  <div>
                    <div className="font-semibold text-primary">{dateLabel}</div>
                    <div className="mt-1 text-xs text-muted-foreground">{shows.length} item{shows.length === 1 ? "" : "s"}</div>
                  </div>
                  <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                    {shows.map((show) => (
                      <div key={show.id} className="rounded-md border bg-slate-50 p-3">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div className="font-medium">{show.title}</div>
                            <div className="mt-1 text-xs text-muted-foreground"><BuyerName show={show} /> · {show.genre ?? "Genre TBD"}</div>
                          </div>
                          <Badge className={seasonTypeTone(show.seasonType)}>{humanize(show.seasonType ?? "scheduled")}</Badge>
                        </div>
                        <div className="mt-3 text-xs text-muted-foreground">
                          {show.premiereTime ?? "Time TBD"} · {show.airPattern ?? "Pattern TBD"}
                        </div>
                        <div className="mt-2 text-xs text-muted-foreground">
                          {show.episodeTitle ? `${show.episodeTitle}${show.episodeNumber ? ` (#${show.episodeNumber})` : ""}` : "Episode detail TBD"}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState title="No calendar items" copy="There are no premieres or finales inside the selected window and filter set." />
          )}
        </div>
      )}
    </div>
  );
}

function ShowDetail({
  show,
  canEdit,
  currentUserEmail,
  canManageAllNotes,
  canWriteNotes
}: {
  show: CurrentTvRow;
  canEdit: boolean;
  currentUserEmail: string | null;
  canManageAllNotes: boolean;
  canWriteNotes: boolean;
}) {
  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-4">
        <div className="md:col-span-2">
          <div className="text-xs font-semibold uppercase text-muted-foreground">Notes</div>
          <p className="mt-1 text-sm leading-6">{show.notes ?? "No notes logged yet."}</p>
        </div>
        <DetailItem label="Season" value={show.seasonNumber ? `Season ${show.seasonNumber}` : "TBD"} />
        <DetailItem label="Episodes" value={show.episodeCount?.toString() ?? "TBD"} />
        <DetailItem label="Studio" value={show.studio ?? "Unknown"} />
        <DetailItem label="Production Companies" value={show.productionCompanies ?? "Unknown"} />
        <DetailItem label="Country" value={show.country ?? "Unknown"} />
        <DetailItem label="Air Pattern" value={show.airPattern ?? "TBD"} />
        <DetailItem label="Episode" value={show.episodeTitle ? `${show.episodeTitle}${show.episodeNumber ? ` (#${show.episodeNumber})` : ""}` : "TBD"} />
        <DetailItem label="Last Verified" value={formatDate(show.verifiedAt ?? null)} />
        <DetailItem label="Verification Status" value={show.needsVerification ? "Needs verification" : "Verified"} />
        <div>
          <div className="text-xs font-semibold uppercase text-muted-foreground">Source URL</div>
          {show.sourceUrl ? (
            <a href={show.sourceUrl} target="_blank" rel="noreferrer" className="mt-1 inline-flex items-center gap-1 text-sm text-primary hover:underline">
              Open source <ExternalLink className="h-3.5 w-3.5" />
            </a>
          ) : (
            <div className="mt-1 text-sm text-muted-foreground">No source URL</div>
          )}
        </div>
      </div>

      <div className="rounded-lg border bg-white p-4">
        <div className="text-xs font-semibold uppercase text-muted-foreground">Change History</div>
        <div className="mt-3 space-y-3">
          {show.auditHistory?.length ? (
            show.auditHistory.map((entry: AuditLogEntry) => (
              <div key={entry.id} className="rounded-md border bg-slate-50 p-3">
                <div className="text-sm font-medium">
                  {humanize(entry.action)} · {formatDate(entry.createdAt)} · {entry.changedByEmail ?? "Unknown teammate"}
                </div>
                {entry.reason ? <div className="mt-1 text-sm text-muted-foreground">{entry.reason}</div> : null}
              </div>
            ))
          ) : (
            <div className="text-sm text-muted-foreground">No current-show history logged yet.</div>
          )}
          <div className="rounded-md border border-dashed px-3 py-2 text-xs text-muted-foreground">
            Restore helper: automatic rollback is not enabled yet. Use the admin audit log to copy previous values back manually when needed.
          </div>
        </div>
      </div>

      <TeamNotesPanel
        entityType="CurrentShow"
        entityId={show.id}
        notes={show.teamNotes ?? []}
        returnPath="/current-tv"
        currentUserEmail={currentUserEmail}
        canManageAll={canManageAllNotes}
        canWrite={canWriteNotes}
      />

      {canEdit ? (
        <div className="grid gap-4 xl:grid-cols-[1fr_0.7fr]">
          <form action={saveCurrentShowAction} className="rounded-lg border bg-white p-4">
            <input type="hidden" name="id" value={show.id} />
            <div className="mb-3 text-sm font-medium">Edit Current Show</div>
            <div className="grid gap-3 md:grid-cols-2">
              <Input name="title" defaultValue={show.title} />
              <Input name="networkOrPlatform" defaultValue={show.networkOrPlatform} />
              <Input name="premiereDate" type="date" defaultValue={show.premiereDate ? show.premiereDate.slice(0, 10) : ""} />
              <Input name="finaleDate" type="date" defaultValue={show.finaleDate ? show.finaleDate.slice(0, 10) : ""} />
              <Input name="seasonNumber" type="number" defaultValue={show.seasonNumber ?? ""} />
              <Input name="episodeCount" type="number" defaultValue={show.episodeCount ?? ""} />
              <Input name="status" defaultValue={show.status} />
              <Select name="seasonType" defaultValue={show.seasonType ?? ""}>
                <option value="">Season type</option>
                <option value="new_series">new_series</option>
                <option value="returning_series">returning_series</option>
                <option value="limited_series">limited_series</option>
                <option value="special">special</option>
                <option value="finale">finale</option>
              </Select>
              <Input name="genre" defaultValue={show.genre ?? ""} />
              <Input name="studio" defaultValue={show.studio ?? ""} />
              <Input name="productionCompanies" defaultValue={show.productionCompanies ?? ""} className="md:col-span-2" />
              <Input name="country" defaultValue={show.country ?? ""} />
              <Input name="premiereTime" defaultValue={show.premiereTime ?? ""} />
              <Input name="episodeTitle" defaultValue={show.episodeTitle ?? ""} />
              <Input name="episodeNumber" type="number" defaultValue={show.episodeNumber ?? ""} />
              <Input name="airPattern" defaultValue={show.airPattern ?? ""} />
              <Input name="sourceType" defaultValue={show.sourceType ?? ""} />
              <Select name="sourceReliability" defaultValue={show.sourceReliability ?? "medium"}>
                <option value="high">high</option>
                <option value="medium">medium</option>
                <option value="low">low</option>
              </Select>
              <Input name="sourceUrl" defaultValue={show.sourceUrl ?? ""} className="md:col-span-2" />
            </div>
            <label className="mt-3 flex items-center gap-2 text-sm text-muted-foreground">
              <input type="checkbox" name="needsVerification" defaultChecked={Boolean(show.needsVerification)} />
              Needs verification
            </label>
            <Input name="verifiedAt" type="date" defaultValue={show.verifiedAt ? show.verifiedAt.slice(0, 10) : ""} className="mt-3" />
            <textarea name="notes" rows={3} defaultValue={show.notes ?? ""} className="mt-3 w-full rounded-md border bg-background px-3 py-2 text-sm" />
            <Button type="submit" className="mt-4 w-full">Save Changes</Button>
          </form>

          <div className="space-y-4 rounded-lg border bg-white p-4">
            <div>
              <div className="text-sm font-medium">Verify Premiere Dates</div>
              <p className="mt-1 text-sm text-muted-foreground">
                Mark the schedule as verified when the official or preferred source is confirmed. Flag conflicts when competing listings disagree.
              </p>
            </div>

            <form action={markPremiereVerifiedAction}>
              <input type="hidden" name="id" value={show.id} />
              <Button type="submit" className="w-full">
                <CheckCircle2 className="h-4 w-4" /> Mark Date as Verified
              </Button>
            </form>

            <form action={flagPremiereConflictAction} className="space-y-3">
              <input type="hidden" name="id" value={show.id} />
              <textarea
                name="conflictNote"
                rows={3}
                placeholder="Describe the source conflict, for example a press-site date versus a roundup post."
                className="w-full rounded-md border bg-background px-3 py-2 text-sm"
              />
              <Button type="submit" variant="secondary" className="w-full">
                <ShieldAlert className="h-4 w-4" /> Flag Conflict
              </Button>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function DetailItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs font-semibold uppercase text-muted-foreground">{label}</div>
      <div className="mt-1 text-sm">{value}</div>
    </div>
  );
}

function EmptyState({ title, copy }: { title: string; copy: string }) {
  return (
    <div className="rounded-lg border border-dashed bg-slate-50 p-8 text-center">
      <div className="font-medium">{title}</div>
      <p className="mt-2 text-sm text-muted-foreground">{copy}</p>
    </div>
  );
}
