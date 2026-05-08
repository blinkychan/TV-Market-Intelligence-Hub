import { type NextRequest, NextResponse } from "next/server";
import { runAutonomousPopulation } from "@/lib/autonomous-population";
import { logOperationalEvent } from "@/lib/ops-log";
import { getCurrentUserContext } from "@/lib/team-auth";
import type { AutoPopulateMode } from "@/lib/app-settings";

export const dynamic = "force-dynamic";
// Allow up to 5 minutes for large runs
export const maxDuration = 300;

const VALID_MODES: AutoPopulateMode[] = ["off", "cautious", "aggressive"];

export async function POST(request: NextRequest) {
  const ctx = await getCurrentUserContext().catch(() => null);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    body = {};
  }

  const {
    articleIds,
    forceMode,
    limit,
  } = (body ?? {}) as Record<string, unknown>;

  // Validate optional forceMode
  if (forceMode && !VALID_MODES.includes(forceMode as AutoPopulateMode)) {
    return NextResponse.json(
      { error: `forceMode must be one of: ${VALID_MODES.join(", ")}` },
      { status: 400 }
    );
  }

  // Validate optional articleIds
  if (articleIds && (!Array.isArray(articleIds) || articleIds.some((id) => typeof id !== "string"))) {
    return NextResponse.json({ error: "articleIds must be a string array" }, { status: 400 });
  }

  const parsedLimit = typeof limit === "number" && limit > 0 ? Math.min(limit, 200) : 50;

  try {
    logOperationalEvent("info", "Autonomous population triggered via API", {
      triggeredBy: ctx?.user?.email ?? "anonymous",
      forceMode,
      limit: parsedLimit,
      articleCount: Array.isArray(articleIds) ? articleIds.length : undefined,
    });

    const summary = await runAutonomousPopulation({
      articleIds: Array.isArray(articleIds) ? (articleIds as string[]) : undefined,
      forceMode: forceMode as AutoPopulateMode | undefined,
      limit: parsedLimit,
    });

    return NextResponse.json({ summary });
  } catch (err) {
    logOperationalEvent("error", "Autonomous population API error", { error: String(err) });
    return NextResponse.json(
      { error: "Auto-population failed", details: String(err) },
      { status: 500 }
    );
  }
}
