export function isProductionEnvironment() {
  return process.env.NODE_ENV === "production" || process.env.VERCEL_ENV === "production";
}

export function isMockPreviewExplicitlyEnabled() {
  return process.env.ALLOW_MOCK_PREVIEW === "true";
}

export function canUseMockPreview() {
  return !isProductionEnvironment() || isMockPreviewExplicitlyEnabled();
}

export function mockPreviewDisabledReason() {
  if (canUseMockPreview()) return null;
  return "Mock preview data is disabled in production. Connect Supabase/Postgres and seed starter data if you want a working hosted review surface.";
}
