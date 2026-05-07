import Link from "next/link";
import { Bell, BellRing } from "lucide-react";
import { markAlertReadAction } from "@/app/shared-actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select } from "@/components/ui/input";
import { mockAlerts } from "@/lib/mock-watchlists";
import { canUseMockPreview, mockPreviewDisabledReason } from "@/lib/runtime-mode";
import { getVisibleAlerts, getVisibleWatchlists } from "@/lib/watchlists";
import { formatDate, humanize } from "@/lib/utils";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{ severity?: string; alertType?: string; watchlistId?: string; unread?: string }>;

function entityHref(entityType: string, entityId: string) {
  if (entityType === "Article") return `/review?articleId=${encodeURIComponent(entityId)}`;
  if (entityType === "Project") return `/projects/${entityId}`;
  if (entityType === "CurrentShow") return `/current-tv?showId=${encodeURIComponent(entityId)}`;
  if (entityType === "Buyer") return `/buyers/${entityId}`;
  if (entityType === "Company") return `/companies/${entityId}`;
  if (entityType === "Person") return `/talent/${entityId}`;
  return "/alerts";
}

function severityTone(value: string) {
  if (value === "high") return "bg-rose-50 text-rose-700 ring-rose-200";
  if (value === "medium") return "bg-amber-50 text-amber-800 ring-amber-200";
  return "bg-sky-50 text-sky-700 ring-sky-200";
}

export default async function AlertsPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const filters = {
    severity: params.severity ?? null,
    alertType: params.alertType ?? null,
    watchlistId: params.watchlistId ?? null,
    unreadOnly: params.unread === "true"
  };

  const data = await Promise.all([getVisibleAlerts(filters), getVisibleWatchlists()]).then(
    ([alerts, watchlists]) => ({
      dataSource: "database" as const,
      alerts,
      watchlists,
      errorMessage: alerts.length ? null : "No alerts match the current filters."
    }),
    (error) => ({
      dataSource: canUseMockPreview() ? ("mock" as const) : ("database" as const),
      alerts: canUseMockPreview() ? mockAlerts : [],
      watchlists: canUseMockPreview() ? [] : [],
      errorMessage: canUseMockPreview() ? mockPreviewDisabledReason() ?? "Database unavailable, showing preview alerts." : error instanceof Error ? error.message : "Could not load alerts."
    })
  );

  const unreadCount = data.alerts.filter((alert: (typeof data.alerts)[number]) => !alert.isRead).length;

  return (
    <div className="space-y-6">
      <section className="rounded-lg border bg-white p-6 shadow-panel">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-primary">Signals</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">Alerts</h1>
        <p className="mt-3 max-w-3xl text-muted-foreground">
          A focused in-app notification center for watchlist matches, confidence risks, missing data, duplicate warnings, and schedule movement.
        </p>
      </section>

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-white p-4 shadow-panel">
        <div>
          <div className="font-semibold">{unreadCount} unread alerts</div>
          <p className="text-sm text-muted-foreground">Filter by severity, alert type, or watchlist and jump straight into the affected record.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link href="/settings/notifications" className="text-sm font-medium text-primary hover:underline">
            Email preferences
          </Link>
          <Badge className={data.dataSource === "database" ? "bg-emerald-50 text-emerald-700 ring-emerald-200" : "bg-amber-50 text-amber-800 ring-amber-200"}>
            Data Source: {data.dataSource === "database" ? "Database" : "Mock Preview Data"}
          </Badge>
        </div>
      </div>

      <Card className="shadow-panel">
        <CardHeader>
          <CardTitle>Filter Alerts</CardTitle>
        </CardHeader>
        <CardContent>
          <form className="grid gap-3 md:grid-cols-4">
            <Select name="severity" defaultValue={params.severity ?? ""}>
              <option value="">All severities</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </Select>
            <Select name="alertType" defaultValue={params.alertType ?? ""}>
              <option value="">All alert types</option>
              <option value="new_match">New match</option>
              <option value="status_change">Status change</option>
              <option value="premiere_update">Premiere update</option>
              <option value="low_confidence">Low confidence</option>
              <option value="missing_data">Missing data</option>
              <option value="duplicate_detected">Duplicate detected</option>
            </Select>
            <Select name="watchlistId" defaultValue={params.watchlistId ?? ""}>
              <option value="">All watchlists</option>
              {data.watchlists.map((watchlist: (typeof data.watchlists)[number]) => (
                <option key={watchlist.id} value={watchlist.id}>
                  {watchlist.name}
                </option>
              ))}
            </Select>
            <div className="flex items-center gap-2">
              <label className="inline-flex items-center gap-2 text-sm text-muted-foreground">
                <input type="checkbox" name="unread" value="true" defaultChecked={params.unread === "true"} />
                Unread only
              </label>
              <Button type="submit">Apply</Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {data.errorMessage ? (
        <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">{data.errorMessage}</div>
      ) : null}

      {data.alerts.length ? (
        <div className="grid gap-4">
          {data.alerts.map((alert: (typeof data.alerts)[number]) => (
            <Card key={alert.id} className={`shadow-panel ${alert.isRead ? "opacity-80" : "ring-1 ring-primary/10"}`}>
              <CardContent className="flex flex-col gap-4 p-5 lg:flex-row lg:items-start lg:justify-between">
                <div className="min-w-0 space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge className={severityTone(alert.severity)}>{humanize(alert.severity)}</Badge>
                    <Badge className="bg-slate-100 text-slate-700 ring-slate-200">{humanize(alert.alertType)}</Badge>
                    {alert.watchlist ? (
                      <Badge className={alert.watchlist.visibility === "team" ? "bg-violet-50 text-violet-700 ring-violet-200" : "bg-slate-100 text-slate-700 ring-slate-200"}>
                        {alert.watchlist.name}
                      </Badge>
                    ) : null}
                    {!alert.isRead ? (
                      <Badge className="bg-teal-50 text-teal-700 ring-teal-200">
                        <BellRing className="mr-1 h-3 w-3" />
                        Unread
                      </Badge>
                    ) : null}
                  </div>
                  <div className="text-lg font-semibold tracking-tight">{alert.title}</div>
                  <p className="max-w-3xl text-sm text-muted-foreground">{alert.message}</p>
                  <div className="text-xs text-muted-foreground">{formatDate(alert.createdAt)} · {humanize(alert.entityType)}</div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Link
                    href={entityHref(alert.entityType, alert.entityId)}
                    className="inline-flex h-9 items-center rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground"
                  >
                    Jump to Record
                  </Link>
                  <form action={markAlertReadAction}>
                    <input type="hidden" name="id" value={alert.id} />
                    <input type="hidden" name="isRead" value={alert.isRead ? "false" : "true"} />
                    <input type="hidden" name="returnPath" value="/alerts" />
                    <Button type="submit" variant="secondary">
                      <Bell className="h-4 w-4" /> Mark {alert.isRead ? "Unread" : "Read"}
                    </Button>
                  </form>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="rounded-lg border border-dashed bg-slate-50 p-8 text-center text-sm text-muted-foreground">
          No alerts are waiting right now. As watchlists fill out and ingestion keeps moving, the important updates will land here.
        </div>
      )}
    </div>
  );
}
