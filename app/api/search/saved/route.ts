/**
 * /api/search/saved
 *
 * GET               — list saved searches for current user
 * POST  { ...fields } — create a saved search
 * DELETE ?id=...     — delete a saved search
 */

import { type NextRequest, NextResponse } from "next/server";
import {
  createSavedSearch,
  getSavedSearches,
  deleteSavedSearch,
} from "@/lib/deep-search";
import { getCurrentUserContext } from "@/lib/team-auth";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const ctx = await getCurrentUserContext().catch(() => null);
  const email = ctx?.user?.email ?? undefined;

  try {
    const searches = await getSavedSearches(email);
    return NextResponse.json({ searches });
  } catch (err) {
    return NextResponse.json({ searches: [], error: String(err) });
  }
}

export async function POST(request: NextRequest) {
  const ctx = await getCurrentUserContext().catch(() => null);
  const email = ctx?.user?.email ?? undefined;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const {
    name,
    query,
    searchMode,
    genre,
    buyer,
    yearFrom,
    yearTo,
    includeShows,
    includeProjects,
    includeStale,
    includeArticles,
  } = (body ?? {}) as Record<string, unknown>;

  if (!name || typeof name !== "string" || !query || typeof query !== "string") {
    return NextResponse.json({ error: "name and query are required" }, { status: 400 });
  }

  try {
    const saved = await createSavedSearch({
      name,
      query,
      searchMode: (searchMode as "exact" | "fuzzy" | "conceptual" | "logline") ?? "fuzzy",
      genre: typeof genre === "string" ? genre : null,
      buyer: typeof buyer === "string" ? buyer : null,
      yearFrom: typeof yearFrom === "number" ? yearFrom : null,
      yearTo: typeof yearTo === "number" ? yearTo : null,
      includeShows: includeShows !== false,
      includeProjects: includeProjects !== false,
      includeStale: includeStale === true,
      includeArticles: includeArticles !== false,
      email: email ?? null,
    });
    return NextResponse.json({ saved });
  } catch (err) {
    return NextResponse.json({ error: "Failed to save search", details: String(err) }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");

  if (!id) {
    return NextResponse.json({ error: "id is required" }, { status: 400 });
  }

  try {
    await deleteSavedSearch(id);
    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: "Failed to delete saved search", details: String(err) }, { status: 500 });
  }
}
