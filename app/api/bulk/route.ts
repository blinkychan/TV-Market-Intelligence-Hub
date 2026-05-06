import { NextRequest } from "next/server";
import { bulkUpdateRecords } from "@/lib/data-transfer";
import { requireAdminCapabilityAccess, requireEditorActionAccess } from "@/lib/team-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type BulkPayload = {
  entityType?: "Project" | "CurrentShow" | "Article";
  ids?: string[];
  action?: string;
  value?: string | null;
  confirm?: boolean;
  dryRun?: boolean;
};

export async function POST(request: NextRequest) {
  const payload = (await request.json().catch(() => null)) as BulkPayload | null;
  if (!payload?.entityType || !Array.isArray(payload.ids) || !payload.action) {
    return Response.json({ error: "Invalid bulk-edit payload." }, { status: 400 });
  }

  const destructiveAction = payload.action === "archive";
  if (destructiveAction) {
    await requireAdminCapabilityAccess();
  } else {
    await requireEditorActionAccess();
  }

  const result = await bulkUpdateRecords({
    entityType: payload.entityType,
    ids: payload.ids,
    action: payload.action,
    value: payload.value ?? null,
    confirm: payload.confirm,
    dryRun: payload.dryRun
  });

  return Response.json(result);
}
