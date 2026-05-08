/**
 * /api/automation
 *
 * Manual trigger for the automation pipeline.
 * Supports running the full pipeline or individual steps.
 *
 * Body:
 *   steps?: "all" | "rss" | "backfill" | "body" | "extraction" | "autodraft"
 *   overrideSettings?: Partial<AutomationSettings>
 */

import { type NextRequest, NextResponse } from "next/server";
import { runAutomation, getAutomationDashboardData } from "@/lib/automation-orchestrator";
import type { AutomationStepKey } from "@/lib/automation-orchestrator";
import { logOperationalEvent } from "@/lib/ops-log";
import { getCurrentUserContext } from "@/lib/team-auth";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const VALID_STEPS: AutomationStepKey[] = [
  "all", "rss", "backfill", "body", "extraction", "autodraft",
];

export async function GET() {
  try {
    const data = await getAutomationDashboardData();
    return NextResponse.json(data);
  } catch (err) {
    return NextResponse.json(
      { error: "Failed to load dashboard data", details: String(err) },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const ctx = await getCurrentUserContext().catch(() => null);
  const email = ctx?.user?.email ?? "anonymous";

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    body = {};
  }

  const { steps, overrideSettings } = (body ?? {}) as Record<string, unknown>;

  if (steps && !VALID_STEPS.includes(steps as AutomationStepKey)) {
    return NextResponse.json(
      { error: `steps must be one of: ${VALID_STEPS.join(", ")}` },
      { status: 400 }
    );
  }

  try {
    logOperationalEvent("info", "Automation manually triggered", {
      email,
      steps: steps ?? "all",
    });

    const result = await runAutomation({
      triggeredBy: `manual:${email}`,
      steps: (steps as AutomationStepKey) ?? "all",
      overrideSettings: (overrideSettings as never) ?? undefined,
    });

    return NextResponse.json({ result });
  } catch (err) {
    logOperationalEvent("error", "Automation manual trigger error", { error: String(err), email });
    return NextResponse.json(
      { error: "Automation run failed", details: String(err) },
      { status: 500 }
    );
  }
}
