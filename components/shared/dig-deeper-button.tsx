"use client";

import { useState } from "react";
import { SearchCode, Loader2, CheckCircle, AlertTriangle, ChevronDown, ChevronUp, ExternalLink } from "lucide-react";
import type { DigDeeperResult, DigDeeperEntityType, DigDeeperFinding } from "@/lib/dig-deeper";

type Props = {
  entityType: DigDeeperEntityType;
  entityId: string;
  entityTitle?: string;
};

type FindingIconProps = { type: DigDeeperFinding["type"] };

function FindingIcon({ type }: FindingIconProps) {
  if (type === "status_change") return <span className="text-amber-500">⚡</span>;
  if (type === "buyer_update") return <span className="text-blue-500">🏢</span>;
  if (type === "talent_update") return <span className="text-purple-500">👤</span>;
  if (type === "similar_project") return <span className="text-emerald-500">🔗</span>;
  if (type === "development_update") return <span className="text-sky-500">📋</span>;
  return <span className="text-slate-400">📰</span>;
}

function confidenceBadge(score: number) {
  if (score >= 0.75) return "bg-emerald-50 text-emerald-700 ring-emerald-200";
  if (score >= 0.5) return "bg-amber-50 text-amber-800 ring-amber-200";
  return "bg-rose-50 text-rose-700 ring-rose-200";
}

export function DigDeeperButton({ entityType, entityId, entityTitle }: Props) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<DigDeeperResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [approving, setApproving] = useState(false);
  const [approved, setApproved] = useState(false);
  const [expanded, setExpanded] = useState(false);

  async function handleDigDeeper() {
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const res = await fetch("/api/dig-deeper", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ entityType, entityId }),
      });

      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error ?? `HTTP ${res.status}`);
      }

      const data = (await res.json()) as { result: DigDeeperResult };
      setResult(data.result);
      setOpen(true);
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  }

  async function handleApprove(applyUpdates: boolean) {
    if (!result?.runId) return;
    setApproving(true);

    try {
      const res = await fetch("/api/dig-deeper/approve", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ runId: result.runId, applyUpdates }),
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setApproved(true);
    } catch (err) {
      setError(String(err));
    } finally {
      setApproving(false);
    }
  }

  const hasSuggestedUpdates = result?.findings.some((f) => f.suggestedFieldUpdates);
  const displayedFindings = expanded ? (result?.findings ?? []) : (result?.findings ?? []).slice(0, 3);

  return (
    <div className="mt-4">
      <button
        onClick={handleDigDeeper}
        disabled={loading}
        className="inline-flex items-center gap-2 rounded-md bg-sky-600 px-3 py-2 text-sm font-medium text-white shadow-sm hover:bg-sky-700 disabled:opacity-50 transition-colors"
      >
        {loading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <SearchCode className="h-4 w-4" />
        )}
        {loading ? "Digging deeper…" : "Dig Deeper"}
      </button>

      {error && (
        <div className="mt-3 flex items-start gap-2 rounded-md border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
          <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {result && open && (
        <div className="mt-4 rounded-lg border bg-white shadow-sm">
          {/* Header */}
          <div className="flex items-center justify-between border-b px-4 py-3">
            <div className="flex items-center gap-2">
              <SearchCode className="h-4 w-4 text-sky-600" />
              <span className="font-semibold text-sm">
                Dig Deeper Results
                {result.dataSource === "mock" && (
                  <span className="ml-2 rounded bg-amber-100 px-1.5 py-0.5 text-xs font-medium text-amber-700">
                    Demo Data
                  </span>
                )}
              </span>
            </div>
            <button
              onClick={() => setOpen(false)}
              className="text-muted-foreground hover:text-foreground text-sm"
            >
              ✕
            </button>
          </div>

          {/* Summary */}
          <div className="px-4 py-3 border-b bg-slate-50">
            <p className="text-sm text-slate-700">{result.summary}</p>
            {result.requiresApproval && !approved && (
              <p className="mt-1 text-xs text-amber-700">
                ⚠ Some findings suggest field updates. Review below and approve before applying.
              </p>
            )}
          </div>

          {/* Findings */}
          <div className="divide-y">
            {displayedFindings.map((finding, i) => (
              <div key={i} className="px-4 py-3">
                <div className="flex items-start gap-2">
                  <FindingIcon type={finding.type} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium">{finding.title}</span>
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs ring-1 ${confidenceBadge(finding.confidence)}`}
                      >
                        {Math.round(finding.confidence * 100)}% confidence
                      </span>
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">{finding.description}</p>
                    {finding.sourceUrl && (
                      <a
                        href={finding.sourceUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-1 inline-flex items-center gap-1 text-xs text-sky-600 hover:underline"
                      >
                        Source <ExternalLink className="h-3 w-3" />
                      </a>
                    )}
                    {finding.suggestedFieldUpdates && (
                      <div className="mt-2 rounded-md border border-amber-200 bg-amber-50 px-2 py-1.5 text-xs text-amber-800">
                        <strong>Suggested update:</strong>{" "}
                        {Object.entries(finding.suggestedFieldUpdates)
                          .map(([k, v]) => `${k} → ${String(v)}`)
                          .join(", ")}
                        <span className="ml-1 text-amber-600">(requires approval)</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Show more / less */}
          {(result.findings.length > 3) && (
            <button
              onClick={() => setExpanded(!expanded)}
              className="flex w-full items-center justify-center gap-1 border-t py-2 text-xs text-muted-foreground hover:text-foreground"
            >
              {expanded ? (
                <><ChevronUp className="h-3 w-3" /> Show fewer</>
              ) : (
                <><ChevronDown className="h-3 w-3" /> Show {result.findings.length - 3} more</>
              )}
            </button>
          )}

          {/* Approval actions */}
          {!approved && (
            <div className="flex items-center gap-3 border-t bg-slate-50 px-4 py-3">
              <span className="text-xs text-muted-foreground">
                All changes require human approval before being applied.
              </span>
              <div className="flex gap-2 ml-auto">
                {hasSuggestedUpdates && (
                  <button
                    onClick={() => handleApprove(true)}
                    disabled={approving}
                    className="inline-flex items-center gap-1.5 rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
                  >
                    {approving ? <Loader2 className="h-3 w-3 animate-spin" /> : <CheckCircle className="h-3 w-3" />}
                    Approve &amp; Apply Updates
                  </button>
                )}
                <button
                  onClick={() => handleApprove(false)}
                  disabled={approving}
                  className="inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-medium hover:bg-slate-100 disabled:opacity-50"
                >
                  Acknowledge (No Changes)
                </button>
              </div>
            </div>
          )}

          {approved && (
            <div className="flex items-center gap-2 border-t bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
              <CheckCircle className="h-4 w-4" />
              Findings acknowledged. Any applied changes are marked Needs Review.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
