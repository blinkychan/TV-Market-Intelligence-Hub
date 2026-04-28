import { NextRequest, NextResponse } from "next/server";
import { runNextBackfillJob } from "@/lib/backfill";

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

  return NextResponse.json({
    ok: summary.status !== "failed",
    ...summary
  });
}
