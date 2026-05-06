import { NextRequest, NextResponse } from "next/server";
import { sendHighSeverityAlertDigest } from "@/lib/email-jobs";
import { withControlledJob } from "@/lib/job-control";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const authorization = request.headers.get("authorization");

  if (secret && authorization !== `Bearer ${secret}`) {
    return NextResponse.json({ ok: false, message: "Unauthorized cron request." }, { status: 401 });
  }

  const run = await withControlledJob({
    jobType: "email_send",
    createdByEmail: "cron",
    inputJson: { mode: "alert_digest", trigger: "cron" },
    lockKey: `alert-digest:${new Date().toISOString().slice(0, 13)}`,
    dedupeMinutes: 60,
    handler: async () => sendHighSeverityAlertDigest()
  });
  return NextResponse.json({
    ok: true,
    ...run
  });
}
