import { type NextRequest, NextResponse } from "next/server";
import { marketSearch } from "@/lib/semantic-search";
import { logOperationalEvent } from "@/lib/ops-log";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q")?.trim();

  if (!q) {
    return NextResponse.json({ results: [], message: "No query provided" });
  }

  if (q.length < 2) {
    return NextResponse.json({ results: [], message: "Query too short" });
  }

  if (q.length > 500) {
    return NextResponse.json({ error: "Query too long" }, { status: 400 });
  }

  const includeProjects = searchParams.get("projects") !== "false";
  const includeShows = searchParams.get("shows") !== "false";
  const includeArticles = searchParams.get("articles") !== "false";
  const maxResults = Math.min(100, parseInt(searchParams.get("max") ?? "40", 10) || 40);

  try {
    const results = await marketSearch({
      query: q,
      includeProjects,
      includeShows,
      includeArticles,
      maxResults,
    });

    return NextResponse.json({
      results,
      query: q,
      total: results.length,
    });
  } catch (err) {
    logOperationalEvent("error", "Search API error", { error: String(err) });
    return NextResponse.json({ error: "Search failed", details: String(err) }, { status: 500 });
  }
}
