"use client";

import { useMemo, useState } from "react";
import { AlertTriangle, PencilLine } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";

type BulkEditPanelProps = {
  entityType: "Project" | "CurrentShow" | "Article";
  selectedIds: string[];
  canEdit: boolean;
  canArchive: boolean;
  onApplied?: () => void;
};

const ACTION_OPTIONS: Record<BulkEditPanelProps["entityType"], Array<{ value: string; label: string; requiresValue?: boolean; adminOnly?: boolean }>> = {
  Project: [
    { value: "needs_review", label: "Mark needs review" },
    { value: "status", label: "Update status", requiresValue: true },
    { value: "buyer", label: "Update buyer", requiresValue: true },
    { value: "genre", label: "Update genre", requiresValue: true },
    { value: "confidence_level", label: "Update confidence level", requiresValue: true },
    { value: "mark_stale", label: "Mark stale" },
    { value: "add_tag", label: "Add tag", requiresValue: true },
    { value: "remove_tag", label: "Remove tag", requiresValue: true },
    { value: "archive", label: "Archive / soft-delete", adminOnly: true }
  ],
  CurrentShow: [
    { value: "status", label: "Update status", requiresValue: true },
    { value: "genre", label: "Update genre", requiresValue: true },
    { value: "confidence_level", label: "Update confidence level", requiresValue: true },
    { value: "source_reliability", label: "Assign source reliability", requiresValue: true },
    { value: "mark_verified", label: "Mark verified" },
    { value: "mark_stale", label: "Mark stale" },
    { value: "add_tag", label: "Add tag", requiresValue: true },
    { value: "remove_tag", label: "Remove tag", requiresValue: true },
    { value: "archive", label: "Archive / soft-delete", adminOnly: true }
  ],
  Article: [
    { value: "needs_review", label: "Mark needs review" },
    { value: "status", label: "Update status", requiresValue: true },
    { value: "confidence_level", label: "Update confidence level", requiresValue: true },
    { value: "source_reliability", label: "Assign source reliability", requiresValue: true },
    { value: "add_tag", label: "Add tag", requiresValue: true },
    { value: "remove_tag", label: "Remove tag", requiresValue: true },
    { value: "archive", label: "Archive / soft-delete", adminOnly: true }
  ]
};

export function BulkEditPanel({ entityType, selectedIds, canEdit, canArchive, onApplied }: BulkEditPanelProps) {
  const [action, setAction] = useState(ACTION_OPTIONS[entityType][0]?.value ?? "");
  const [value, setValue] = useState("");
  const [result, setResult] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const [confirmed, setConfirmed] = useState(false);

  const activeAction = useMemo(
    () => ACTION_OPTIONS[entityType].find((option) => option.value === action) ?? ACTION_OPTIONS[entityType][0],
    [entityType, action]
  );

  async function submit(dryRun: boolean) {
    if (!canEdit || !selectedIds.length) return;
    setRunning(true);
    setResult(null);
    const response = await fetch("/api/bulk", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        entityType,
        ids: selectedIds,
        action,
        value,
        dryRun,
        confirm: !dryRun && confirmed
      })
    });
    const payload = (await response.json().catch(() => null)) as
      | { affectedCount?: number; updatedCount?: number; preview?: Array<{ id: string; label: string }> ; error?: string }
      | null;
    setRunning(false);
    if (!response.ok) {
      setResult(payload?.error ?? "Bulk action failed.");
      return;
    }
    if (dryRun) {
      setResult(`Dry run: ${payload?.affectedCount ?? 0} records would be touched.`);
      return;
    }
    setResult(`Bulk update complete: ${payload?.updatedCount ?? 0} of ${payload?.affectedCount ?? 0} records updated.`);
    setConfirmed(false);
    if (onApplied) {
      onApplied();
    } else {
      window.location.reload();
    }
  }

  const actionDisabled = activeAction?.adminOnly ? !canArchive : !canEdit;

  return (
    <div className="space-y-3 rounded-lg border bg-slate-50 p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-sm font-semibold">Bulk Edit</div>
          <p className="text-sm text-muted-foreground">{selectedIds.length} selected record{selectedIds.length === 1 ? "" : "s"}.</p>
        </div>
        <PencilLine className="h-4 w-4 text-primary" />
      </div>
      <div className="grid gap-3 md:grid-cols-[16rem_1fr]">
        <Select value={action} onChange={(event) => setAction(event.target.value)} disabled={actionDisabled}>
          {ACTION_OPTIONS[entityType]
            .filter((option) => !option.adminOnly || canArchive)
            .map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
        </Select>
        <Input
          value={value}
          onChange={(event) => setValue(event.target.value)}
          placeholder={activeAction?.requiresValue ? "Enter the new value" : "No extra value needed for this action"}
          disabled={actionDisabled || !activeAction?.requiresValue}
        />
      </div>
      <label className="flex items-center gap-2 text-sm text-muted-foreground">
        <input type="checkbox" checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} disabled={actionDisabled} />
        I understand this change affects {selectedIds.length} records and will be written to the audit trail.
      </label>
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="secondary" onClick={() => submit(true)} disabled={actionDisabled || running || !selectedIds.length}>
          Dry Run
        </Button>
        <Button
          type="button"
          onClick={() => submit(false)}
          disabled={actionDisabled || running || !selectedIds.length || !confirmed || (activeAction?.requiresValue && !value.trim())}
        >
          Apply Bulk Change
        </Button>
      </div>
      {activeAction?.adminOnly ? (
        <div className="inline-flex items-center gap-2 text-xs text-amber-800">
          <AlertTriangle className="h-4 w-4" /> Archive is restricted to admins and remains a soft-delete only.
        </div>
      ) : null}
      {result ? <div className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700">{result}</div> : null}
    </div>
  );
}
