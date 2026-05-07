import { NextRequest, NextResponse } from "next/server";
import { sendScheduledWeeklyReport } from "@/lib/email-jobs";
import { withControlledJob } from "@/lib/job-control";
import { getDefaultFriday } from "@/lib/weekly-report";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const authorization = request.headers.get("authorization");

  if (secret && authorization !== `Bearer ${secret}`) {
    return NextResponse.json({ ok: false, message: "Unauthorized cron request." }, { status: 401 });
  }

  const friday = getDefaultFriday(new Date()).toISOString().slice(0, 10);
  const run = await withControlledJob({
    jobType: "email_send",
    createdByEmail: "cron",
    inputJson: { mode: "weekly_report", reportDate: friday, trigger: "cron" },
    lockKey: `weekly-report:${friday}`,
    dedupeMinutes: 60 * 24,
    handler: async () => sendScheduledWeeklyReport()
  });
  return NextResponse.json({
    ok: true,
    ...run
  });
}
