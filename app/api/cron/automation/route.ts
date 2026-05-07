/**
 * /api/cron/automation
 *
 * Vercel Cron endpoint — runs the full automation pipeline on schedule.
 *
 * Vercel free tier: crons run at most once per day.
 * Pro tier: up to every minute (we recommend every 6h for cost safety).
 *
 * Security: Vercel signs cron requests with a secret header.
 * Any request lacking the header is rejected in production.
 *
 * NOTE: Free Vercel cron may run slowly or be throttled — that is acceptable.
 * The endpoint is idempotent: re-running after a partial failure is safe.
 */

import { type NextRequest, NextResponse } from "next/server";
import { runAutomation } from "@/lib/automation-orchestrator";
import { logOperationalEvent } from "@/lib/ops-log";

export const dynamic = "force-dynamic";
// Allow up to 5 minutes for a full pipeline run
export const maxDuration = 300;

export async function GET(request: NextRequest) {
  // Verify Vercel cron secret in production
  if (process.env.NODE_ENV === "production") {
    const authHeader = request.headers.get("authorization");
    const cronSecret = process.env.CRON_SECRET;

    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  try {
    const result = await runAutomation({ triggeredBy: "cron", steps: "all" });

    if (result.isPaused) {
      return NextResponse.json({ skipped: true, reason: "paused", runId: result.runId });
    }

    return NextResponse.json({
      success: true,
      runId: result.runId,
      message: result.message,
      summary: {
        rssArticlesSaved: result.rssArticlesSaved,
        backfillArticles: result.backfillArticles,
        bodiesFetched: result.bodiesFetched,
        aiExtractionsRun: result.aiExtractionsRun,
        draftsCreated: result.draftsCreated,
        errors: result.errors,
        durationMs: result.durationMs,
      },
    });
  } catch (err) {
    logOperationalEvent("error", "Cron automation endpoint error", { error: String(err) });
    return NextResponse.json(
      { error: "Automation run failed", details: String(err) },
      { status: 500 }
    );
  }
}

// Also support POST for manual testing from curl/Postman
export async function POST(request: NextRequest) {
  return GET(request);
}
