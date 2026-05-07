"use client";

import { useState, useCallback, useRef } from "react";
import {
  Search,
  SlidersHorizontal,
  FileText,
  Tv2,
  Clapperboard,
  ExternalLink,
  Loader2,
  AlertTriangle,
  Info,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import type { SearchResult } from "@/lib/semantic-search";
import { cn } from "@/lib/utils";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function KindIcon({ kind }: { kind: SearchResult["kind"] }) {
  if (kind === "project") return <Clapperboard className="h-3.5 w-3.5 text-sky-600" />;
  if (kind === "current_show") return <Tv2 className="h-3.5 w-3.5 text-emerald-600" />;
  return <FileText className="h-3.5 w-3.5 text-slate-500" />;
}

function kindLabel(kind: SearchResult["kind"]) {
  if (kind === "project") return "Project";
  if (kind === "current_show") return "Current Show";
  return "Article";
}

function matchTypeLabel(t: SearchResult["matchType"]) {
  if (t === "exact_title") return "Title match";
  if (t === "logline_topic") return "Topic match";
  if (t === "genre_theme") return "Genre / theme";
  if (t === "development_history") return "Dev history";
  return "Company / person";
}

function scoreBar(score: number) {
  const pct = Math.round(score * 100);
  const color = pct >= 80 ? "bg-emerald-500" : pct >= 55 ? "bg-amber-500" : "bg-rose-400";
  return (
    <div className="flex items-center gap-1.5" title={`Match score: ${pct}%`}>
      <div className="h-1.5 w-16 rounded-full bg-slate-200">
        <div className={cn("h-1.5 rounded-full", color)} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs text-muted-foreground">{pct}%</span>
    </div>
  );
}

function confidenceBadge(level?: string | null) {
  if (level === "high") return "bg-emerald-50 text-emerald-700 ring-emerald-200";
  if (level === "medium") return "bg-amber-50 text-amber-800 ring-amber-200";
  if (level === "low") return "bg-rose-50 text-rose-700 ring-rose-200";
  return "bg-slate-100 text-slate-600 ring-slate-200";
}

const EXAMPLE_QUERIES = [
  "US Postal Inspection Service",
  "postal crime procedural",
  "FBI-adjacent workplace drama",
  "true crime limited series about scams",
  "co-production international drama",
  "pilot order crime drama Netflix",
];

// ─── Result card ──────────────────────────────────────────────────────────────

function ResultCard({ result }: { result: SearchResult }) {
  const [snippetExpanded, setSnippetExpanded] = useState(false);

  const entityHref =
    result.kind === "project"
      ? `/projects/${result.id}`
      : result.kind === "current_show"
        ? `/current-tv`
        : null;

  return (
    <div className="rounded-lg border bg-white p-4 shadow-sm hover:shadow-md transition-shadow">
      {/* Header row */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-2 min-w-0">
          <div className="mt-0.5 flex-shrink-0">
            <KindIcon kind={result.kind} />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              {entityHref ? (
                <a
                  href={entityHref}
                  className="font-semibold text-sm hover:underline text-foreground"
                >
                  {result.title}
                </a>
              ) : (
                <span className="font-semibold text-sm">{result.title}</span>
              )}
              {result.isAutoCreated && (
                <span className="rounded bg-amber-100 px-1.5 py-0.5 text-xs font-medium text-amber-700">
                  Auto-Created
                </span>
              )}
              {result.needsReview && (
                <span className="rounded bg-rose-100 px-1.5 py-0.5 text-xs font-medium text-rose-700">
                  Needs Review
                </span>
              )}
            </div>
            <p className="mt-0.5 text-xs text-muted-foreground">{result.subtitle}</p>
          </div>
        </div>

        {/* Right column: badges */}
        <div className="flex flex-col items-end gap-1 flex-shrink-0">
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
            {kindLabel(result.kind)}
          </span>
          {result.confidenceLevel && (
            <span
              className={cn(
                "inline-flex items-center rounded-full px-2 py-0.5 text-xs ring-1",
                confidenceBadge(result.confidenceLevel)
              )}
            >
              {result.confidenceLevel} conf.
            </span>
          )}
        </div>
      </div>

      {/* Meta row */}
      <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
        {scoreBar(result.matchScore)}
        <span className="rounded bg-sky-50 text-sky-700 px-1.5 py-0.5">
          {matchTypeLabel(result.matchType)}
        </span>
        {result.genre && <span>{result.genre}</span>}
        {result.status && <span>· {result.status}</span>}
        {result.buyer && <span>· {result.buyer}</span>}
      </div>

      {/* Snippet */}
      {result.snippet && (
        <div className="mt-2">
          <p
            className={cn(
              "text-xs text-slate-600 italic leading-5",
              !snippetExpanded && "line-clamp-2"
            )}
          >
            {result.snippet}
          </p>
          {result.snippet.length > 100 && (
            <button
              onClick={() => setSnippetExpanded(!snippetExpanded)}
              className="mt-0.5 text-xs text-sky-600 hover:underline"
            >
              {snippetExpanded ? "Show less" : "Show more"}
            </button>
          )}
        </div>
      )}

      {/* Source link */}
      {result.sourceUrl && (
        <div className="mt-2">
          <a
            href={result.sourceUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 text-xs text-sky-600 hover:underline"
          >
            {result.publication ?? "Source"} <ExternalLink className="h-3 w-3" />
          </a>
          {result.publishedDate && (
            <span className="ml-2 text-xs text-muted-foreground">
              · {new Date(result.publishedDate).toLocaleDateString()}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Filters panel ────────────────────────────────────────────────────────────

type SearchFilters = {
  includeProjects: boolean;
  includeShows: boolean;
  includeArticles: boolean;
};

function FiltersPanel({
  filters,
  onChange,
}: {
  filters: SearchFilters;
  onChange: (f: SearchFilters) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-md border bg-slate-50 px-3 py-2 text-sm">
      <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Include:
      </span>
      {(
        [
          { key: "includeProjects", label: "Projects" },
          { key: "includeShows", label: "Current Shows" },
          { key: "includeArticles", label: "Articles" },
        ] as Array<{ key: keyof SearchFilters; label: string }>
      ).map(({ key, label }) => (
        <label key={key} className="flex cursor-pointer items-center gap-1.5">
          <input
            type="checkbox"
            checked={filters[key]}
            onChange={(e) => onChange({ ...filters, [key]: e.target.checked })}
            className="h-3.5 w-3.5 accent-sky-600"
          />
          <span className="text-xs">{label}</span>
        </label>
      ))}
    </div>
  );
}

// ─── Group results by kind ────────────────────────────────────────────────────

type GroupedResults = {
  projects: SearchResult[];
  shows: SearchResult[];
  articles: SearchResult[];
};

function groupResults(results: SearchResult[]): GroupedResults {
  return {
    projects: results.filter((r) => r.kind === "project"),
    shows: results.filter((r) => r.kind === "current_show"),
    articles: results.filter((r) => r.kind === "article"),
  };
}

function ResultGroup({
  title,
  results,
  icon,
}: {
  title: string;
  results: SearchResult[];
  icon: React.ReactNode;
}) {
  const [expanded, setExpanded] = useState(true);
  if (!results.length) return null;

  return (
    <section>
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center gap-2 pb-2 text-sm font-semibold"
      >
        {icon}
        {title}
        <span className="ml-1 rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
          {results.length}
        </span>
        <span className="ml-auto text-muted-foreground">
          {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </span>
      </button>
      {expanded && (
        <div className="space-y-3">
          {results.map((r) => (
            <ResultCard key={r.id} result={r} />
          ))}
        </div>
      )}
    </section>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function MarketSearch() {
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<SearchResult[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState<SearchFilters>({
    includeProjects: true,
    includeShows: true,
    includeArticles: true,
  });
  const inputRef = useRef<HTMLInputElement>(null);

  const doSearch = useCallback(
    async (q: string) => {
      if (!q.trim()) {
        setResults(null);
        return;
      }
      setLoading(true);
      setError(null);

      try {
        const params = new URLSearchParams({
          q: q.trim(),
          projects: String(filters.includeProjects),
          shows: String(filters.includeShows),
          articles: String(filters.includeArticles),
        });

        const res = await fetch(`/api/search?${params}`);
        if (!res.ok) {
          const data = (await res.json().catch(() => ({}))) as { error?: string };
          throw new Error(data.error ?? `HTTP ${res.status}`);
        }

        const data = (await res.json()) as { results: SearchResult[] };
        setResults(data.results);
      } catch (err) {
        setError(String(err));
      } finally {
        setLoading(false);
      }
    },
    [filters]
  );

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    doSearch(query);
  }

  function handleExample(q: string) {
    setQuery(q);
    inputRef.current?.focus();
    doSearch(q);
  }

  const grouped = results ? groupResults(results) : null;

  return (
    <div className="space-y-6">
      {/* Search bar */}
      <form onSubmit={handleSubmit} className="space-y-3">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search concepts, loglines, topics, buyers…"
              className="w-full rounded-md border bg-white py-2.5 pl-9 pr-4 text-sm shadow-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-sky-500"
            />
          </div>
          <button
            type="submit"
            disabled={loading || !query.trim()}
            className="inline-flex items-center gap-2 rounded-md bg-sky-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-sky-700 disabled:opacity-50 transition-colors"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
            Search
          </button>
          <button
            type="button"
            onClick={() => setShowFilters(!showFilters)}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-md border px-3 py-2 text-sm transition-colors",
              showFilters ? "bg-sky-50 text-sky-700 border-sky-200" : "hover:bg-slate-50"
            )}
          >
            <SlidersHorizontal className="h-4 w-4" />
            Filters
          </button>
        </div>

        {showFilters && (
          <FiltersPanel filters={filters} onChange={setFilters} />
        )}
      </form>

      {/* Example queries */}
      {results === null && !loading && (
        <div className="space-y-3">
          <div className="rounded-lg border bg-sky-50 p-4">
            <div className="flex items-start gap-2">
              <Info className="mt-0.5 h-4 w-4 flex-shrink-0 text-sky-600" />
              <div className="text-sm text-sky-800">
                <p className="font-medium">Market Search</p>
                <p className="mt-1 text-sky-700">
                  Search by concept, genre, logline, topic, buyer, or any text — not just exact titles.
                  Results span Projects in development, Current Shows, and source Articles.
                </p>
              </div>
            </div>
          </div>

          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Try searching for…
            </p>
            <div className="flex flex-wrap gap-2">
              {EXAMPLE_QUERIES.map((q) => (
                <button
                  key={q}
                  onClick={() => handleExample(q)}
                  className="rounded-full border bg-white px-3 py-1 text-xs text-slate-700 hover:bg-sky-50 hover:border-sky-200 hover:text-sky-700 transition-colors shadow-sm"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="flex items-start gap-2 rounded-md border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
          <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center gap-2 py-12 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
          <span className="text-sm">Searching…</span>
        </div>
      )}

      {/* Results */}
      {!loading && results !== null && (
        <div className="space-y-6">
          {results.length === 0 ? (
            <div className="rounded-md border border-dashed bg-slate-50 p-8 text-center">
              <Search className="mx-auto h-8 w-8 text-muted-foreground/50" />
              <p className="mt-2 text-sm font-medium text-muted-foreground">
                No results for &ldquo;{query}&rdquo;
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Try different keywords, a broader concept, or check spelling.
              </p>
            </div>
          ) : (
            <>
              <p className="text-sm text-muted-foreground">
                <strong className="text-foreground">{results.length}</strong> result
                {results.length === 1 ? "" : "s"} for &ldquo;{query}&rdquo;
              </p>
              <div className="space-y-8">
                {grouped && (
                  <>
                    <ResultGroup
                      title="Development Projects"
                      results={grouped.projects}
                      icon={<Clapperboard className="h-4 w-4 text-sky-600" />}
                    />
                    <ResultGroup
                      title="Current Shows"
                      results={grouped.shows}
                      icon={<Tv2 className="h-4 w-4 text-emerald-600" />}
                    />
                    <ResultGroup
                      title="Source Articles"
                      results={grouped.articles}
                      icon={<FileText className="h-4 w-4 text-slate-500" />}
                    />
                  </>
                )}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
