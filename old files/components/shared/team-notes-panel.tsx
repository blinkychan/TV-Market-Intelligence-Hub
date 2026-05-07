"use client";

import { useMemo, useState } from "react";
import { deleteTeamNoteAction, saveTeamNoteAction } from "@/app/shared-actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input, Select } from "@/components/ui/input";
import type { TeamNoteRecord } from "@/lib/team-notes";
import { formatDate } from "@/lib/utils";

function parseTags(tags?: string | null) {
  return (tags ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

export function TeamNotesPanel({
  entityType,
  entityId,
  notes,
  returnPath,
  currentUserEmail,
  canManageAll,
  canWrite = true
}: {
  entityType: string;
  entityId: string;
  notes: TeamNoteRecord[];
  returnPath: string;
  currentUserEmail: string | null;
  canManageAll: boolean;
  canWrite?: boolean;
}) {
  const [tagFilter, setTagFilter] = useState("all");
  const tags = Array.from(new Set(notes.flatMap((note) => parseTags(note.tags)))).sort();
  const filteredNotes = useMemo(
    () => notes.filter((note) => tagFilter === "all" || parseTags(note.tags).includes(tagFilter)),
    [notes, tagFilter]
  );

  return (
    <Card className="shadow-panel">
      <CardHeader>
        <CardTitle>Team Notes</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <form action={saveTeamNoteAction} className="space-y-3 rounded-lg border bg-slate-50 p-4">
          <input type="hidden" name="entityType" value={entityType} />
          <input type="hidden" name="entityId" value={entityId} />
          <input type="hidden" name="returnPath" value={returnPath} />
          <textarea
            name="note"
            rows={3}
            required
            disabled={!canWrite}
            placeholder="Add a team note, context, or flag..."
            className="w-full rounded-md border bg-white px-3 py-2 text-sm disabled:cursor-not-allowed disabled:bg-slate-100"
          />
          <div className="grid gap-3 md:grid-cols-[1fr_0.7fr_auto]">
            <Input name="tags" placeholder="tags, comma-separated" disabled={!canWrite} />
            <label className="flex items-center gap-2 text-sm text-muted-foreground">
              <input type="checkbox" name="includeInNextWeeklyReport" disabled={!canWrite} />
              Include in next weekly report
            </label>
            <Button type="submit" disabled={!canWrite}>Add Note</Button>
          </div>
          {!canWrite ? (
            <div className="text-xs text-muted-foreground">
              Notes are read-only in preview mode. Connect the database to save team notes.
            </div>
          ) : null}
        </form>

        <div className="flex items-center gap-3">
          <Select value={tagFilter} onChange={(event) => setTagFilter(event.target.value)} className="max-w-xs">
            <option value="all">All tags</option>
            {tags.map((tag) => (
              <option key={tag} value={tag}>
                {tag}
              </option>
            ))}
          </Select>
        </div>

        {filteredNotes.length ? (
          <div className="space-y-3">
            {filteredNotes.map((note) => {
              const canEditThis = canWrite && (canManageAll || (currentUserEmail && note.createdByEmail === currentUserEmail));
              return (
                <div key={note.id} className="rounded-lg border p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    {parseTags(note.tags).map((tag) => (
                      <Badge key={tag} className="bg-slate-100 text-slate-700 ring-slate-200">{tag}</Badge>
                    ))}
                    {note.includeInNextWeeklyReport ? (
                      <Badge className="bg-amber-50 text-amber-800 ring-amber-200">Weekly Report Flag</Badge>
                    ) : null}
                  </div>
                  <p className="mt-3 text-sm leading-6 text-slate-700">{note.note}</p>
                  <div className="mt-3 text-xs text-muted-foreground">
                    {note.createdByEmail ?? "Unknown teammate"} · {formatDate(note.updatedAt)}
                  </div>

                  {canEditThis ? (
                    <details className="mt-4 rounded-md border bg-slate-50 p-3">
                      <summary className="cursor-pointer text-sm font-medium">Edit note</summary>
                      <div className="mt-3 grid gap-3 lg:grid-cols-[1fr_auto]">
                      <form action={saveTeamNoteAction} className="space-y-3">
                        <input type="hidden" name="id" value={note.id} />
                        <input type="hidden" name="entityType" value={entityType} />
                        <input type="hidden" name="entityId" value={entityId} />
                        <input type="hidden" name="returnPath" value={returnPath} />
                        <textarea name="note" rows={3} defaultValue={note.note} required className="w-full rounded-md border bg-white px-3 py-2 text-sm" />
                        <div className="grid gap-3 md:grid-cols-[1fr_0.8fr_auto]">
                          <Input name="tags" defaultValue={note.tags ?? ""} />
                          <label className="flex items-center gap-2 text-sm text-muted-foreground">
                            <input type="checkbox" name="includeInNextWeeklyReport" defaultChecked={note.includeInNextWeeklyReport} />
                            Include in report
                          </label>
                          <Button type="submit" variant="secondary">Save</Button>
                        </div>
                      </form>
                      <form action={deleteTeamNoteAction} className="lg:self-start">
                        <input type="hidden" name="id" value={note.id} />
                        <input type="hidden" name="returnPath" value={returnPath} />
                        <Button type="submit" variant="ghost">Delete</Button>
                      </form>
                      </div>
                    </details>
                  ) : null}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="rounded-md border border-dashed bg-slate-50 p-5 text-center text-sm text-muted-foreground">
            No team notes yet for this record.
          </div>
        )}
      </CardContent>
    </Card>
  );
}
