import { NextRequest, NextResponse } from "next/server";
import { runNextBackfillJob } from "@/lib/backfill";
import { logOperationalEvent } from "@/lib/ops-log";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const authorization = request.headers.get("authorization");

  if (secret && authorization !== `Bearer ${secret}`) {
    return NextResponse.json({ ok: false, message: "Unauthorized cron request." }, { status: 401 });
  }

  const mode = request.nextUrl.searchParams.get("mode");
  const summary = await runNextBackfillJob(mode === "mock" ? "mock" : "auto");

  if (summary.status === "failed") {
    logOperationalEvent("warn", "Backfill cron run failed.", {
      source: summary.source ?? "unknown",
      month: summary.month ?? null,
      year: summary.year ?? null
    });
  }

  return NextResponse.json({
    ok: summary.status !== "failed",
    ...summary
  });
}
