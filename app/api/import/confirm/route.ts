import { NextRequest } from "next/server";
import { confirmCsvImport } from "@/lib/data-transfer";
import { withControlledJob } from "@/lib/job-control";
import { importPayloadSchema } from "@/lib/request-validation";
import { requireEditorActionAccess } from "@/lib/team-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const auth = await requireEditorActionAccess();
  const payload = await request.json().catch(() => null);
  const parsed = importPayloadSchema.safeParse(payload);
  if (!parsed.success) {
    return Response.json({ error: "Invalid import confirmation payload." }, { status: 400 });
  }

  const summary = await withControlledJob({
    jobType: "csv_import",
    createdByUserId: auth.user?.id ?? null,
    createdByEmail: auth.user?.email ?? null,
    inputJson: { mode: "confirm", entityType: parsed.data.entityType, rowCount: parsed.data.rows.length, fileName: parsed.data.fileName ?? null },
    lockKey: `csv-confirm:${parsed.data.entityType}:${auth.user?.email ?? "unknown"}`,
    handler: async () => confirmCsvImport(parsed.data.entityType, parsed.data.rows)
  });
  return Response.json(summary);
}
