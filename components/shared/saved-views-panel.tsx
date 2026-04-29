"use client";

import { useEffect, useMemo, useState } from "react";
import { Copy, Save, Trash2 } from "lucide-react";
import { deleteSavedViewAction, duplicateSavedViewAction, saveSavedViewAction } from "@/app/shared-actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input, Select } from "@/components/ui/input";
import type { SavedViewRecord } from "@/lib/saved-views";

export function SavedViewsPanel({
  pageType,
  savedViews,
  returnPath,
  currentState,
  canCreateTeamView,
  onLoadView,
  canWrite = true,
  currentUserEmail,
  canManageAll = false
}: {
  pageType: string;
  savedViews: SavedViewRecord[];
  returnPath: string;
  currentState: { filtersJson: unknown; sortJson?: unknown; columnsJson?: unknown };
  canCreateTeamView: boolean;
  onLoadView?: (view: SavedViewRecord) => void;
  canWrite?: boolean;
  currentUserEmail?: string | null;
  canManageAll?: boolean;
}) {
  const [selectedId, setSelectedId] = useState(savedViews[0]?.id ?? "");
  const [editingId, setEditingId] = useState("");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [visibility, setVisibility] = useState<"private" | "team">("private");
  const selected = useMemo(() => savedViews.find((view) => view.id === selectedId) ?? null, [savedViews, selectedId]);
  const canEditSelected = Boolean(
    selected &&
      canWrite &&
      (canManageAll || (currentUserEmail && selected.createdByEmail === currentUserEmail))
  );

  useEffect(() => {
    if (!selected) {
      if (!editingId) {
        setName("");
        setDescription("");
        setVisibility("private");
      }
      return;
    }

    if (editingId === selected.id) {
      setName(selected.name);
      setDescription(selected.description ?? "");
      setVisibility(selected.visibility);
    }
  }, [selected, editingId]);

  function beginEditing() {
    if (!selected) return;
    setEditingId(selected.id);
    setName(selected.name);
    setDescription(selected.description ?? "");
    setVisibility(selected.visibility);
  }

  function resetDraft() {
    setEditingId("");
    setName("");
    setDescription("");
    setVisibility("private");
  }

  return (
    <Card className="shadow-panel">
      <CardHeader>
        <CardTitle>Saved Views</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <form action={saveSavedViewAction} className="grid gap-3 md:grid-cols-[1fr_1fr_0.7fr_auto]">
          <input type="hidden" name="id" value={editingId} />
          <input type="hidden" name="pageType" value={pageType} />
          <input type="hidden" name="returnPath" value={returnPath} />
          <input type="hidden" name="filtersJson" value={JSON.stringify(currentState.filtersJson ?? {})} />
          <input type="hidden" name="sortJson" value={JSON.stringify(currentState.sortJson ?? {})} />
          <input type="hidden" name="columnsJson" value={JSON.stringify(currentState.columnsJson ?? {})} />
          <Input
            name="name"
            placeholder="Save current view as..."
            required
            value={name}
            onChange={(event) => setName(event.target.value)}
            disabled={!canWrite}
          />
          <Input
            name="description"
            placeholder="Short description"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            disabled={!canWrite}
          />
          <Select
            name="visibility"
            value={visibility}
            onChange={(event) => setVisibility(event.target.value as "private" | "team")}
            disabled={!canWrite}
          >
            <option value="private">Private</option>
            <option value="team" disabled={!canCreateTeamView}>Team</option>
          </Select>
          <Button type="submit" disabled={!canWrite}>
            <Save className="h-4 w-4" /> {editingId ? "Update View" : "Save View"}
          </Button>
        </form>
        {!canWrite ? (
          <div className="text-xs text-muted-foreground">
            Saved views are read-only in preview mode. Connect the database to save or update views.
          </div>
        ) : null}

        {savedViews.length ? (
          <div className="grid gap-3 lg:grid-cols-[1fr_auto_auto_auto] lg:items-center">
            <Select value={selectedId} onChange={(event) => setSelectedId(event.target.value)}>
              {savedViews.map((view) => (
                <option key={view.id} value={view.id}>
                  {view.name}
                </option>
              ))}
            </Select>
            <Button type="button" variant="secondary" onClick={() => selected && onLoadView?.(selected)} disabled={!selected}>
              Load View
            </Button>
            <Button type="button" variant="secondary" onClick={beginEditing} disabled={!canEditSelected}>
              Edit
            </Button>
            <form action={duplicateSavedViewAction}>
              <input type="hidden" name="id" value={selected?.id ?? ""} />
              <input type="hidden" name="returnPath" value={returnPath} />
              <Button type="submit" variant="secondary" disabled={!selected || !canWrite}>
                <Copy className="h-4 w-4" /> Duplicate
              </Button>
            </form>
            <form action={deleteSavedViewAction}>
              <input type="hidden" name="id" value={selected?.id ?? ""} />
              <input type="hidden" name="returnPath" value={returnPath} />
              <Button type="submit" variant="ghost" disabled={!canEditSelected}>
                <Trash2 className="h-4 w-4" /> Delete
              </Button>
            </form>
          </div>
        ) : (
          <div className="rounded-md border border-dashed bg-slate-50 p-4 text-sm text-muted-foreground">
            No saved views yet. Save your current filters to reuse them later or share them with the team.
          </div>
        )}

        {selected ? (
          <div className="rounded-lg border bg-slate-50 p-4 text-sm">
            <div className="flex items-center gap-2">
              <div className="font-medium">{selected.name}</div>
              <Badge className={selected.visibility === "team" ? "bg-sky-50 text-sky-700 ring-sky-200" : "bg-slate-100 text-slate-700 ring-slate-200"}>
                {selected.visibility}
              </Badge>
            </div>
            {selected.description ? <div className="mt-1 text-muted-foreground">{selected.description}</div> : null}
            <div className="mt-2 text-xs text-muted-foreground">Created by {selected.createdByEmail ?? "Unknown teammate"}</div>
          </div>
        ) : null}
        {editingId ? (
          <div className="flex justify-end">
            <Button type="button" variant="ghost" onClick={resetDraft}>
              Cancel editing
            </Button>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
