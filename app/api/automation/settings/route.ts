/**
 * /api/automation/settings
 *
 * GET  — fetch current AutomationSettings
 * PUT  — update AutomationSettings (partial updates supported)
 */

import { type NextRequest, NextResponse } from "next/server";
import {
  getAutomationSettings,
  upsertAutomationSettings,
  DEFAULT_AUTOMATION_SETTINGS,
} from "@/lib/automation-orchestrator";
import { logOperationalEvent } from "@/lib/ops-log";
import { getCurrentUserContext } from "@/lib/team-auth";

export const dynamic = "force-dynamic";

const VALID_MODES = ["off", "cautious", "aggressive"];

export async function GET() {
  try {
    const settings = await getAutomationSettings();
    return NextResponse.json({ settings, defaults: DEFAULT_AUTOMATION_SETTINGS });
  } catch (err) {
    return NextResponse.json(
      { settings: DEFAULT_AUTOMATION_SETTINGS, defaults: DEFAULT_AUTOMATION_SETTINGS, error: String(err) }
    );
  }
}

export async function PUT(request: NextRequest) {
  const ctx = await getCurrentUserContext(request as never).catch(() => null);
  const email = ctx?.user?.email ?? "anonymous";

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const updates = (body ?? {}) as Record<string, unknown>;

  // Validate automationMode
  if (updates.automationMode && !VALID_MODES.includes(updates.automationMode as string)) {
    return NextResponse.json(
      { error: `automationMode must be one of: ${VALID_MODES.join(", ")}` },
      { status: 400 }
    );
  }

  // Validate numeric limits
  const numericFields = [
    "maxArticlesPerRun",
    "maxBodyFetchesPerRun",
    "maxAIExtractionsPerRun",
    "maxBackfillJobsPerRun",
  ] as const;

  const limits: Record<string, number> = {
    maxArticlesPerRun: 50,
    maxBodyFetchesPerRun: 20,
    maxAIExtractionsPerRun: 10,
    maxBackfillJobsPerRun: 3,
  };

  for (const field of numericFields) {
    if (field in updates) {
      const val = Number(updates[field]);
      if (!Number.isFinite(val) || val < 1 || val > limits[field]) {
        return NextResponse.json(
          { error: `${field} must be between 1 and ${limits[field]}` },
          { status: 400 }
        );
      }
    }
  }

  try {
    const settings = await upsertAutomationSettings({
      ...(typeof updates.rssEnabled === "boolean" && { rssEnabled: updates.rssEnabled }),
      ...(typeof updates.backfillEnabled === "boolean" && { backfillEnabled: updates.backfillEnabled }),
      ...(typeof updates.bodyExtractionEnabled === "boolean" && { bodyExtractionEnabled: updates.bodyExtractionEnabled }),
      ...(typeof updates.aiExtractionEnabled === "boolean" && { aiExtractionEnabled: updates.aiExtractionEnabled }),
      ...(typeof updates.autoCreateDraftRecordsEnabled === "boolean" && { autoCreateDraftRecordsEnabled: updates.autoCreateDraftRecordsEnabled }),
      ...(updates.maxArticlesPerRun !== undefined && { maxArticlesPerRun: Number(updates.maxArticlesPerRun) }),
      ...(updates.maxBodyFetchesPerRun !== undefined && { maxBodyFetchesPerRun: Number(updates.maxBodyFetchesPerRun) }),
      ...(updates.maxAIExtractionsPerRun !== undefined && { maxAIExtractionsPerRun: Number(updates.maxAIExtractionsPerRun) }),
      ...(updates.maxBackfillJobsPerRun !== undefined && { maxBackfillJobsPerRun: Number(updates.maxBackfillJobsPerRun) }),
      ...(updates.automationMode !== undefined && { automationMode: updates.automationMode as never }),
      ...(typeof updates.isPaused === "boolean" && { isPaused: updates.isPaused }),
    });

    logOperationalEvent("info", "Automation settings updated", {
      updatedBy: email,
      keys: Object.keys(updates),
    });

    return NextResponse.json({ success: true, settings });
  } catch (err) {
    return NextResponse.json(
      { error: "Settings update failed", details: String(err) },
      { status: 500 }
    );
  }
}
