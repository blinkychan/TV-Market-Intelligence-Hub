import { Prisma, type FeedbackPriority, type FeedbackStatus, type FeedbackType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { canUseMockPreview } from "@/lib/runtime-mode";

export type FeedbackRecord = {
  id: string;
  userId: string | null;
  email: string | null;
  page: string;
  entityType: string | null;
  entityId: string | null;
  feedbackType: FeedbackType;
  message: string;
  screenshotUrl: string | null;
  status: FeedbackStatus;
  priority: FeedbackPriority;
  internalNotes: string | null;
  createdAt: Date;
  updatedAt: Date;
};

function toJsonValue(value: unknown): Prisma.InputJsonValue | Prisma.NullableJsonNullValueInput | undefined {
  if (value === undefined) return undefined;
  if (value === null) return Prisma.JsonNull;
  return value as Prisma.InputJsonValue;
}

export async function createFeedback(args: {
  userId?: string | null;
  email?: string | null;
  page: string;
  entityType?: string | null;
  entityId?: string | null;
  feedbackType: FeedbackType;
  message: string;
  screenshotUrl?: string | null;
  priority?: FeedbackPriority;
}) {
  return prisma.feedback.create({
    data: {
      userId: args.userId ?? null,
      email: args.email ?? null,
      page: args.page,
      entityType: args.entityType ?? null,
      entityId: args.entityId ?? null,
      feedbackType: args.feedbackType,
      message: args.message,
      screenshotUrl: args.screenshotUrl ?? null,
      priority: args.priority ?? "medium"
    }
  });
}

export async function updateFeedback(args: {
  id: string;
  status?: FeedbackStatus;
  priority?: FeedbackPriority;
  internalNotes?: string | null;
}) {
  const existing = await prisma.feedback.findUnique({ where: { id: args.id } });
  if (!existing) return null;

  const updated = await prisma.feedback.update({
    where: { id: args.id },
    data: {
      ...(args.status ? { status: args.status } : {}),
      ...(args.priority ? { priority: args.priority } : {}),
      ...(args.internalNotes !== undefined ? { internalNotes: args.internalNotes } : {})
    }
  });

  return { existing, updated };
}

export async function getFeedbackList(filters: {
  status?: string;
  type?: string;
  user?: string;
  priority?: string;
}) {
  try {
    const rows = await prisma.feedback.findMany({
      where: {
        ...(filters.status ? { status: filters.status as FeedbackStatus } : {}),
        ...(filters.type ? { feedbackType: filters.type as FeedbackType } : {}),
        ...(filters.user ? { email: filters.user } : {}),
        ...(filters.priority ? { priority: filters.priority as FeedbackPriority } : {})
      },
      orderBy: [{ status: "asc" }, { priority: "desc" }, { createdAt: "desc" }],
      take: 300
    });

    return {
      rows,
      dataSource: "database" as const,
      errorMessage: rows.length ? null : "No feedback matches the current filters yet."
    };
  } catch (error) {
    return {
      rows: [] as FeedbackRecord[],
      dataSource: canUseMockPreview() ? ("mock" as const) : ("database" as const),
      errorMessage: error instanceof Error ? error.message : "Could not load feedback."
    };
  }
}

export async function getFeedbackSummary() {
  try {
    const [total, open, highPriority, users] = await Promise.all([
      prisma.feedback.count(),
      prisma.feedback.count({ where: { status: { in: ["new", "triaged", "in_progress"] } } }),
      prisma.feedback.count({ where: { priority: "high", status: { not: "resolved" } } }),
      prisma.feedback.findMany({ distinct: ["email"], select: { email: true } })
    ]);

    return {
      total,
      open,
      highPriority,
      userCount: users.filter((entry) => entry.email).length
    };
  } catch {
    return {
      total: 0,
      open: 0,
      highPriority: 0,
      userCount: 0
    };
  }
}

export async function getUsageInsights() {
  try {
    const [
      mostVisitedPages,
      mostUsedFilters,
      mostUsedSavedViews,
      articlesReviewed,
      projectsCreated,
      reportsGenerated
    ] = await Promise.all([
      prisma.usageEvent.groupBy({
        by: ["page"],
        where: { eventType: "page_view", page: { not: null } },
        _count: { page: true },
        orderBy: { _count: { page: "desc" } },
        take: 5
      }),
      prisma.usageEvent.groupBy({
        by: ["value"],
        where: { eventType: "filter_used", value: { not: null } },
        _count: { value: true },
        orderBy: { _count: { value: "desc" } },
        take: 5
      }),
      prisma.usageEvent.groupBy({
        by: ["value"],
        where: { eventType: "saved_view_used", value: { not: null } },
        _count: { value: true },
        orderBy: { _count: { value: "desc" } },
        take: 5
      }),
      prisma.usageEvent.count({ where: { eventType: "article_reviewed" } }),
      prisma.usageEvent.count({ where: { eventType: "project_created" } }),
      prisma.usageEvent.count({ where: { eventType: "report_generated" } })
    ]);

    return {
      mostVisitedPages,
      mostUsedFilters,
      mostUsedSavedViews,
      counters: {
        articlesReviewed,
        projectsCreated,
        reportsGenerated
      }
    };
  } catch {
    return {
      mostVisitedPages: [],
      mostUsedFilters: [],
      mostUsedSavedViews: [],
      counters: {
        articlesReviewed: 0,
        projectsCreated: 0,
        reportsGenerated: 0
      }
    };
  }
}

export async function recordUsageEvent(args: {
  userId?: string | null;
  email?: string | null;
  eventType: string;
  page?: string | null;
  entityType?: string | null;
  entityId?: string | null;
  key?: string | null;
  value?: string | null;
  metadata?: unknown;
}) {
  try {
    await prisma.usageEvent.create({
      data: {
        userId: args.userId ?? null,
        email: args.email ?? null,
        eventType: args.eventType,
        page: args.page ?? null,
        entityType: args.entityType ?? null,
        entityId: args.entityId ?? null,
        key: args.key ?? null,
        value: args.value ?? null,
        metadataJson: toJsonValue(args.metadata)
      }
    });
  } catch {
    // non-blocking
  }
}
