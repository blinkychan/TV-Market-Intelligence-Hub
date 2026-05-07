import { NextRequest } from "next/server";
import { bulkUpdateRecords } from "@/lib/data-transfer";
import { bulkPayloadSchema } from "@/lib/request-validation";
import { requireAdminCapabilityAccess, requireEditorActionAccess } from "@/lib/team-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const payload = await request.json().catch(() => null);
  const parsed = bulkPayloadSchema.safeParse(payload);
  if (!parsed.success) {
    return Response.json({ error: "Invalid bulk-edit payload." }, { status: 400 });
  }

  const destructiveAction = parsed.data.action === "archive";
  if (destructiveAction) {
    await requireAdminCapabilityAccess();
  } else {
    await requireEditorActionAccess();
  }

  const result = await bulkUpdateRecords({
    entityType: parsed.data.entityType,
    ids: parsed.data.ids,
    action: parsed.data.action,
    value: parsed.data.value ?? null,
    confirm: parsed.data.confirm,
    dryRun: parsed.data.dryRun
  });

  return Response.json(result);
}
