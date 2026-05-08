import { type NextRequest, NextResponse } from "next/server";
import {
  getAllAppSettings,
  setAppSetting,
  MOCK_APP_SETTINGS,
} from "@/lib/app-settings";
import { canUseMockPreview } from "@/lib/runtime-mode";
import { logOperationalEvent } from "@/lib/ops-log";
import { getCurrentUserContext } from "@/lib/team-auth";
import type { AutoPopulateMode, AppSettingsMap } from "@/lib/app-settings";

export const dynamic = "force-dynamic";

const VALID_MODES: AutoPopulateMode[] = ["off", "cautious", "aggressive"];

export async function GET() {
  if (canUseMockPreview()) {
    try {
      const { prisma } = await import("@/lib/prisma");
      const count = await prisma.appSettings.count().catch(() => -1);
      if (count <= 0) {
        return NextResponse.json({ settings: MOCK_APP_SETTINGS, dataSource: "mock" });
      }
    } catch {
      return NextResponse.json({ settings: MOCK_APP_SETTINGS, dataSource: "mock" });
    }
  }

  try {
    const settings = await getAllAppSettings();
    // Fill in defaults for missing keys
    const merged = { ...MOCK_APP_SETTINGS, ...settings };
    return NextResponse.json({ settings: merged, dataSource: "database" });
  } catch (err) {
    return NextResponse.json({ settings: MOCK_APP_SETTINGS, dataSource: "mock", error: String(err) });
  }
}

export async function PUT(request: NextRequest) {
  const ctx = await getCurrentUserContext().catch(() => null);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const updates = (body ?? {}) as Partial<AppSettingsMap>;

  // Validate mode if provided
  if (updates.autoPopulateMode && !VALID_MODES.includes(updates.autoPopulateMode)) {
    return NextResponse.json(
      { error: `autoPopulateMode must be one of: ${VALID_MODES.join(", ")}` },
      { status: 400 }
    );
  }

  // Validate threshold if provided
  if (updates.autoPopulateHighConfidenceThreshold) {
    const parsed = parseFloat(updates.autoPopulateHighConfidenceThreshold);
    if (!Number.isFinite(parsed) || parsed < 0.5 || parsed > 1.0) {
      return NextResponse.json(
        { error: "autoPopulateHighConfidenceThreshold must be a number between 0.5 and 1.0" },
        { status: 400 }
      );
    }
  }

  try {
    const allowedKeys: (keyof AppSettingsMap)[] = [
      "autoPopulateMode",
      "autoPopulateHighConfidenceThreshold",
      "autoPopulateEnableBodyFetch",
      "semanticSearchEnabled",
      "digDeeperEnabled",
    ];

    for (const key of allowedKeys) {
      if (key in updates && updates[key] !== undefined) {
        await setAppSetting(key, updates[key]!);
      }
    }

    logOperationalEvent("info", "App settings updated via API", {
      updatedBy: ctx?.user?.email ?? "anonymous",
      keys: Object.keys(updates),
    });

    return NextResponse.json({ success: true, updated: Object.keys(updates) });
  } catch (err) {
    return NextResponse.json({ error: "Settings update failed", details: String(err) }, { status: 500 });
  }
}
