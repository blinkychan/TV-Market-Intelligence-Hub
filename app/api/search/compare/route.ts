/**
 * /api/search/compare
 *
 * POST { pitch: string }
 * Returns: similar works, active buyers, white-space buyers, caution flags.
 */

import { type NextRequest, NextResponse } from "next/server";
import { comparePitch } from "@/lib/deep-search";
import { logOperationalEvent } from "@/lib/ops-log";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { pitch } = (body ?? {}) as Record<string, unknown>;

  if (!pitch || typeof pitch !== "string") {
    return NextResponse.json({ error: "pitch is required" }, { status: 400 });
  }

  if (pitch.trim().length < 10) {
    return NextResponse.json({ error: "pitch must be at least 10 characters" }, { status: 400 });
  }

  if (pitch.length > 5000) {
    return NextResponse.json({ error: "pitch too long (max 5000 chars)" }, { status: 400 });
  }

  try {
    const result = await comparePitch(pitch);
    return NextResponse.json({ result });
  } catch (err) {
    logOperationalEvent("error", "Pitch compare API error", { error: String(err) });
    return NextResponse.json({ error: "Comparison failed", details: String(err) }, { status: 500 });
  }
}
