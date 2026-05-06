import { NextRequest, NextResponse } from "next/server";
import { sendScheduledWeeklyReport } from "@/lib/email-jobs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const authorization = request.headers.get("authorization");

  if (secret && authorization !== `Bearer ${secret}`) {
    return NextResponse.json({ ok: false, message: "Unauthorized cron request." }, { status: 401 });
  }

  const run = await sendScheduledWeeklyReport();
  return NextResponse.json({
    ok: true,
    ...run
  });
}
