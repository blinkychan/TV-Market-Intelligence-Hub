"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import {
  Search,
  X,
  Filter,
  Bookmark,
  BookmarkCheck,
  Download,
  SlidersHorizontal,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  AlertTriangle,
  CheckCircle,
  Info,
  Loader2,
  ArrowRight,
  FlaskConical,
  Trash2,
} from "lucide-react";
import type { DeepSearchResult, SearchMode, PitchCompareResult, SavedSearchRecord } from "@/lib/deep-search";

type SearchFilters = {
  mode: SearchMode;
  genre: string;
  buyer: string;
  yearFrom: string;
  yearTo: string;
  includeProjects: boolean;
  includeShows: boolean;
  includeArticles: boolean;
  includeStale: boolean;
};

const DEFAULT_FILTERS: SearchFilters = {
  mode: "fuzzy",
  genre: "",
  buyer: "",
  yearFrom: "",
  yearTo: "",
  includeProjects: true,
  includeShows: true,
  includeArticles: true,
  includeStale: false,
};

const EXAMPLE_QUERIES = [
  "US Postal Inspection Service",
  "federal agency workplace drama",
  "mail fraud procedural",
  "government bureaucracy comedy",
  "undercover agent family drama",
  "forensic accountant thriller",
];

const MODE_INFO: Record<SearchMode, { label: string; desc: string; color: string }> = {
  exact:      { label: "Exact",      desc: "Match the precise phrase only",                          color: "bg-slate-100 text-slate-700" },
  fuzzy:      { label: "Fuzzy",      desc: "Match keywords and partial phrases",                     color: "bg-sky-50 text-sky-700" },
  conceptual: { label: "Conceptual", desc: "Expand query with thematic synonyms and related ideas",  color: "bg-violet-50 text-violet-700" },
  logline:    { label: "Logline",    desc: "Parse premise for profession, setting, and conflict",    color: "bg-emerald-50 text-emerald-700" },
};

const KIND_LABELS: Record<string, string> = {
  project: "Development Project",
  current_show: "Current Show",
  article: "Article",
};

const KIND_COLORS: Record<string, string> = {
  project: "bg-sky-50 text-sky-700",
  current_show: "bg-emerald-50 text-emerald-700",
  article: "bg-amber-50 text-amber-700",
};

const MATCH_LABEL_COLORS: Record<string, string> = {
  "Exact title match":            "text-emerald-700",
  "Exact phrase in record":       "text-emerald-700",
  "Exact phrase in article body": "text-emerald-700",
  "Logline similarity":           "text-violet-700",
  "Conceptual similarity":        "text-violet-700",
  "Keyword match":                "text-sky-700",
  "Genre / theme overlap":        "text-amber-700",
};

function fmtScore(s: number): string {
  return `${Math.round(s * 100)}%`;
}

function ScoreBar({ score }: { score: number }) {
  const pct = Math.round(score * 100);
  const color = pct >= 80 ? "bg-emerald-500" : pct >= 60 ? "bg-sky-500" : pct >= 40 ? "bg-amber-500" : "bg-slate-300";
  return (
    <div className="flex items-center gap-1.5">
      <div className="h-1.5 w-20 rounded-full bg-slate-100 overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs font-medium text-slate-600">{pct}%</span>
    </div>
  );
}

function ResultCard({ result }: { result: DeepSearchResult }) {
  const [expanded, setExpanded] = useState(false);
  const kindColor = KIND_COLORS[result.kind] ?? "bg-slate-100 text-slate-600";
  const matchColor = MATCH_LABEL_COLORS[result.matchLabel] ?? "text-slate-600";

  return (
    <div className={`rounded-lg border bg-white shadow-sm transition-shadow hover:shadow-md ${result.isStale ? "opacity-80 border-amber-200" : ""}`}>
      <div className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-1.5 mb-1">
              <span className={`inline-flex items-center rounded px-1.5 py-0.5 text-xs font-medium ${kindColor}`}>
                {KIND_LABELS[result.kind]}
              </span>
              {result.isStale && (
                <span className="inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200">
                  <AlertTriangle className="h-3 w-3" /> Stale
                </span>
              )}
              {result.isAutoCreated && (
                <span className="rounded px-1.5 py-0.5 text-xs bg-slate-100 text-slate-500 border border-slate-200">Auto</span>
              )}
              {result.needsReview && (
                <span className="rounded px-1.5 py-0.5 text-xs bg-rose-50 text-rose-600 border border-rose-200">Needs Review</span>
              )}
            </div>
            <h3 className="font-semibold text-slate-900 text-sm leading-snug">{result.title}</h3>
            <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-1 text-xs text-slate-500">
              {result.buyer && <span>{result.buyer}</span>}
              {result.studio && <><span>·</span><span>{result.studio}</span></>}
              {result.genre && <><span>·</span><span className="italic">{result.genre}</span></>}
              {result.status && <><span>·</span><span className="capitalize">{result.status.replace(/_/g, " ")}</span></>}
              {result.announcementYear && <><span>·</span><span>{result.announcementYear}</span></>}
            </div>
          </div>
          <div className="flex-shrink-0 text-right space-y-1">
            <ScoreBar score={result.matchScore} />
            {result.confidenceScore != null && (
              <div className="text-xs text-muted-foreground">conf: {fmtScore(result.confidenceScore)}</div>
            )}
          </div>
        </div>

        <div className={`mt-2 text-xs font-medium ${matchColor}`}>
          {result.matchLabel}
          {result.matchLabel.includes("Conceptual") && (
            <span className="ml-1 text-slate-400 font-normal">(thematic expansion — not exact)</span>
          )}
          {result.matchLabel.includes("Logline") && (
            <span className="ml-1 text-slate-400 font-normal">(premise-level match)</span>
          )}
        </div>

        {result.logline && (
          <p className={`mt-2 text-xs text-slate-700 italic leading-relaxed ${expanded ? "" : "line-clamp-2"}`}>
            {result.logline}
          </p>
        )}
        {!result.logline && result.snippet && (
          <p className="mt-2 text-xs text-slate-600 leading-relaxed line-clamp-2">{result.snippet}</p>
        )}

        <div className="mt-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            {result.sourceUrl && (
              <a href={result.sourceUrl} target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs text-sky-600 hover:underline">
                <ExternalLink className="h-3 w-3" />
                {result.publication ?? "Source"}
              </a>
            )}
            {(result.logline?.length ?? 0) > 120 && (
              <button onClick={() => setExpanded((e) => !e)} className="text-xs text-slate-400 hover:text-slate-600">
                {expanded ? "Show less" : "Show more"}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function ResultSection({ title, results }: { title: string; results: DeepSearchResult[] }) {
  const [collapsed, setCollapsed] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const displayed = showAll ? results : results.slice(0, 6);

  return (
    <div>
      <button onClick={() => setCollapsed((c) => !c)}
        className="flex items-center gap-2 text-sm font-semibold text-slate-700 mb-3 hover:text-slate-900 transition-colors">
        {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        {title}
      </button>
      {!collapsed && (
        <>
          <div className="grid gap-3 sm:grid-cols-2">
            {displayed.map((r) => <ResultCard key={r.id} result={r} />)}
          </div>
          {!showAll && results.length > 6 && (
            <button onClick={() => setShowAll(true)} className="mt-3 text-xs text-sky-600 hover:underline">
              Show {results.length - 6} more →
            </button>
          )}
        </>
      )}
    </div>
  );
}

function PitchComparePanel() {
  const [pitch, setPitch] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<PitchCompareResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleCompare() {
    if (pitch.trim().length < 10) return;
    setLoading(true); setError(null); setResult(null);
    try {
      const res = await fetch("/api/search/compare", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ pitch }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as { result: PitchCompareResult };
      setResult(data.result);
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="rounded-lg border bg-violet-50 p-4">
        <div className="flex items-start gap-2">
          <FlaskConical className="mt-0.5 h-4 w-4 flex-shrink-0 text-violet-600" />
          <div>
            <p className="text-sm font-medium text-violet-800">Compare to New Pitch</p>
            <p className="text-xs text-violet-700 mt-0.5">
              Paste a logline or pitch. The system finds similar existing projects, identifies active buyers in this lane,
              surfaces possible white space, and flags caution areas — all backed by real records.
            </p>
          </div>
        </div>
      </div>

      <textarea value={pitch} onChange={(e) => setPitch(e.target.value)}
        placeholder={"Paste your logline or pitch here…\n\nExample: A disgraced postal inspector is forced out of retirement when a series of mail-based murders in her hometown turns out to be connected to a conspiracy she buried twenty years ago."}
        rows={5}
        className="w-full rounded-lg border px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400 resize-y" />

      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">{pitch.length} / 5000</span>
        <button onClick={handleCompare} disabled={loading || pitch.trim().length < 10}
          className="inline-flex items-center gap-2 rounded-md bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-700 disabled:opacity-50 transition-colors">
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <FlaskConical className="h-4 w-4" />}
          {loading ? "Comparing…" : "Compare Pitch"}
        </button>
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
          <AlertTriangle className="h-4 w-4" /> {error}
        </div>
      )}

      {result && (
        <div className="space-y-5">
          {result.dataSource === "mock" && (
            <div className="flex items-center gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
              <Info className="h-4 w-4" /> Demo data — connect a database for source-backed results.
            </div>
          )}

          {result.cautionFlags.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-sm font-semibold">Caution Flags</h3>
              {result.cautionFlags.map((flag, i) => (
                <div key={i} className={`flex items-start gap-2 rounded-md border px-3 py-2.5 text-sm ${
                  flag.severity === "high" ? "border-rose-200 bg-rose-50 text-rose-800"
                  : flag.severity === "medium" ? "border-amber-200 bg-amber-50 text-amber-800"
                  : "border-slate-200 bg-slate-50 text-slate-700"}`}>
                  <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" />
                  <div><span className="font-medium capitalize">{flag.severity}: </span>{flag.message}</div>
                </div>
              ))}
            </div>
          )}

          {result.activeBuyers.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold mb-2">Active Buyers in This Lane</h3>
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {result.activeBuyers.map((b) => (
                  <div key={b.name} className="rounded-md border bg-white p-3 shadow-sm">
                    <div className="font-medium text-sm">{b.name}</div>
                    <div className="text-xs text-muted-foreground mt-0.5">{b.recentActivity}</div>
                    {b.activeTitles.length > 0 && (
                      <div className="mt-1.5 flex flex-wrap gap-1">
                        {b.activeTitles.map((t) => (
                          <span key={t} className="rounded-full bg-sky-50 px-2 py-0.5 text-xs text-sky-700">{t}</span>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {result.whiteSpaceBuyers.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold mb-2">Potential White Space</h3>
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {result.whiteSpaceBuyers.map((b) => (
                  <div key={b.name} className="rounded-md border border-emerald-200 bg-emerald-50 p-3">
                    <div className="font-medium text-sm text-emerald-800">{b.name}</div>
                    <div className="text-xs text-emerald-700 mt-0.5">{b.recentActivity}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {result.similar.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold mb-2">
                Similar Works ({result.similar.length})
                <span className="ml-1.5 text-xs font-normal text-muted-foreground">— source-backed only</span>
              </h3>
              <div className="grid gap-3 sm:grid-cols-2">
                {result.similar.slice(0, 8).map((r) => <ResultCard key={r.id} result={r} />)}
              </div>
              {result.similar.length > 8 && (
                <p className="text-xs text-muted-foreground text-center py-2">
                  …and {result.similar.length - 8} more similar works
                </p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function SavedSearchesPanel({ onLoad }: { onLoad: (s: SavedSearchRecord) => void }) {
  const [searches, setSearches] = useState<SavedSearchRecord[]>([]);
  const [loading, setLoading] = useState(true);

  const loadSearches = useCallback(() => {
    try {
      const local = localStorage.getItem("savedSearches");
      if (local) setSearches(JSON.parse(local) as SavedSearchRecord[]);
    } catch { /* ignore */ }

    fetch("/api/search/saved")
      .then((r) => r.json())
      .then((d: { searches: SavedSearchRecord[] }) => {
        if (d.searches?.length) setSearches(d.searches);
      })
      .catch(() => undefined)
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { loadSearches(); }, [loadSearches]);

  async function handleDelete(id: string) {
    try {
      const local = localStorage.getItem("savedSearches");
      if (local) {
        const parsed = JSON.parse(local) as SavedSearchRecord[];
        localStorage.setItem("savedSearches", JSON.stringify(parsed.filter((s) => s.id !== id)));
      }
    } catch { /* ignore */ }
    setSearches((prev) => prev.filter((s) => s.id !== id));
    await fetch(`/api/search/saved?id=${id}`, { method: "DELETE" }).catch(() => undefined);
  }

  if (loading) return <div className="flex items-center gap-2 py-6 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</div>;

  if (!searches.length) return (
    <div className="py-10 text-center text-sm text-muted-foreground">
      <Bookmark className="h-10 w-10 mx-auto mb-2 opacity-20" />
      <p className="font-medium">No saved searches yet</p>
      <p className="text-xs mt-1">Run a search and click Save to bookmark it here.</p>
    </div>
  );

  return (
    <div className="space-y-2">
      {searches.map((s) => (
        <div key={s.id} className="flex items-start gap-2 rounded-lg border bg-white p-3 hover:bg-slate-50 transition-colors group">
          <button onClick={() => onLoad(s)} className="flex-1 text-left">
            <div className="font-medium text-sm">{s.name}</div>
            <div className="text-xs text-muted-foreground mt-0.5">
              "{s.query}" · <span className="capitalize">{s.searchMode}</span> mode
              {s.genre ? ` · ${s.genre}` : ""}{s.buyer ? ` · ${s.buyer}` : ""}
            </div>
          </button>
          <button onClick={() => handleDelete(s.id)}
            className="flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-rose-50 hover:text-rose-600">
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      ))}
    </div>
  );
}

export default function MarketSearch() {
  const [query, setQuery] = useState("");
  const [filters, setFilters] = useState<SearchFilters>(DEFAULT_FILTERS);
  const [showFilters, setShowFilters] = useState(false);
  const [activeTab, setActiveTab] = useState<"search" | "compare" | "saved">("search");

  const [results, setResults] = useState<DeepSearchResult[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastQuery, setLastQuery] = useState("");
  const [dataSource, setDataSource] = useState<string | null>(null);

  const [showSaveInput, setShowSaveInput] = useState(false);
  const [savedName, setSavedName] = useState("");
  const [saving, setSaving] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);

  const runSearch = useCallback(async (q: string, f: SearchFilters) => {
    if (!q.trim()) return;
    setLoading(true); setError(null); setResults(null);

    const params = new URLSearchParams({
      q, mode: f.mode,
      ...(f.genre && { genre: f.genre }),
      ...(f.buyer && { buyer: f.buyer }),
      ...(f.yearFrom && { yearFrom: f.yearFrom }),
      ...(f.yearTo && { yearTo: f.yearTo }),
      projects: String(f.includeProjects),
      shows: String(f.includeShows),
      articles: String(f.includeArticles),
      stale: String(f.includeStale),
      max: "60",
    });

    try {
      const res = await fetch(`/api/search?${params}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as { results: DeepSearchResult[]; dataSource?: string };
      setResults(data.results);
      setDataSource(data.dataSource ?? null);
      setLastQuery(q);
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  function handleSearch(e?: React.FormEvent) {
    e?.preventDefault();
    runSearch(query, filters);
  }

  function setFilter<K extends keyof SearchFilters>(key: K, value: SearchFilters[K]) {
    setFilters((f) => ({ ...f, [key]: value }));
  }

  function loadSavedSearch(s: SavedSearchRecord) {
    const f: SearchFilters = {
      mode: s.searchMode,
      genre: s.genre ?? "",
      buyer: s.buyer ?? "",
      yearFrom: s.yearFrom ? String(s.yearFrom) : "",
      yearTo: s.yearTo ? String(s.yearTo) : "",
      includeProjects: s.includeProjects,
      includeShows: s.includeShows,
      includeArticles: s.includeArticles,
      includeStale: s.includeStale,
    };
    setQuery(s.query);
    setFilters(f);
    setActiveTab("search");
    setTimeout(() => runSearch(s.query, f), 0);
  }

  async function handleSave() {
    if (!savedName.trim() || !query.trim()) return;
    setSaving(true);
    const newSearch: SavedSearchRecord = {
      id: `local-${Date.now()}`,
      name: savedName,
      query,
      searchMode: filters.mode,
      genre: filters.genre || null,
      buyer: filters.buyer || null,
      yearFrom: filters.yearFrom ? parseInt(filters.yearFrom) : null,
      yearTo: filters.yearTo ? parseInt(filters.yearTo) : null,
      includeShows: filters.includeShows,
      includeProjects: filters.includeProjects,
      includeStale: filters.includeStale,
      includeArticles: filters.includeArticles,
      email: null,
      createdAt: new Date(),
    };
    try {
      const local = localStorage.getItem("savedSearches");
      const existing = local ? (JSON.parse(local) as SavedSearchRecord[]) : [];
      localStorage.setItem("savedSearches", JSON.stringify([newSearch, ...existing]));
    } catch { /* ignore */ }
    await fetch("/api/search/saved", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(newSearch),
    }).catch(() => undefined);
    setSavedName(""); setShowSaveInput(false); setSaving(false);
  }

  async function handleExport(format: "csv" | "markdown" | "html") {
    if (!results?.length) return;
    const res = await fetch("/api/search/export", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ results, query: lastQuery, format }),
    });
    if (!res.ok) return;
    if (format === "html") {
      const html = await res.text();
      const win = window.open("", "_blank");
      if (win) { win.document.write(html); win.document.close(); win.print(); }
      return;
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `market-search-${Date.now()}.${format === "markdown" ? "md" : "csv"}`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  const projects = results?.filter((r) => r.kind === "project") ?? [];
  const shows = results?.filter((r) => r.kind === "current_show") ?? [];
  const articles = results?.filter((r) => r.kind === "article") ?? [];
  const modeInfo = MODE_INFO[filters.mode];

  return (
    <div className="space-y-6">
      <section className="rounded-lg border bg-white p-6 shadow-panel">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-primary">Intelligence</p>
        <h1 className="mt-2 flex items-center gap-3 text-3xl font-semibold tracking-tight">
          <Search className="h-7 w-7 text-sky-500" />
          Market Search
        </h1>
        <p className="mt-3 max-w-3xl text-muted-foreground">
          Search for concepts, premises, professions, institutions, or loglines across all development projects,
          current shows, and source articles. Every result traces to a real record or source URL.
        </p>
      </section>

      <div className="flex gap-1 border-b">
        {(["search", "compare", "saved"] as const).map((tab) => (
          <button key={tab} onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === tab ? "border-sky-500 text-sky-700" : "border-transparent text-muted-foreground hover:text-slate-700"
            }`}>
            {tab === "compare" ? "Compare Pitch" : tab === "saved" ? "Saved Searches" : "Search"}
          </button>
        ))}
      </div>

      {activeTab === "search" && (
        <div className="space-y-4">
          <form onSubmit={handleSearch} className="space-y-3">
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
                <input ref={inputRef} type="text" value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search by concept, logline, profession, institution, world…"
                  className="w-full rounded-lg border pl-9 pr-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-sky-400 shadow-sm" />
                {query && (
                  <button type="button" onClick={() => { setQuery(""); setResults(null); }}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
              <button type="submit" disabled={loading || !query.trim()}
                className="inline-flex items-center gap-2 rounded-lg bg-sky-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-sky-700 disabled:opacity-50 transition-colors shadow-sm">
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                Search
              </button>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs text-muted-foreground font-medium">Mode:</span>
              {(["exact", "fuzzy", "conceptual", "logline"] as SearchMode[]).map((m) => (
                <button key={m} type="button" onClick={() => setFilter("mode", m)}
                  className={`rounded-md px-2.5 py-1 text-xs font-medium border transition-colors ${
                    filters.mode === m ? "border-sky-400 bg-sky-50 text-sky-800" : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                  }`}>
                  {MODE_INFO[m].label}
                </button>
              ))}
              <span className="text-xs text-muted-foreground ml-1 hidden sm:inline">{modeInfo.desc}</span>
            </div>

            <div>
              <button type="button" onClick={() => setShowFilters((f) => !f)}
                className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-slate-700 transition-colors">
                <SlidersHorizontal className="h-3.5 w-3.5" />
                Advanced filters
                {showFilters ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
              </button>

              {showFilters && (
                <div className="mt-3 grid gap-3 rounded-lg border bg-slate-50 p-4 sm:grid-cols-2 lg:grid-cols-4">
                  {([
                    ["genre", "Genre", "e.g. crime drama"],
                    ["buyer", "Buyer / Network", "e.g. Netflix, Peacock"],
                    ["yearFrom", "Year From", "2020"],
                    ["yearTo", "Year To", "2026"],
                  ] as [keyof SearchFilters, string, string][]).map(([key, label, placeholder]) => (
                    <div key={key}>
                      <label className="block text-xs text-muted-foreground mb-1">{label}</label>
                      <input type={key.includes("year") ? "number" : "text"}
                        value={String(filters[key])}
                        onChange={(e) => setFilter(key, e.target.value as never)}
                        placeholder={placeholder}
                        className="w-full rounded border px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-sky-400" />
                    </div>
                  ))}
                  <div className="sm:col-span-2 lg:col-span-4 flex flex-wrap gap-3 pt-1 border-t">
                    {([
                      ["includeProjects", "Development Projects"],
                      ["includeShows", "Current Shows"],
                      ["includeArticles", "Articles"],
                      ["includeStale", "Stale / Dead Projects"],
                    ] as [keyof SearchFilters, string][]).map(([key, label]) => (
                      <label key={key} className="flex cursor-pointer items-center gap-1.5 text-xs">
                        <input type="checkbox" checked={Boolean(filters[key])}
                          onChange={(e) => setFilter(key, e.target.checked as never)}
                          className="h-3.5 w-3.5 accent-sky-600" />
                        {label}
                      </label>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </form>

          {!results && !loading && (
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground font-medium">Example searches:</p>
              <div className="flex flex-wrap gap-2">
                {EXAMPLE_QUERIES.map((eq) => (
                  <button key={eq} onClick={() => { setQuery(eq); runSearch(eq, filters); }}
                    className="inline-flex items-center gap-1 rounded-full border bg-white px-3 py-1 text-xs hover:bg-sky-50 hover:border-sky-300 hover:text-sky-700 transition-colors">
                    <ArrowRight className="h-3 w-3" /> {eq}
                  </button>
                ))}
              </div>
            </div>
          )}

          {error && (
            <div className="flex items-center gap-2 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
              <AlertTriangle className="h-4 w-4" /> {error}
            </div>
          )}

          {loading && (
            <div className="flex flex-col items-center gap-2 py-12 text-sm text-muted-foreground">
              <Loader2 className="h-6 w-6 animate-spin text-sky-500" />
              {filters.mode === "conceptual" ? "Expanding query with concept synonyms…"
                : filters.mode === "logline" ? "Decomposing premise into searchable components…"
                : "Searching…"}
            </div>
          )}

          {results && !loading && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <span className="font-semibold">{results.length} results</span>
                  <span className="ml-2 text-sm text-muted-foreground">for "{lastQuery}"</span>
                  <span className={`ml-2 rounded px-1.5 py-0.5 text-xs font-medium ${modeInfo.color}`}>
                    {modeInfo.label} mode
                  </span>
                  {dataSource === "mock" && (
                    <span className="ml-2 rounded px-1.5 py-0.5 text-xs bg-amber-50 text-amber-700 border border-amber-200">Demo data</span>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  {!showSaveInput ? (
                    <button onClick={() => setShowSaveInput(true)}
                      className="inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs font-medium hover:bg-slate-50 transition-colors">
                      <Bookmark className="h-3.5 w-3.5" /> Save
                    </button>
                  ) : (
                    <div className="flex items-center gap-1">
                      <input type="text" value={savedName} onChange={(e) => setSavedName(e.target.value)}
                        placeholder="Search name…" autoFocus
                        onKeyDown={(e) => { if (e.key === "Enter") handleSave(); if (e.key === "Escape") setShowSaveInput(false); }}
                        className="rounded border px-2 py-1 text-xs w-36 focus:outline-none focus:ring-1 focus:ring-sky-400" />
                      <button onClick={handleSave} disabled={saving || !savedName.trim()}
                        className="rounded bg-sky-600 px-2 py-1 text-xs text-white hover:bg-sky-700 disabled:opacity-50">
                        {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <BookmarkCheck className="h-3 w-3" />}
                      </button>
                      <button onClick={() => setShowSaveInput(false)} className="text-slate-400 hover:text-slate-600">
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  )}

                  <div className="relative group">
                    <button className="inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs font-medium hover:bg-slate-50 transition-colors">
                      <Download className="h-3.5 w-3.5" /> Export
                    </button>
                    <div className="absolute right-0 top-full mt-1 w-36 rounded-md border bg-white shadow-lg py-1 hidden group-hover:block z-10">
                      {(["csv", "markdown", "html"] as const).map((fmt) => (
                        <button key={fmt} onClick={() => handleExport(fmt)}
                          className="block w-full text-left px-3 py-1.5 text-xs hover:bg-slate-50">
                          {fmt === "html" ? "PDF (Print)" : fmt.toUpperCase()}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {results.length === 0 ? (
                <div className="py-12 text-center text-muted-foreground">
                  <Search className="h-10 w-10 mx-auto mb-3 opacity-20" />
                  <p className="font-medium">No results found</p>
                  <p className="text-sm mt-1">Try Conceptual mode, a broader query, or enable Stale Projects.</p>
                </div>
              ) : (
                <div className="space-y-6">
                  {projects.length > 0 && <ResultSection title={`Development Projects (${projects.length})`} results={projects} />}
                  {shows.length > 0 && <ResultSection title={`Current Shows (${shows.length})`} results={shows} />}
                  {articles.length > 0 && <ResultSection title={`Articles (${articles.length})`} results={articles} />}
                  <p className="text-xs text-muted-foreground text-center pt-2 pb-4">
                    Every result traces to a database record or source URL. Conceptual and logline matches are labeled as such.
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {activeTab === "compare" && <PitchComparePanel />}
      {activeTab === "saved" && <SavedSearchesPanel onLoad={loadSavedSearch} />}
    </div>
  );
}
