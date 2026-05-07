"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Clock,
  Play,
  Pause,
  RefreshCw,
  Loader2,
  Save,
  CheckCircle,
  AlertTriangle,
  Info,
  Rss,
  Database,
  FileText,
  Sparkles,
  PlusCircle,
  Settings2,
} from "lucide-react";
import type { AutomationSettings, AutomationRunRecord, AutomationStepKey } from "@/lib/automation-orchestrator";

// ─── Types ─────────────────────────────────────────────────────────────────────

type DashboardData = {
  dataSource: "database" | "mock";
  settings: AutomationSettings;
  lastRun: AutomationRunRecord | null;
  recentRuns: AutomationRunRecord[];
  stats: {
    runsThisWeek: number;
    articlesThisWeek: number;
    bodiesThisWeek: number;
    extractionsThisWeek: number;
    draftsThisWeek: number;
    errorsThisWeek: number;
  };
};

type RunResult = {
  runId: string;
  mode: string;
  steps: string;
  rssArticlesSaved: number;
  backfillArticles: number;
  bodiesFetched: number;
  aiExtractionsRun: number;
  draftsCreated: number;
  errors: number;
  errorMessages: string[];
  durationMs: number;
  message: string;
  dataSource: string;
};

// ─── Helpers ───────────────────────────────────────────────────────────────────

function fmtDuration(ms: number | null) {
  if (!ms) return "—";
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function fmtDate(d: Date | string | null) {
  if (!d) return "—";
  const date = new Date(d);
  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function fmtRelative(d: Date | string | null) {
  if (!d) return "Never";
  const ms = Date.now() - new Date(d).getTime();
  if (ms < 60_000) return "just now";
  if (ms < 3_600_000) return `${Math.floor(ms / 60_000)}m ago`;
  if (ms < 86_400_000) return `${Math.floor(ms / 3_600_000)}h ago`;
  return `${Math.floor(ms / 86_400_000)}d ago`;
}

const STEP_LABELS: Record<string, { label: string; icon: React.ReactNode; desc: string }> = {
  all:        { label: "Full Run",       icon: <RefreshCw className="h-4 w-4" />,  desc: "RSS → Backfill → Body → AI → Drafts" },
  rss:        { label: "RSS Only",       icon: <Rss className="h-4 w-4" />,        desc: "Fetch new articles from configured feeds" },
  backfill:   { label: "Backfill Only",  icon: <Database className="h-4 w-4" />,   desc: "Run the next queued backfill job" },
  body:       { label: "Body Fetch Only",icon: <FileText className="h-4 w-4" />,   desc: "Fetch body text for unfetched articles" },
  extraction: { label: "AI Extraction",  icon: <Sparkles className="h-4 w-4" />,  desc: "Run AI extraction on unprocessed articles" },
  autodraft:  { label: "Auto-Draft",     icon: <PlusCircle className="h-4 w-4" />, desc: "Create draft records from high-confidence articles" },
};

// ─── Component ─────────────────────────────────────────────────────────────────

export default function AutomationDashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const [runningStep, setRunningStep] = useState<AutomationStepKey | null>(null);
  const [runResult, setRunResult] = useState<RunResult | null>(null);
  const [runError, setRunError] = useState<string | null>(null);

  const [settings, setSettings] = useState<AutomationSettings | null>(null);

  const loadData = useCallback(() => {
    setLoading(true);
    fetch("/api/automation")
      .then((r) => r.json())
      .then((d: DashboardData) => {
        setData(d);
        setSettings(d.settings);
      })
      .catch(() => undefined)
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  // ── Patch a single settings boolean ────────────────────────────────────────
  function setSetting<K extends keyof AutomationSettings>(key: K, value: AutomationSettings[K]) {
    setSettings((s) => s ? { ...s, [key]: value } : s);
  }

  // ── Save settings ───────────────────────────────────────────────────────────
  async function handleSave() {
    if (!settings) return;
    setSaving(true);
    setSaveError(null);
    setSaved(false);
    try {
      const res = await fetch("/api/automation/settings", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(settings),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
      loadData();
    } catch (err) {
      setSaveError(String(err));
    } finally {
      setSaving(false);
    }
  }

  // ── Pause / resume ──────────────────────────────────────────────────────────
  async function togglePause() {
    if (!settings) return;
    const next = !settings.isPaused;
    try {
      await fetch("/api/automation/settings", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ isPaused: next }),
      });
      setSetting("isPaused", next);
      loadData();
    } catch (err) {
      setSaveError(String(err));
    }
  }

  // ── Manual run ──────────────────────────────────────────────────────────────
  async function handleRun(steps: AutomationStepKey) {
    setRunningStep(steps);
    setRunResult(null);
    setRunError(null);
    try {
      const res = await fetch("/api/automation", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ steps }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const d = (await res.json()) as { result: RunResult };
      setRunResult(d.result);
      loadData();
    } catch (err) {
      setRunError(String(err));
    } finally {
      setRunningStep(null);
    }
  }

  if (loading || !data || !settings) {
    return (
      <div className="flex items-center gap-2 py-12 text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading automation dashboard…
      </div>
    );
  }

  const { stats, lastRun, recentRuns } = data;
  const isRunning = runningStep !== null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <section className="rounded-lg border bg-white p-6 shadow-panel">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-primary">Intelligence</p>
        <h1 className="mt-2 flex items-center gap-3 text-3xl font-semibold tracking-tight">
          <Clock className="h-7 w-7 text-violet-500" />
          Automation Scheduler
        </h1>
        <p className="mt-3 max-w-3xl text-muted-foreground">
          Configure and monitor the scheduled pipeline that slowly and safely populates the hub
          without manual intervention. All safety limits are enforced — no records are auto-verified.
        </p>
        {data.dataSource === "mock" && (
          <div className="mt-3 flex items-center gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-700">
            <Info className="h-4 w-4 flex-shrink-0" />
            Preview mode — connect a database to see live run data.
          </div>
        )}
      </section>

      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        {/* ── Left column ── */}
        <div className="space-y-6">

          {/* Status bar */}
          <div className="grid grid-cols-3 gap-3 sm:grid-cols-6">
            {[
              { label: "Runs / week",      value: stats.runsThisWeek,       color: "text-violet-700" },
              { label: "Articles",          value: stats.articlesThisWeek,   color: "text-sky-700" },
              { label: "Bodies fetched",    value: stats.bodiesThisWeek,     color: "text-sky-700" },
              { label: "AI extractions",    value: stats.extractionsThisWeek,color: "text-indigo-700" },
              { label: "Drafts created",    value: stats.draftsThisWeek,     color: "text-emerald-700" },
              { label: "Errors",            value: stats.errorsThisWeek,     color: stats.errorsThisWeek > 0 ? "text-rose-700" : "text-slate-500" },
            ].map((s) => (
              <div key={s.label} className="rounded-lg border bg-white p-3 shadow-sm text-center">
                <div className={`text-2xl font-bold ${s.color}`}>{s.value}</div>
                <div className="mt-0.5 text-xs text-muted-foreground">{s.label}</div>
              </div>
            ))}
          </div>

          {/* Settings */}
          <div className="rounded-lg border bg-white p-5 shadow-sm space-y-5">
            <div className="flex items-center gap-2">
              <Settings2 className="h-4 w-4 text-slate-500" />
              <h2 className="text-base font-semibold">Automation Settings</h2>
            </div>

            {/* Mode */}
            <div>
              <label className="block text-sm font-medium mb-1.5">Automation Mode</label>
              <div className="flex gap-2 flex-wrap">
                {(["off", "cautious", "aggressive"] as const).map((m) => (
                  <label
                    key={m}
                    className={`flex cursor-pointer items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm font-medium transition-colors ${
                      settings.automationMode === m
                        ? m === "off" ? "border-slate-400 bg-slate-100 text-slate-800"
                          : m === "cautious" ? "border-sky-400 bg-sky-50 text-sky-800"
                          : "border-amber-400 bg-amber-50 text-amber-800"
                        : "bg-white hover:bg-slate-50 text-slate-600"
                    }`}
                  >
                    <input
                      type="radio"
                      name="automationMode"
                      value={m}
                      checked={settings.automationMode === m}
                      onChange={() => setSetting("automationMode", m)}
                      className="sr-only"
                    />
                    {m.charAt(0).toUpperCase() + m.slice(1)}
                  </label>
                ))}
              </div>
              <p className="mt-1.5 text-xs text-muted-foreground">
                {settings.automationMode === "off" && "No automated processing. All pipeline steps must be triggered manually."}
                {settings.automationMode === "cautious" && "Runs each step conservatively within the limits below. Draft creation requires ≥ threshold confidence."}
                {settings.automationMode === "aggressive" && "Same as Cautious but with a 10-point lower effective confidence threshold for draft creation."}
              </p>
            </div>

            {/* Step toggles */}
            <div>
              <label className="block text-sm font-medium mb-2">Enabled Steps</label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {([
                  ["rssEnabled", "RSS Ingestion", "Fetch new articles from configured feeds"],
                  ["backfillEnabled", "Backfill Jobs", "Run one queued backfill job per run"],
                  ["bodyExtractionEnabled", "Body Fetching", "Fetch article body text (respects robots.txt)"],
                  ["aiExtractionEnabled", "AI Extraction", "Extract structured data using AI"],
                  ["autoCreateDraftRecordsEnabled", "Auto-Create Drafts", "Create draft records above confidence threshold"],
                ] as [keyof AutomationSettings, string, string][]).map(([key, label, desc]) => (
                  <label key={key} className="flex cursor-pointer items-start gap-2.5 rounded-md border p-3 hover:bg-slate-50 transition-colors">
                    <input
                      type="checkbox"
                      checked={Boolean(settings[key])}
                      onChange={(e) => setSetting(key, e.target.checked as never)}
                      className="mt-0.5 h-4 w-4 accent-sky-600"
                    />
                    <div>
                      <div className="text-sm font-medium">{label}</div>
                      <div className="text-xs text-muted-foreground">{desc}</div>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            {/* Limits */}
            <div>
              <label className="block text-sm font-medium mb-2">Per-Run Limits</label>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {([
                  ["maxArticlesPerRun", "Articles / run", 1, 50],
                  ["maxBodyFetchesPerRun", "Body fetches", 1, 20],
                  ["maxAIExtractionsPerRun", "AI extractions", 1, 10],
                  ["maxBackfillJobsPerRun", "Backfill jobs", 1, 3],
                ] as [keyof AutomationSettings, string, number, number][]).map(([key, label, min, max]) => (
                  <div key={key}>
                    <label className="block text-xs text-muted-foreground mb-1">{label}</label>
                    <div className="flex items-center gap-1.5">
                      <input
                        type="number"
                        min={min}
                        max={max}
                        value={Number(settings[key])}
                        onChange={(e) => setSetting(key, Math.min(max, Math.max(min, parseInt(e.target.value) || min)) as never)}
                        className="w-full rounded border px-2 py-1 text-sm text-center focus:outline-none focus:ring-2 focus:ring-sky-400"
                      />
                      <span className="text-xs text-muted-foreground">max {max}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Save */}
            <div className="flex items-center gap-3 pt-1 border-t">
              <button
                onClick={handleSave}
                disabled={saving}
                className="inline-flex items-center gap-2 rounded-md bg-sky-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-sky-700 disabled:opacity-50 transition-colors"
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                {saving ? "Saving…" : "Save Settings"}
              </button>
              {saved && (
                <span className="flex items-center gap-1.5 text-sm text-emerald-600">
                  <CheckCircle className="h-4 w-4" /> Saved
                </span>
              )}
              {saveError && (
                <span className="flex items-center gap-1.5 text-sm text-rose-600">
                  <AlertTriangle className="h-4 w-4" /> {saveError}
                </span>
              )}
            </div>
          </div>

          {/* Run result */}
          {(runResult || runError) && (
            <div className={`rounded-lg border p-4 text-sm ${runError ? "border-rose-200 bg-rose-50" : "border-emerald-200 bg-emerald-50"}`}>
              {runError ? (
                <p className="font-medium text-rose-700 flex items-center gap-1.5">
                  <AlertTriangle className="h-4 w-4" /> {runError}
                </p>
              ) : runResult && (
                <div className="space-y-2">
                  <p className="font-medium text-emerald-800 flex items-center gap-1.5">
                    <CheckCircle className="h-4 w-4" /> {runResult.message}
                  </p>
                  {runResult.dataSource === "mock" && (
                    <p className="text-xs text-amber-700">Demo data — connect a database for live results.</p>
                  )}
                  <div className="grid grid-cols-3 gap-2 pt-1">
                    {[
                      ["RSS saved", runResult.rssArticlesSaved, "text-sky-700"],
                      ["Bodies", runResult.bodiesFetched, "text-sky-700"],
                      ["AI runs", runResult.aiExtractionsRun, "text-indigo-700"],
                      ["Drafts", runResult.draftsCreated, "text-emerald-700"],
                      ["Errors", runResult.errors, runResult.errors > 0 ? "text-rose-700" : "text-slate-500"],
                      ["Time", fmtDuration(runResult.durationMs), "text-slate-700"],
                    ].map(([label, val, cls]) => (
                      <div key={label as string} className="text-center">
                        <div className={`text-lg font-bold ${cls}`}>{val}</div>
                        <div className="text-xs text-muted-foreground">{label}</div>
                      </div>
                    ))}
                  </div>
                  {runResult.errorMessages?.length > 0 && (
                    <details className="pt-1">
                      <summary className="text-xs cursor-pointer text-rose-700">Show errors</summary>
                      <pre className="mt-1 text-xs bg-white rounded p-2 overflow-auto">{runResult.errorMessages.join("\n")}</pre>
                    </details>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Run history */}
          <div className="rounded-lg border bg-white shadow-sm overflow-hidden">
            <div className="flex items-center justify-between px-5 py-3 border-b">
              <h2 className="text-sm font-semibold">Recent Runs</h2>
              <span className="text-xs text-muted-foreground">{recentRuns.length} shown</span>
            </div>
            {recentRuns.length === 0 ? (
              <p className="px-5 py-8 text-sm text-muted-foreground text-center">No runs recorded yet.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-slate-50 text-left text-muted-foreground">
                      <th className="px-4 py-2 font-medium">When</th>
                      <th className="px-4 py-2 font-medium">Trigger</th>
                      <th className="px-4 py-2 font-medium">Steps</th>
                      <th className="px-4 py-2 font-medium text-right">RSS</th>
                      <th className="px-4 py-2 font-medium text-right">Bodies</th>
                      <th className="px-4 py-2 font-medium text-right">AI</th>
                      <th className="px-4 py-2 font-medium text-right">Drafts</th>
                      <th className="px-4 py-2 font-medium text-right">Err</th>
                      <th className="px-4 py-2 font-medium text-right">Time</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {recentRuns.map((run) => (
                      <tr key={run.id} className="hover:bg-slate-50 transition-colors">
                        <td className="px-4 py-2 text-muted-foreground whitespace-nowrap">
                          {fmtRelative(run.createdAt)}
                          <span className="ml-1 text-slate-300">·</span>
                          <span className="ml-1 text-slate-400">{fmtDate(run.createdAt)}</span>
                        </td>
                        <td className="px-4 py-2">
                          <span className={`rounded px-1.5 py-0.5 text-xs font-medium ${
                            run.triggeredBy === "cron" ? "bg-violet-50 text-violet-700"
                            : run.triggeredBy.startsWith("manual") ? "bg-sky-50 text-sky-700"
                            : "bg-slate-100 text-slate-600"
                          }`}>
                            {run.triggeredBy.startsWith("manual:") ? "manual" : run.triggeredBy}
                          </span>
                        </td>
                        <td className="px-4 py-2 text-muted-foreground">{run.steps}</td>
                        <td className="px-4 py-2 text-right font-medium">{run.rssArticlesSaved}</td>
                        <td className="px-4 py-2 text-right font-medium">{run.bodiesFetched}</td>
                        <td className="px-4 py-2 text-right font-medium">{run.aiExtractionsRun}</td>
                        <td className="px-4 py-2 text-right font-medium text-emerald-700">{run.draftsCreated}</td>
                        <td className={`px-4 py-2 text-right font-medium ${run.errors > 0 ? "text-rose-700" : "text-slate-400"}`}>
                          {run.errors || "—"}
                        </td>
                        <td className="px-4 py-2 text-right text-muted-foreground">{fmtDuration(run.durationMs)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* ── Right column ── */}
        <div className="space-y-4">

          {/* Last run / next run */}
          <div className="rounded-lg border bg-white p-4 shadow-sm space-y-3">
            <h2 className="text-sm font-semibold">Schedule Status</h2>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Last run</span>
                <span className="font-medium">{fmtRelative(lastRun?.createdAt ?? null)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Last duration</span>
                <span className="font-medium">{fmtDuration(lastRun?.durationMs ?? null)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Cron schedule</span>
                <code className="rounded bg-slate-100 px-1.5 py-0.5 text-xs">every 6 hours</code>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Status</span>
                <span className={`flex items-center gap-1 text-xs font-medium rounded-full px-2 py-0.5 ${
                  settings.automationMode === "off" ? "bg-slate-100 text-slate-600"
                  : settings.isPaused ? "bg-amber-50 text-amber-700"
                  : "bg-emerald-50 text-emerald-700"
                }`}>
                  <span className={`h-1.5 w-1.5 rounded-full ${
                    settings.automationMode === "off" ? "bg-slate-400"
                    : settings.isPaused ? "bg-amber-500"
                    : "bg-emerald-500"
                  }`} />
                  {settings.automationMode === "off" ? "Off"
                    : settings.isPaused ? "Paused"
                    : "Active"}
                </span>
              </div>
            </div>

            <div className="pt-1 border-t">
              <button
                onClick={togglePause}
                disabled={settings.automationMode === "off"}
                className={`w-full inline-flex items-center justify-center gap-2 rounded-md border px-3 py-2 text-sm font-medium transition-colors disabled:opacity-40 ${
                  settings.isPaused
                    ? "border-emerald-300 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                    : "border-amber-300 bg-amber-50 text-amber-700 hover:bg-amber-100"
                }`}
              >
                {settings.isPaused ? (
                  <><Play className="h-3.5 w-3.5" /> Resume Automation</>
                ) : (
                  <><Pause className="h-3.5 w-3.5" /> Pause Automation</>
                )}
              </button>
            </div>
          </div>

          {/* Manual controls */}
          <div className="rounded-lg border bg-white p-4 shadow-sm space-y-3">
            <h2 className="text-sm font-semibold">Manual Controls</h2>
            <p className="text-xs text-muted-foreground">
              Run specific pipeline steps now. Limits from settings apply.
            </p>
            <div className="space-y-2">
              {(Object.entries(STEP_LABELS) as [AutomationStepKey, typeof STEP_LABELS[string]][]).map(([step, meta]) => (
                <button
                  key={step}
                  onClick={() => handleRun(step)}
                  disabled={isRunning}
                  className="w-full flex items-center gap-2.5 rounded-md border px-3 py-2.5 text-left text-sm hover:bg-slate-50 disabled:opacity-50 transition-colors"
                >
                  <span className={`flex-shrink-0 ${runningStep === step ? "text-sky-500 animate-spin" : "text-slate-500"}`}>
                    {runningStep === step ? <Loader2 className="h-4 w-4" /> : meta.icon}
                  </span>
                  <div>
                    <div className="font-medium">{meta.label}</div>
                    <div className="text-xs text-muted-foreground">{meta.desc}</div>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Safety info */}
          <div className="rounded-lg border bg-sky-50 p-4 space-y-2">
            <div className="flex items-start gap-2">
              <Info className="mt-0.5 h-4 w-4 flex-shrink-0 text-sky-600" />
              <div>
                <p className="text-sm font-medium text-sky-800">Safety Guarantees</p>
                <ul className="mt-1.5 space-y-1 text-xs text-sky-700">
                  <li>✓ Hard per-step limits — never unlimited</li>
                  <li>✓ Job lock prevents parallel runs</li>
                  <li>✓ Robots.txt respected on every fetch</li>
                  <li>✓ One source failure does not abort the run</li>
                  <li>✓ Draft records only — no auto-verification</li>
                  <li>✓ Deduplication before creation</li>
                  <li>✓ Full audit trail for every action</li>
                </ul>
              </div>
            </div>
          </div>

          {/* Vercel cron note */}
          <div className="rounded-lg border bg-slate-50 p-4 text-xs text-muted-foreground space-y-1.5">
            <p className="font-medium text-slate-700">Vercel Cron</p>
            <p>
              Configured to run every 6 hours via <code className="rounded bg-white border px-1">vercel.json</code>.
              Free tier is limited to once per day — that is acceptable. Pro tier allows every minute.
            </p>
            <p>
              Cron requests are authenticated via <code className="rounded bg-white border px-1">CRON_SECRET</code> env var.
              Set this in your Vercel project environment settings.
            </p>
            <p className="text-amber-600">
              The cron endpoint is idempotent — re-running after a partial failure is safe.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
