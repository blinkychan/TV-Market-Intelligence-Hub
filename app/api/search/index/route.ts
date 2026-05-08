import { type NextRequest, NextResponse } from "next/server";
import { rebuildAllSearchableText } from "@/lib/semantic-search";
import { logOperationalEvent } from "@/lib/ops-log";
import { getCurrentUserContext } from "@/lib/team-auth";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const ctx = await getCurrentUserContext().catch(() => null);
  if (!ctx?.isAuthenticated) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const counts = await rebuildAllSearchableText();
    logOperationalEvent("info", "Search index rebuilt", counts);
    return NextResponse.json({ success: true, indexed: counts });
  } catch (err) {
    logOperationalEvent("error", "Search index rebuild failed", { error: String(err) });
    return NextResponse.json({ error: "Rebuild failed", details: String(err) }, { status: 500 });
  }
}
