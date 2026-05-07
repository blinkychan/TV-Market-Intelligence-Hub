import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { AuditLogEntry } from "@/lib/audit";
import { formatDate, humanize } from "@/lib/utils";

export function ChangeHistoryPanel({
  title = "Change History",
  logs,
  emptyText = "No change history has been recorded for this record yet."
}: {
  title?: string;
  logs: AuditLogEntry[];
  emptyText?: string;
}) {
  return (
    <Card className="shadow-panel">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {logs.length ? (
          logs.map((log) => (
            <div key={log.id} className="rounded-lg border p-4">
              <div className="flex flex-wrap items-center gap-2">
                <Badge className="bg-slate-100 text-slate-700 ring-slate-200">{humanize(log.action)}</Badge>
                <div className="text-xs text-muted-foreground">
                  {formatDate(log.createdAt)} · {log.changedByEmail ?? "Unknown teammate"}
                </div>
              </div>
              {log.reason ? <p className="mt-2 text-sm text-slate-700">{log.reason}</p> : null}
              <div className="mt-3 grid gap-3 lg:grid-cols-2">
                <div className="rounded-md bg-slate-50 p-3">
                  <div className="text-xs font-semibold uppercase text-muted-foreground">Previous Value</div>
                  <pre className="mt-2 overflow-auto text-xs leading-5 text-slate-700 whitespace-pre-wrap break-words">
                    {JSON.stringify(log.previousValueJson ?? {}, null, 2)}
                  </pre>
                </div>
                <div className="rounded-md bg-slate-50 p-3">
                  <div className="text-xs font-semibold uppercase text-muted-foreground">New Value</div>
                  <pre className="mt-2 overflow-auto text-xs leading-5 text-slate-700 whitespace-pre-wrap break-words">
                    {JSON.stringify(log.newValueJson ?? {}, null, 2)}
                  </pre>
                </div>
              </div>
              <div className="mt-3 rounded-md border border-dashed px-3 py-2 text-xs text-muted-foreground">
                Restore helper: automatic rollback is not enabled yet. Use the previous-value snapshot above to manually copy fields back if needed.
              </div>
            </div>
          ))
        ) : (
          <div className="rounded-md border border-dashed bg-slate-50 p-5 text-center text-sm text-muted-foreground">{emptyText}</div>
        )}
      </CardContent>
    </Card>
  );
}
