import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { logOperationalEvent } from "@/lib/ops-log";
import { getCurrentUserContext } from "@/lib/team-auth";

export type AuditEntityType =
  | "Article"
  | "Project"
  | "CurrentShow"
  | "Buyer"
  | "Company"
  | "Person"
  | "Relationship"
  | "WeeklyReport"
  | "SavedView"
  | "TeamNote";

export type AuditAction =
  | "created"
  | "updated"
  | "approved"
  | "rejected"
  | "merged"
  | "deleted"
  | "imported"
  | "extracted"
  | "verified"
  | "referenced";

export type AuditLogEntry = {
  id: string;
  entityType: string;
  entityId: string;
  action: string;
  changedByUserId: string | null;
  changedByEmail: string | null;
  previousValueJson: unknown;
  newValueJson: unknown;
  reason: string | null;
  source: string | null;
  createdAt: Date;
};

function shouldRedact(key: string) {
  const lowered = key.toLowerCase();
  return lowered.includes("password") || lowered.includes("secret") || lowered.includes("token") || lowered.includes("api_key") || lowered.includes("apikey") || lowered.includes("key");
}

function sanitizeAuditValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => sanitizeAuditValue(item));
  }

  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([key]) => !shouldRedact(key))
        .map(([key, item]) => [key, sanitizeAuditValue(item)])
    );
  }

  return value;
}

function toAuditJson(value: unknown): Prisma.InputJsonValue | Prisma.NullableJsonNullValueInput | undefined {
  if (value === undefined) return undefined;
  if (value === null) return Prisma.JsonNull;
  return sanitizeAuditValue(value) as Prisma.InputJsonValue;
}

export async function recordAuditLog(args: {
  entityType: AuditEntityType;
  entityId: string;
  action: AuditAction;
  previousValueJson?: unknown;
  newValueJson?: unknown;
  reason?: string | null;
  source?: string | null;
  changedByUserId?: string | null;
  changedByEmail?: string | null;
}) {
  try {
    const auth = await getCurrentUserContext().catch(() => null);
    const changedByUserId = args.changedByUserId ?? auth?.user?.id ?? null;
    const changedByEmail = args.changedByEmail ?? auth?.user?.email ?? (auth?.adminUnlocked ? "admin-password-session" : null);

    await prisma.auditLog.create({
      data: {
        entityType: args.entityType,
        entityId: args.entityId,
        action: args.action,
        changedByUserId,
        changedByEmail,
        previousValueJson: toAuditJson(args.previousValueJson),
        newValueJson: toAuditJson(args.newValueJson),
        reason: args.reason ?? null,
        source: args.source ?? null
      }
    });
  } catch (error) {
    logOperationalEvent("warn", "Audit logging skipped after a non-blocking failure.", {
      entityType: args.entityType,
      entityId: args.entityId,
      action: args.action,
      message: error instanceof Error ? error.message : "Unknown audit logging failure"
    });
  }
}

export async function getAuditHistory(entityType: AuditEntityType, entityId: string, limit = 8) {
  return prisma.auditLog.findMany({
    where: { entityType, entityId },
    orderBy: { createdAt: "desc" },
    take: limit
  });
}

export function formatAuditJson(value: unknown) {
  return JSON.stringify(value ?? {}, null, 2);
}
