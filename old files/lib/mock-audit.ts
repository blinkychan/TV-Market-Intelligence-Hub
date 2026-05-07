import type { AuditLogEntry } from "@/lib/audit";

export const mockAuditLogs: AuditLogEntry[] = [
  {
    id: "mock-audit-1",
    entityType: "Article",
    entityId: "mock-article-1",
    action: "extracted",
    changedByUserId: "demo-user",
    changedByEmail: "demo@local.preview",
    previousValueJson: { extractionStatus: "New", extractedProjectTitle: null },
    newValueJson: { extractionStatus: "Needs Review", extractedProjectTitle: "Harbor Lights" },
    reason: "Mock AI extraction prepared draft project fields.",
    source: "review_queue",
    createdAt: new Date("2026-04-28T18:00:00.000Z")
  },
  {
    id: "mock-audit-2",
    entityType: "Project",
    entityId: "mock-project-harbor-lights",
    action: "merged",
    changedByUserId: "demo-user",
    changedByEmail: "demo@local.preview",
    previousValueJson: { title: "Harbour Lights", duplicateStatus: "possible_duplicate" },
    newValueJson: { title: "Harbor Lights", duplicateStatus: "merged", possibleDuplicateOfId: "mock-project-harbor-lights" },
    reason: "Merged alternate spelling into canonical project record.",
    source: "duplicate_review",
    createdAt: new Date("2026-04-29T12:30:00.000Z")
  },
  {
    id: "mock-audit-3",
    entityType: "CurrentShow",
    entityId: "mock-city-desk",
    action: "verified",
    changedByUserId: "demo-user",
    changedByEmail: "demo@local.preview",
    previousValueJson: { verifiedAt: null, needsVerification: true },
    newValueJson: { verifiedAt: "2026-04-25T12:00:00.000Z", needsVerification: false },
    reason: "Premiere date confirmed against network calendar.",
    source: "current_tv_tracker",
    createdAt: new Date("2026-04-25T16:00:00.000Z")
  },
  {
    id: "mock-audit-4",
    entityType: "Buyer",
    entityId: "mock-netflix",
    action: "updated",
    changedByUserId: "demo-user",
    changedByEmail: "demo@local.preview",
    previousValueJson: { notes: "Older buyer note." },
    newValueJson: { notes: "Mock preview buyer with a global scripted and international profile." },
    reason: "Buyer profile note refreshed.",
    source: "buyer_profile",
    createdAt: new Date("2026-04-27T14:00:00.000Z")
  }
];
