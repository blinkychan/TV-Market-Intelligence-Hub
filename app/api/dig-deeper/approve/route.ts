import { type NextRequest, NextResponse } from "next/server";
import { approveDigDeeperFindings } from "@/lib/dig-deeper";
import { logOperationalEvent } from "@/lib/ops-log";
import { getCurrentUserContext } from "@/lib/team-auth";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const ctx = await getCurrentUserContext(request as never).catch(() => null);
  const email = ctx?.user?.email ?? "anonymous";

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { runId, applyUpdates } = (body ?? {}) as Record<string, unknown>;

  if (!runId || typeof runId !== "string") {
    return NextResponse.json({ error: "runId is required" }, { status: 400 });
  }

  try {
    const outcome = await approveDigDeeperFindings(
      runId,
      email,
      applyUpdates === true
    );

    if (!outcome.success) {
      return NextResponse.json({ error: outcome.message }, { status: 400 });
    }

    logOperationalEvent("info", `Dig Deeper approved: run ${runId}`, {
      applyUpdates,
      email,
      appliedFields: outcome.appliedFields,
    });

    return NextResponse.json(outcome);
  } catch (err) {
    logOperationalEvent("error", "Dig Deeper approve error", { error: String(err), runId });
    return NextResponse.json({ error: "Approval failed", details: String(err) }, { status: 500 });
  }
}
