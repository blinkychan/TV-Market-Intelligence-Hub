import { Download, ShieldCheck } from "lucide-react";
import { ChangeHistoryPanel } from "@/components/audit/change-history";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input, Select } from "@/components/ui/input";
import { Table, Td, Th } from "@/components/ui/table";
import { mockAuditLogs } from "@/lib/mock-audit";
import { prisma } from "@/lib/prisma";
import { requireAdminCapabilityAccess } from "@/lib/team-auth";
import { formatDate, humanize } from "@/lib/utils";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{
  q?: string;
  user?: string;
  entityType?: string;
  action?: string;
  start?: string;
  end?: string;
}>;

async function loadAuditRows(filters: {
  q: string;
  user: string;
  entityType: string;
  action: string;
  start: string;
  end: string;
}) {
  try {
    const rows = await prisma.auditLog.findMany({
      where: {
        ...(filters.user ? { changedByEmail: filters.user } : {}),
        ...(filters.entityType ? { entityType: filters.entityType } : {}),
        ...(filters.action ? { action: filters.action } : {}),
        ...(filters.start || filters.end
          ? {
              createdAt: {
                ...(filters.start ? { gte: new Date(filters.start) } : {}),
                ...(filters.end ? { lte: new Date(`${filters.end}T23:59:59.999Z`) } : {})
              }
            }
          : {})
      },
      orderBy: { createdAt: "desc" },
      take: 200
    });

    const filtered = filters.q
      ? rows.filter((row) =>
          [row.entityType, row.entityId, row.action, row.changedByEmail, row.reason, row.source].join(" ").toLowerCase().includes(filters.q.toLowerCase())
        )
      : rows;

    return { rows: filtered, dataSource: "database" as const, errorMessage: undefined };
  } catch (error) {
    const filtered = mockAuditLogs.filter((row) =>
      [row.entityType, row.entityId, row.action, row.changedByEmail, row.reason, row.source].join(" ").toLowerCase().includes(filters.q.toLowerCase())
    );
    return {
      rows: filtered,
      dataSource: "mock" as const,
      errorMessage: error instanceof Error ? error.message : "Unknown database error."
    };
  }
}

export default async function AdminAuditLogPage({ searchParams }: { searchParams: SearchParams }) {
  await requireAdminCapabilityAccess();
  const params = await searchParams;
  const filters = {
    q: params.q ?? "",
    user: params.user ?? "",
    entityType: params.entityType ?? "",
    action: params.action ?? "",
    start: params.start ?? "",
    end: params.end ?? ""
  };
  const { rows, dataSource, errorMessage } = await loadAuditRows(filters);
  const entityTypes = Array.from(new Set(rows.map((row) => row.entityType))).sort();
  const actions = Array.from(new Set(rows.map((row) => row.action))).sort();
  const users = Array.from(new Set(rows.map((row) => row.changedByEmail).filter(Boolean) as string[])).sort();
  const exportHref = `/api/admin/audit-log/export?q=${encodeURIComponent(filters.q)}&user=${encodeURIComponent(filters.user)}&entityType=${encodeURIComponent(filters.entityType)}&action=${encodeURIComponent(filters.action)}&start=${encodeURIComponent(filters.start)}&end=${encodeURIComponent(filters.end)}`;

  return (
    <div className="space-y-6">
      <section className="rounded-lg border bg-white p-6 shadow-panel">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-primary">Operations</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight">Admin Audit Log</h1>
            <p className="mt-3 max-w-3xl text-muted-foreground">
              Search who changed what, when, and why across review, ingestion, verification, and merge workflows.
            </p>
          </div>
          <Badge className={dataSource === "database" ? "bg-emerald-50 text-emerald-700 ring-emerald-200" : "bg-amber-50 text-amber-800 ring-amber-200"}>
            {dataSource === "database" ? "Database" : "Mock Preview Data"}
          </Badge>
        </div>
        {errorMessage ? <div className="mt-4 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">{errorMessage}</div> : null}
      </section>

      <Card className="shadow-panel">
        <CardHeader><CardTitle>Filters</CardTitle></CardHeader>
        <CardContent>
          <form className="grid gap-3 md:grid-cols-3 xl:grid-cols-7">
            <Input name="q" defaultValue={filters.q} placeholder="Search reason, source, entity id" />
            <Select name="user" defaultValue={filters.user}>
              <option value="">All users</option>
              {users.map((user) => <option key={user} value={user}>{user}</option>)}
            </Select>
            <Select name="entityType" defaultValue={filters.entityType}>
              <option value="">All entity types</option>
              {entityTypes.map((entityType) => <option key={entityType} value={entityType}>{entityType}</option>)}
            </Select>
            <Select name="action" defaultValue={filters.action}>
              <option value="">All actions</option>
              {actions.map((action) => <option key={action} value={action}>{humanize(action)}</option>)}
            </Select>
            <Input name="start" type="date" defaultValue={filters.start} />
            <Input name="end" type="date" defaultValue={filters.end} />
            <button type="submit" className="inline-flex h-9 items-center justify-center rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground">Apply</button>
          </form>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <ButtonLink href={exportHref} variant="secondary">
          <Download className="h-4 w-4" /> Export CSV
        </ButtonLink>
      </div>

      <Card className="shadow-panel">
        <CardHeader><CardTitle>Recent Audit Events</CardTitle></CardHeader>
        <CardContent>
          {rows.length ? (
            <div className="overflow-x-auto rounded-lg border">
              <Table>
                <thead className="bg-slate-50">
                  <tr>
                    <Th>When</Th>
                    <Th>User</Th>
                    <Th>Entity</Th>
                    <Th>Action</Th>
                    <Th>Reason</Th>
                    <Th>Source</Th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.id}>
                      <Td>{formatDate(row.createdAt)}</Td>
                      <Td>{row.changedByEmail ?? "Unknown teammate"}</Td>
                      <Td>{row.entityType} · <span className="text-xs text-muted-foreground">{row.entityId}</span></Td>
                      <Td>{humanize(row.action)}</Td>
                      <Td>{row.reason ?? "—"}</Td>
                      <Td>{row.source ?? "—"}</Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </div>
          ) : (
            <div className="rounded-md border border-dashed bg-slate-50 p-6 text-center text-sm text-muted-foreground">
              No audit events match the current filters yet.
            </div>
          )}
        </CardContent>
      </Card>

      {rows[0] ? (
        <ChangeHistoryPanel title="Latest Change Detail" logs={[rows[0]]} emptyText="No detailed change selected." />
      ) : null}

      <div className="rounded-lg border bg-slate-50 p-4 text-sm text-muted-foreground">
        <div className="flex items-center gap-2 font-medium text-slate-700"><ShieldCheck className="h-4 w-4" /> Restore helper</div>
        <p className="mt-2">
          Automatic rollback is not enabled yet. Use the previous-value snapshot in any audit event to manually copy fields back into the relevant edit form.
        </p>
      </div>
    </div>
  );
}
