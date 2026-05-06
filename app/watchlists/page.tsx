import { Eye, EyeOff, Trash2 } from "lucide-react";
import { deleteWatchlistAction, saveWatchlistAction } from "@/app/shared-actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input, Select } from "@/components/ui/input";
import { mockAlerts, mockWatchlists } from "@/lib/mock-watchlists";
import { canUseMockPreview, mockPreviewDisabledReason } from "@/lib/runtime-mode";
import { getCurrentUserContext } from "@/lib/team-auth";
import { getVisibleAlerts, getVisibleWatchlists, type WatchlistRecord } from "@/lib/watchlists";
import { humanize } from "@/lib/utils";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{ watchType?: string; visibility?: string }>;

async function loadWatchlistPageData() {
  try {
    const [watchlists, unreadCount] = await Promise.all([
      getVisibleWatchlists(),
      getVisibleAlerts({ unreadOnly: true }).then((alerts) => alerts.length)
    ]);

    if (!watchlists.length && canUseMockPreview()) {
      return {
        dataSource: "mock" as const,
        watchlists: mockWatchlists,
        unreadCount: mockAlerts.filter((alert) => !alert.isRead).length,
        errorMessage: "No watchlists are saved yet."
      };
    }

    return {
      dataSource: "database" as const,
      watchlists,
      unreadCount,
      errorMessage: watchlists.length ? null : "No watchlists are saved yet. Create one from this page or from a tracker filter state."
    };
  } catch (error) {
    return {
      dataSource: canUseMockPreview() ? ("mock" as const) : ("database" as const),
      watchlists: canUseMockPreview() ? mockWatchlists : ([] as WatchlistRecord[]),
      unreadCount: canUseMockPreview() ? mockAlerts.filter((alert) => !alert.isRead).length : 0,
      errorMessage:
        canUseMockPreview() ? mockPreviewDisabledReason() ?? "Database unavailable, showing preview watchlists." : error instanceof Error ? error.message : "Could not load watchlists."
    };
  }
}

function formatCriteria(criteriaJson: unknown) {
  if (!criteriaJson || typeof criteriaJson !== "object") return "No filter details saved yet.";
  const raw = criteriaJson as Record<string, unknown>;
  const filters =
    raw.filters && typeof raw.filters === "object" && !Array.isArray(raw.filters) ? (raw.filters as Record<string, unknown>) : raw;

  const visibleEntries = Object.entries(filters).filter(([, value]) => value != null && value !== "" && value !== "all");
  if (!visibleEntries.length) return "No filter details saved yet.";

  return visibleEntries
    .slice(0, 6)
    .map(([key, value]) => `${humanize(key)}: ${String(value)}`)
    .join(" · ");
}

export default async function WatchlistsPage({ searchParams }: { searchParams: SearchParams }) {
  const auth = await getCurrentUserContext();
  const { dataSource, watchlists, unreadCount, errorMessage } = await loadWatchlistPageData();
  const params = await searchParams;
  const filtered = watchlists.filter((watchlist: (typeof watchlists)[number]) => {
    if (params.watchType && watchlist.watchType !== params.watchType) return false;
    if (params.visibility && watchlist.visibility !== params.visibility) return false;
    return true;
  });

  return (
    <div className="space-y-6">
      <section className="rounded-lg border bg-white p-6 shadow-panel">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-primary">Signals</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">Watchlists</h1>
        <p className="mt-3 max-w-3xl text-muted-foreground">
          Track buyers, companies, talent, genres, keywords, sources, countries, and statuses so fresh market movement stands out quickly.
        </p>
      </section>

      <div className="grid gap-4 lg:grid-cols-[1.1fr_1.9fr]">
        <Card className="shadow-panel">
          <CardHeader>
            <CardTitle>Create Watchlist</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <form action={saveWatchlistAction} className="space-y-4">
              <input type="hidden" name="returnPath" value="/watchlists" />
              <Input name="name" placeholder="Netflix comedy activity" required disabled={dataSource !== "database"} />
              <Input name="description" placeholder="What should this watchlist surface?" disabled={dataSource !== "database"} />
              <Select name="watchType" defaultValue="keyword" disabled={dataSource !== "database"}>
                <option value="buyer">Buyer</option>
                <option value="company">Company</option>
                <option value="person">Person</option>
                <option value="genre">Genre</option>
                <option value="keyword">Keyword</option>
                <option value="source">Source</option>
                <option value="status">Status</option>
                <option value="country">Country</option>
              </Select>
              <Input
                name="criteriaJson"
                defaultValue={JSON.stringify({ terms: ["Netflix", "comedy"], pageType: "development_tracker" })}
                disabled={dataSource !== "database"}
              />
              <Select name="visibility" defaultValue="private" disabled={dataSource !== "database"}>
                <option value="private">Private</option>
                <option value="team" disabled={!auth.canManageUsers && !auth.adminUnlocked}>
                  Team
                </option>
              </Select>
              <Button type="submit" disabled={dataSource !== "database"}>
                Save Watchlist
              </Button>
            </form>
            <div className="text-xs text-muted-foreground">
              Tip: every tracker page can now save its current filters directly into a watchlist, so you usually won’t need to type JSON by hand.
            </div>
          </CardContent>
        </Card>

        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-white p-4 shadow-panel">
            <div>
              <div className="font-semibold">{filtered.length} watchlists active</div>
              <p className="text-sm text-muted-foreground">{unreadCount} unread alerts are currently tied to active watchlists.</p>
            </div>
            <Badge className={dataSource === "database" ? "bg-emerald-50 text-emerald-700 ring-emerald-200" : "bg-amber-50 text-amber-800 ring-amber-200"}>
              Data Source: {dataSource === "database" ? "Database" : "Mock Preview Data"}
            </Badge>
          </div>

          {errorMessage ? (
            <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">{errorMessage}</div>
          ) : null}

          {filtered.length ? (
            <div className="grid gap-4">
              {filtered.map((watchlist: (typeof filtered)[number]) => {
                return (
                  <Card key={watchlist.id} className="shadow-panel">
                    <CardHeader>
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <CardTitle>{watchlist.name}</CardTitle>
                          <p className="mt-1 text-sm text-muted-foreground">{watchlist.description ?? "No description added yet."}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge className="bg-sky-50 text-sky-700 ring-sky-200">{humanize(watchlist.watchType)}</Badge>
                          <Badge className={watchlist.visibility === "team" ? "bg-violet-50 text-violet-700 ring-violet-200" : "bg-slate-100 text-slate-700 ring-slate-200"}>
                            {watchlist.visibility === "team" ? <Eye className="mr-1 h-3 w-3" /> : <EyeOff className="mr-1 h-3 w-3" />}
                            {humanize(watchlist.visibility)}
                          </Badge>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="rounded-lg border bg-slate-50 p-3 text-sm text-slate-700">{formatCriteria(watchlist.criteriaJson)}</div>
                      <div className="text-xs text-muted-foreground">Created by {watchlist.createdByEmail ?? "Unknown teammate"}</div>

                      {(() => {
                        const canManage =
                          dataSource === "database" &&
                          (watchlist.visibility === "team"
                            ? auth.canManageUsers || auth.adminUnlocked
                            : auth.canManageUsers || auth.adminUnlocked || watchlist.createdByEmail === auth.user?.email);

                        return (
                          <div className="grid gap-3 md:grid-cols-2">
                            <form action={saveWatchlistAction} className="contents">
                              <input type="hidden" name="id" value={watchlist.id} />
                              <input type="hidden" name="returnPath" value="/watchlists" />
                              <Input name="name" defaultValue={watchlist.name} required disabled={!canManage} />
                              <Input name="description" defaultValue={watchlist.description ?? ""} disabled={!canManage} />
                              <Select name="watchType" defaultValue={watchlist.watchType} disabled={!canManage}>
                                <option value="buyer">Buyer</option>
                                <option value="company">Company</option>
                                <option value="person">Person</option>
                                <option value="genre">Genre</option>
                                <option value="keyword">Keyword</option>
                                <option value="source">Source</option>
                                <option value="status">Status</option>
                                <option value="country">Country</option>
                              </Select>
                              <Select name="visibility" defaultValue={watchlist.visibility} disabled={!canManage}>
                                <option value="private">Private</option>
                                <option value="team" disabled={!auth.canManageUsers && !auth.adminUnlocked}>
                                  Team
                                </option>
                              </Select>
                              <div className="md:col-span-2">
                                <Input
                                  name="criteriaJson"
                                  defaultValue={JSON.stringify(watchlist.criteriaJson ?? {}, null, 0)}
                                  disabled={!canManage}
                                />
                              </div>
                              <div className="flex flex-wrap gap-2 md:col-span-2">
                                <Button type="submit" disabled={!canManage}>
                                  Update Watchlist
                                </Button>
                              </div>
                            </form>
                            <form action={deleteWatchlistAction} className="md:col-span-2">
                              <input type="hidden" name="id" value={watchlist.id} />
                              <input type="hidden" name="returnPath" value="/watchlists" />
                              <Button type="submit" variant="ghost" disabled={!canManage}>
                                <Trash2 className="h-4 w-4" /> Delete
                              </Button>
                            </form>
                          </div>
                        );
                      })()}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          ) : (
            <div className="rounded-lg border border-dashed bg-slate-50 p-8 text-center text-sm text-muted-foreground">
              No watchlists are set up yet. Create one here or save a tracker filter as a watchlist.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
