import { NextRequest } from "next/server";
import { previewCsvImport } from "@/lib/data-transfer";
import { IMPORT_ENTITY_OPTIONS, type ImportEntityType } from "@/lib/import-config";
import { requireEditorActionAccess } from "@/lib/team-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  await requireEditorActionAccess();

  const payload = (await request.json().catch(() => null)) as
    | { entityType?: string; rows?: Array<Record<string, string>> }
    | null;

  if (!payload?.entityType || !IMPORT_ENTITY_OPTIONS.includes(payload.entityType as ImportEntityType) || !Array.isArray(payload.rows)) {
    return Response.json({ error: "Invalid import preview payload." }, { status: 400 });
  }

  const preview = await previewCsvImport(payload.entityType as ImportEntityType, payload.rows);
  return Response.json(preview);
}
