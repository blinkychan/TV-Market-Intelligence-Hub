/**
 * /api/search/export
 *
 * POST { results, query, format: "csv" | "markdown" | "html" }
 * Returns the formatted export as a text response.
 */

import { type NextRequest, NextResponse } from "next/server";
import { exportToCSV, exportToMarkdown, exportToPrintableHTML } from "@/lib/search-export";
import type { DeepSearchResult } from "@/lib/deep-search";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { results, query, format } = (body ?? {}) as {
    results?: DeepSearchResult[];
    query?: string;
    format?: string;
  };

  if (!results || !Array.isArray(results)) {
    return NextResponse.json({ error: "results array required" }, { status: 400 });
  }
  if (!query || typeof query !== "string") {
    return NextResponse.json({ error: "query string required" }, { status: 400 });
  }

  const safeResults = results.slice(0, 200) as DeepSearchResult[];
  const safeQuery = query.slice(0, 200);

  if (format === "csv") {
    const csv = exportToCSV(safeResults, safeQuery);
    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="market-search-${Date.now()}.csv"`,
      },
    });
  }

  if (format === "markdown") {
    const md = exportToMarkdown(safeResults, safeQuery);
    return new NextResponse(md, {
      headers: {
        "Content-Type": "text/markdown; charset=utf-8",
        "Content-Disposition": `attachment; filename="market-search-${Date.now()}.md"`,
      },
    });
  }

  if (format === "html") {
    const html = exportToPrintableHTML(safeResults, safeQuery);
    return new NextResponse(html, {
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  }

  return NextResponse.json(
    { error: 'format must be "csv", "markdown", or "html"' },
    { status: 400 }
  );
}
