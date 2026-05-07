/**
 * /api/search
 *
 * Deep similarity search across Projects, CurrentShows, and Articles.
 * Supports four modes: exact | fuzzy | conceptual | logline
 * Also accepts genre, buyer, yearFrom/yearTo, stale filters.
 */

import { type NextRequest, NextResponse } from "next/server";
import { deepSearch } from "@/lib/deep-search";
import type { SearchMode } from "@/lib/deep-search";
import { logOperationalEvent } from "@/lib/ops-log";

export const dynamic = "force-dynamic";

const VALID_MODES: SearchMode[] = ["exact", "fuzzy", "conceptual", "logline"];

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q")?.trim();

  if (!q) return NextResponse.json({ results: [], message: "No query provided" });
  if (q.length < 2) return NextResponse.json({ results: [], message: "Query too short" });
  if (q.length > 1000) return NextResponse.json({ error: "Query too long" }, { status: 400 });

  const mode = (searchParams.get("mode") ?? "fuzzy") as SearchMode;
  if (!VALID_MODES.includes(mode)) {
    return NextResponse.json(
      { error: `mode must be one of: ${VALID_MODES.join(", ")}` },
      { status: 400 }
    );
  }

  const yearFromRaw = parseInt(searchParams.get("yearFrom") ?? "");
  const yearToRaw = parseInt(searchParams.get("yearTo") ?? "");
  const maxResults = Math.min(100, parseInt(searchParams.get("max") ?? "50", 10) || 50);

  try {
    const results = await deepSearch({
      query: q,
      searchMode: mode,
      genre: searchParams.get("genre") ?? undefined,
      buyer: searchParams.get("buyer") ?? undefined,
      yearFrom: Number.isFinite(yearFromRaw) ? yearFromRaw : undefined,
      yearTo: Number.isFinite(yearToRaw) ? yearToRaw : undefined,
      includeProjects: searchParams.get("projects") !== "false",
      includeShows: searchParams.get("shows") !== "false",
      includeArticles: searchParams.get("articles") !== "false",
      includeStale: searchParams.get("stale") === "true",
      maxResults,
    });

    return NextResponse.json({ results, query: q, mode, total: results.length });
  } catch (err) {
    logOperationalEvent("error", "Search API error", { error: String(err) });
    return NextResponse.json({ error: "Search failed", details: String(err) }, { status: 500 });
  }
}
