import { type NextRequest, NextResponse } from "next/server";
import { runDigDeeper } from "@/lib/dig-deeper";
import { logOperationalEvent } from "@/lib/ops-log";
import { getCurrentUserContext } from "@/lib/team-auth";
import type { DigDeeperEntityType } from "@/lib/dig-deeper";

export const dynamic = "force-dynamic";

const VALID_ENTITY_TYPES: DigDeeperEntityType[] = ["Project", "CurrentShow", "Article"];

export async function POST(request: NextRequest) {
  const ctx = await getCurrentUserContext().catch(() => null);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { entityType, entityId } = (body ?? {}) as Record<string, unknown>;

  if (!entityType || !entityId || typeof entityType !== "string" || typeof entityId !== "string") {
    return NextResponse.json({ error: "entityType and entityId are required" }, { status: 400 });
  }

  if (!VALID_ENTITY_TYPES.includes(entityType as DigDeeperEntityType)) {
    return NextResponse.json(
      { error: `entityType must be one of: ${VALID_ENTITY_TYPES.join(", ")}` },
      { status: 400 }
    );
  }

  try {
    const result = await runDigDeeper(
      entityType as DigDeeperEntityType,
      entityId,
      ctx?.user?.email ?? undefined
    );

    return NextResponse.json({ result });
  } catch (err) {
    logOperationalEvent("error", "Dig Deeper API error", { error: String(err), entityType, entityId });
    return NextResponse.json({ error: "Dig Deeper failed", details: String(err) }, { status: 500 });
  }
}
