import { z } from "zod";
import { NextResponse } from "next/server";
import { recordUsageEvent } from "@/lib/feedback";
import { requireApprovedTeamAccess } from "@/lib/team-auth";

export const dynamic = "force-dynamic";

const usageSchema = z.object({
  eventType: z.string().min(1).max(80),
  page: z.string().max(200).optional().nullable(),
  entityType: z.string().max(80).optional().nullable(),
  entityId: z.string().max(120).optional().nullable(),
  key: z.string().max(120).optional().nullable(),
  value: z.string().max(300).optional().nullable(),
  metadata: z.unknown().optional()
});

export async function POST(request: Request) {
  const auth = await requireApprovedTeamAccess();
  const body = await request.json().catch(() => null);
  const parsed = usageSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  await recordUsageEvent({
    userId: auth.user?.id ?? null,
    email: auth.user?.email ?? null,
    eventType: parsed.data.eventType,
    page: parsed.data.page ?? null,
    entityType: parsed.data.entityType ?? null,
    entityId: parsed.data.entityId ?? null,
    key: parsed.data.key ?? null,
    value: parsed.data.value ?? null,
    metadata: parsed.data.metadata
  });

  return NextResponse.json({ ok: true });
}

