import { z } from "zod";
import { NextResponse } from "next/server";
import { recordAuditLog } from "@/lib/audit";
import { createFeedback } from "@/lib/feedback";
import { requireApprovedTeamAccess } from "@/lib/team-auth";

export const dynamic = "force-dynamic";

const feedbackSchema = z.object({
  page: z.string().min(1).max(200),
  entityType: z.string().max(80).optional().nullable(),
  entityId: z.string().max(120).optional().nullable(),
  feedbackType: z.enum(["bug", "data_issue", "feature_request", "confusion", "other"]),
  message: z.string().min(5).max(5000),
  screenshotUrl: z.string().url().optional().or(z.literal("")).nullable(),
  priority: z.enum(["low", "medium", "high"]).optional()
});

export async function POST(request: Request) {
  const auth = await requireApprovedTeamAccess();
  const body = await request.json().catch(() => null);
  const parsed = feedbackSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "Invalid feedback submission." }, { status: 400 });
  }

  const feedback = await createFeedback({
    userId: auth.user?.id ?? null,
    email: auth.user?.email ?? null,
    page: parsed.data.page,
    entityType: parsed.data.entityType ?? null,
    entityId: parsed.data.entityId ?? null,
    feedbackType: parsed.data.feedbackType,
    message: parsed.data.message,
    screenshotUrl: parsed.data.screenshotUrl || null,
    priority: parsed.data.priority ?? "medium"
  });

  await recordAuditLog({
    entityType: "Feedback",
    entityId: feedback.id,
    action: "created",
    newValueJson: feedback,
    reason: "Feedback submitted from the beta tool.",
    source: "feedback"
  });

  return NextResponse.json({ ok: true, id: feedback.id });
}

