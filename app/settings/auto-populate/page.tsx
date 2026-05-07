"use client";

import { useState, useEffect } from "react";
import { Zap, Save, Loader2, Info, AlertTriangle, CheckCircle, Play } from "lucide-react";
import type { AutoPopulateMode, AppSettingsMap } from "@/lib/app-settings";

type SettingsPayload = Partial<AppSettingsMap>;
type RunResult = {
  mode: string;
  articlesProcessed: number;
  projectsCreated: number;
  showsCreated: number;
  flaggedForReview: number;
  skipped: number;
  errors: number;
  message: string;
  dataSource: string;
};

const MODE_LABELS: Record<AutoPopulateMode, { label: string; description: string; color: string }> = {
  off: {
    label: "Off",
    description: "All articles stay in the review queue. No records are auto-created.",
    color: "bg-slate-100 text-slate-700",
  },
  cautious: {
    label: "Cautious",
    description:
      "High-confidence articles (≥ threshold) create draft records marked 'Auto-Created / Needs Review'. Low-confidence articles remain in the review queue.",
    color: "bg-sky-50 text-sky-700",
  },
  aggressive: {
    label: "Aggressive",
    description:
      "Same as Cautious but with a 10-point lower effective threshold, so more articles trigger draft creation. All records still require human review.",
    color: "bg-amber-50 text-amber-700",
  },
};

export default function AutoPopulateSettingsPage() {
  const [settings, setSettings] = useState<SettingsPayload>({
    autoPopulateMode: "off",
    autoPopulateHighConfidenceThreshold: "0.80",
    autoPopulateEnableBodyFetch: "true",
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [running, setRunning] = useState(false);
  const [saved, setSaved] = useState(false);
  const [runResult, setRunResult] = useState<RunResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/autonomous-population/settings")
      .then((r) => r.json())
      .then((data: { settings: SettingsPayload }) => {
        if (data.settings) setSettings((prev) => ({ ...prev, ...data.settings }));
      })
      .catch(() => undefined)
      .finally(() => setLoading(false));
  }, []);

  async function handleSave() {
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      const res = await fetch("/api/autonomous-population/settings", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(settings),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      setError(String(err));
    } finally {
      setSaving(false);
    }
  }

  async function handleRunNow() {
    setRunning(true);
    setError(null);
    setRunResult(null);
    try {
      const res = await fetch("/api/autonomous-population", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ limit: 20 }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as { summary: RunResult };
      setRunResult(data.summary);
    } catch (err) {
      setError(String(err));
    } finally {
      setRunning(false);
    }
  }

  const currentMode = (settings.autoPopulateMode ?? "off") as AutoPopulateMode;
  const thresholdPct = Math.round(parseFloat(settings.autoPopulateHighConfidenceThreshold ?? "0.80") * 100);

  return (
    <div className="space-y-6">
      {/* Header */}
      <section className="rounded-lg border bg-white p-6 shadow-panel">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-primary">Intelligence</p>
        <h1 className="mt-2 flex items-center gap-3 text-3xl font-semibold tracking-tight">
          <Zap className="h-7 w-7 text-amber-500" />
          Auto-Population Settings
        </h1>
        <p className="mt-3 max-w-3xl text-muted-foreground">
          Control how the system automatically creates draft Project and CurrentShow records from
          ingested articles. Auto-created records are always marked{" "}
          <strong>Needs Review</strong> and are never published as verified without human approval.
        </p>
      </section>

      {loading ? (
        <div className="flex items-center gap-2 py-8 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading settings…
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
          {/* Settings form */}
          <div className="space-y-6">
            {/* Mode selector */}
            <div className="rounded-lg border bg-white p-5 shadow-sm">
              <h2 className="text-base font-semibold">Population Mode</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Choose how aggressively the system creates draft records.
              </p>
              <div className="mt-4 space-y-3">
                {(["off", "cautious", "aggressive"] as AutoPopulateMode[]).map((mode) => {
                  const meta = MODE_LABELS[mode];
                  const selected = currentMode === mode;
                  return (
                    <label
                      key={mode}
                      className={`flex cursor-pointer items-start gap-3 rounded-md border p-3 transition-colors ${
                        selected ? "border-sky-400 bg-sky-50" : "hover:bg-slate-50"
                      }`}
                    >
                      <input
                        type="radio"
                        name="autoPopulateMode"
                        value={mode}
                        checked={selected}
                        onChange={() => setSettings((s) => ({ ...s, autoPopulateMode: mode }))}
                        className="mt-0.5 accent-sky-600"
                      />
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-sm">{meta.label}</span>
                          <span className={`rounded px-1.5 py-0.5 text-xs font-medium ${meta.color}`}>
                            {mode}
                          </span>
                        </div>
                        <p className="mt-0.5 text-xs text-muted-foreground">{meta.description}</p>
                      </div>
                    </label>
                  );
                })}
              </div>
            </div>

            {/* Confidence threshold */}
            <div className="rounded-lg border bg-white p-5 shadow-sm">
              <h2 className="text-base font-semibold">Confidence Threshold</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Minimum confidence score required to auto-create a draft record in{" "}
                <strong>Cautious</strong> mode. In Aggressive mode, the effective threshold is 10
                points lower.
              </p>
              <div className="mt-4 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Threshold: {thresholdPct}%</span>
                  <span className="text-xs text-muted-foreground">
                    Aggressive effective: {Math.max(50, thresholdPct - 10)}%
                  </span>
                </div>
                <input
                  type="range"
                  min={60}
                  max={95}
                  step={5}
                  value={thresholdPct}
                  onChange={(e) =>
                    setSettings((s) => ({
                      ...s,
                      autoPopulateHighConfidenceThreshold: String(Number(e.target.value) / 100),
                    }))
                  }
                  className="w-full accent-sky-600"
                />
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>60% (more records)</span>
                  <span>95% (fewer records)</span>
                </div>
              </div>
            </div>

            {/* Body fetch */}
            <div className="rounded-lg border bg-white p-5 shadow-sm">
              <h2 className="text-base font-semibold">Article Body Fetching</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                When enabled, the pipeline will attempt to fetch article body text (respecting
                robots.txt) before extraction. Improves confidence but uses more requests.
              </p>
              <label className="mt-3 flex cursor-pointer items-center gap-2">
                <input
                  type="checkbox"
                  checked={settings.autoPopulateEnableBodyFetch === "true"}
                  onChange={(e) =>
                    setSettings((s) => ({
                      ...s,
                      autoPopulateEnableBodyFetch: e.target.checked ? "true" : "false",
                    }))
                  }
                  className="h-4 w-4 accent-sky-600"
                />
                <span className="text-sm font-medium">Enable body fetching</span>
              </label>
            </div>

            {/* Save button */}
            <div className="flex items-center gap-3">
              <button
                onClick={handleSave}
                disabled={saving}
                className="inline-flex items-center gap-2 rounded-md bg-sky-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-sky-700 disabled:opacity-50"
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                {saving ? "Saving…" : "Save Settings"}
              </button>
              {saved && (
                <span className="flex items-center gap-1.5 text-sm text-emerald-600">
                  <CheckCircle className="h-4 w-4" /> Saved
                </span>
              )}
              {error && (
                <span className="flex items-center gap-1.5 text-sm text-rose-600">
                  <AlertTriangle className="h-4 w-4" /> {error}
                </span>
              )}
            </div>
          </div>

          {/* Right column */}
          <div className="space-y-4">
            {/* Info card */}
            <div className="rounded-lg border bg-sky-50 p-4">
              <div className="flex items-start gap-2">
                <Info className="mt-0.5 h-4 w-4 flex-shrink-0 text-sky-600" />
                <div className="text-sm text-sky-800 space-y-1.5">
                  <p className="font-medium">How it works</p>
                  <p>After RSS ingestion or backfill, articles are processed through the pipeline:</p>
                  <ol className="list-decimal list-inside space-y-1 text-xs text-sky-700">
                    <li>Fetch article body (if allowed)</li>
                    <li>Run AI extraction (if OPENAI_API_KEY set)</li>
                    <li>Calculate confidence score</li>
                    <li>Check for duplicates</li>
                    <li>Create draft record if confidence ≥ threshold</li>
                    <li>Flag low-confidence items for review</li>
                    <li>Log every step to audit trail</li>
                  </ol>
                </div>
              </div>
            </div>

            {/* Guarantees card */}
            <div className="rounded-lg border bg-white p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
                Guarantees
              </p>
              <ul className="space-y-1.5 text-xs text-slate-700">
                <li>✓ Never auto-creates verified records</li>
                <li>✓ All records marked Needs Review</li>
                <li>✓ Source URL always preserved</li>
                <li>✓ Full audit trail for every action</li>
                <li>✓ Deduplication before creation</li>
                <li>✓ Respects robots.txt</li>
                <li>✓ Rate limits enforced</li>
                <li>✓ Job lock prevents parallel runs</li>
              </ul>
            </div>

            {/* Manual run */}
            <div className="rounded-lg border bg-white p-4">
              <p className="text-sm font-semibold mb-1">Manual Run</p>
              <p className="text-xs text-muted-foreground mb-3">
                Process up to 20 pending articles right now using current settings.
              </p>
              <button
                onClick={handleRunNow}
                disabled={running || currentMode === "off"}
                className="inline-flex w-full items-center justify-center gap-2 rounded-md border bg-white px-3 py-2 text-sm font-medium hover:bg-slate-50 disabled:opacity-50 transition-colors"
              >
                {running ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Play className="h-4 w-4 text-emerald-600" />
                )}
                {running ? "Running…" : currentMode === "off" ? "Enable a mode to run" : "Run Now (20 articles)"}
              </button>
              {runResult && (
                <div className="mt-3 rounded-md border bg-slate-50 p-3 text-xs space-y-1">
                  <p className="font-medium text-slate-700">{runResult.message}</p>
                  {runResult.dataSource === "mock" && (
                    <p className="text-amber-600">Demo data — connect a database for live results.</p>
                  )}
                  <div className="grid grid-cols-2 gap-1 pt-1 text-muted-foreground">
                    <span>Processed: <strong className="text-slate-700">{runResult.articlesProcessed}</strong></span>
                    <span>Projects: <strong className="text-emerald-700">{runResult.projectsCreated}</strong></span>
                    <span>Shows: <strong className="text-emerald-700">{runResult.showsCreated}</strong></span>
                    <span>Flagged: <strong className="text-amber-700">{runResult.flaggedForReview}</strong></span>
                    <span>Skipped: <strong className="text-slate-700">{runResult.skipped}</strong></span>
                    <span>Errors: <strong className="text-rose-700">{runResult.errors}</strong></span>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
