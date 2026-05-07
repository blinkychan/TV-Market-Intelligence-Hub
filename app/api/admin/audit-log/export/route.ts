import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdminCapabilityAccess } from "@/lib/team-auth";

export const dynamic = "force-dynamic";

function csvEscape(value: unknown) {
  const text = String(value ?? "");
  if (text.includes(",") || text.includes("\"") || text.includes("\n")) {
    return `"${text.replaceAll("\"", "\"\"")}"`;
  }
  return text;
}

export async function GET(request: Request) {
  await requireAdminCapabilityAccess();
  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q")?.trim() ?? "";
  const user = searchParams.get("user")?.trim() ?? "";
  const entityType = searchParams.get("entityType")?.trim() ?? "";
  const action = searchParams.get("action")?.trim() ?? "";
  const start = searchParams.get("start")?.trim() ?? "";
  const end = searchParams.get("end")?.trim() ?? "";

  const rows = await prisma.auditLog.findMany({
    where: {
      ...(user ? { changedByEmail: user } : {}),
      ...(entityType ? { entityType } : {}),
      ...(action ? { action } : {}),
      ...(start || end
        ? {
            createdAt: {
              ...(start ? { gte: new Date(start) } : {}),
              ...(end ? { lte: new Date(`${end}T23:59:59.999Z`) } : {})
            }
          }
        : {})
    },
    orderBy: { createdAt: "desc" },
    take: 500
  });

  const filtered = q
    ? rows.filter((row) =>
        [row.entityType, row.entityId, row.action, row.changedByEmail, row.reason, row.source].join(" ").toLowerCase().includes(q.toLowerCase())
      )
    : rows;

  const header = ["createdAt", "changedByEmail", "entityType", "entityId", "action", "reason", "source"];
  const body = filtered.map((row) =>
    [
      row.createdAt.toISOString(),
      row.changedByEmail,
      row.entityType,
      row.entityId,
      row.action,
      row.reason,
      row.source
    ]
      .map(csvEscape)
      .join(",")
  );

  return new NextResponse([header.join(","), ...body].join("\n"), {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": 'attachment; filename="audit-log.csv"'
    }
  });
}
