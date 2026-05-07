import { prisma } from "@/lib/prisma";
import { logOperationalEvent } from "@/lib/ops-log";

export type AutoPopulateMode = "off" | "cautious" | "aggressive";

export type AppSettingsMap = {
  autoPopulateMode: AutoPopulateMode;
  autoPopulateHighConfidenceThreshold: string;
  autoPopulateEnableBodyFetch: string;
  semanticSearchEnabled: string;
  digDeeperEnabled: string;
};

const DEFAULTS: AppSettingsMap = {
  autoPopulateMode: "off",
  autoPopulateHighConfidenceThreshold: "0.80",
  autoPopulateEnableBodyFetch: "true",
  semanticSearchEnabled: "true",
  digDeeperEnabled: "true",
};

export async function getAppSetting<K extends keyof AppSettingsMap>(
  key: K,
  fallback?: AppSettingsMap[K]
): Promise<AppSettingsMap[K]> {
  try {
    const row = await prisma.appSettings.findUnique({ where: { key } });
    const value = row?.value ?? fallback ?? DEFAULTS[key];
    return value as AppSettingsMap[K];
  } catch {
    return (fallback ?? DEFAULTS[key]) as AppSettingsMap[K];
  }
}

export async function setAppSetting<K extends keyof AppSettingsMap>(
  key: K,
  value: AppSettingsMap[K]
): Promise<void> {
  try {
    await prisma.appSettings.upsert({
      where: { key },
      update: { value: String(value) },
      create: { key, value: String(value) },
    });
    logOperationalEvent("info", `AppSettings updated: ${key} = ${value}`);
  } catch (err) {
    logOperationalEvent("error", `AppSettings update failed: ${key}`, { error: String(err) });
    throw err;
  }
}

export async function getAllAppSettings(): Promise<Partial<AppSettingsMap>> {
  try {
    const rows = await prisma.appSettings.findMany();
    const result: Partial<AppSettingsMap> = {};
    for (const row of rows) {
      if (row.key in DEFAULTS) {
        (result as Record<string, string>)[row.key] = row.value;
      }
    }
    return result;
  } catch {
    return {};
  }
}

export async function getAutoPopulateMode(): Promise<AutoPopulateMode> {
  const value = await getAppSetting("autoPopulateMode");
  if (value === "cautious" || value === "aggressive") return value;
  return "off";
}

export async function getHighConfidenceThreshold(): Promise<number> {
  const raw = await getAppSetting("autoPopulateHighConfidenceThreshold");
  const parsed = parseFloat(raw);
  return Number.isFinite(parsed) ? Math.max(0.5, Math.min(1.0, parsed)) : 0.80;
}

// Mock fallback for demo mode
export const MOCK_APP_SETTINGS: Partial<AppSettingsMap> = {
  autoPopulateMode: "cautious",
  autoPopulateHighConfidenceThreshold: "0.80",
  autoPopulateEnableBodyFetch: "true",
  semanticSearchEnabled: "true",
  digDeeperEnabled: "true",
};
