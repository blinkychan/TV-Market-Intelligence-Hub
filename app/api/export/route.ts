import { NextRequest } from "next/server";
import { getExportRows } from "@/lib/data-transfer";
import { toCsv } from "@/lib/csv";
import { requireApprovedTeamAccess } from "@/lib/team-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function filename(pageType: string) {
  return `${pageType.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}.csv`;
}

export async function GET(request: NextRequest) {
  const auth = await requireApprovedTeamAccess();
  const pageType = request.nextUrl.searchParams.get("pageType");

  if (!pageType) {
    return new Response("Missing pageType", { status: 400 });
  }

  const rows = await getExportRows({
    pageType,
    filters: request.nextUrl.searchParams,
    includeSensitive: auth.canEditContent || auth.adminUnlocked
  });

  const headers = Array.from(
    new Set(rows.flatMap((row) => (row && typeof row === "object" ? Object.keys(row as Record<string, unknown>) : [])))
  );

  const body = toCsv(headers, rows as Array<Record<string, unknown>>);
  return new Response(body, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="${filename(pageType)}"`
    }
  });
}
