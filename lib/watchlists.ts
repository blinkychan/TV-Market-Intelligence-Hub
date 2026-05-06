import { Prisma, type AlertType, type MissingDataSeverity, type SavedViewVisibility, type WatchlistType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getCurrentUserContext } from "@/lib/team-auth";

export type WatchlistRecord = {
  id: string;
  name: string;
  description: string | null;
  watchType: WatchlistType;
  criteriaJson: Prisma.JsonValue | null;
  visibility: SavedViewVisibility;
  createdByUserId: string | null;
  createdByEmail: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export type AlertRecord = {
  id: string;
  watchlistId: string | null;
  entityType: string;
  entityId: string;
  alertType: AlertType;
  title: string;
  message: string;
  severity: MissingDataSeverity;
  isRead: boolean;
  createdAt: Date;
  watchlist?: {
    id: string;
    name: string;
    visibility: SavedViewVisibility;
    createdByEmail: string | null;
  } | null;
};

export type WatchlistEntity = {
  entityType: "Article" | "Project" | "CurrentShow" | "Buyer" | "Company" | "Person";
  entityId: string;
  title: string;
  buyer?: string | null;
  company?: string | null;
  person?: string | null;
  genre?: string | null;
  keywordText?: string | null;
  source?: string | null;
  status?: string | null;
  country?: string | null;
  url?: string | null;
};

type WatchlistCriteria = {
  pageType?: string;
  filters?: Record<string, unknown>;
  query?: string;
  terms?: string[];
  value?: string;
};

function normalize(value: string | null | undefined) {
  return (value ?? "").trim().toLowerCase();
}

function parseCriteria(criteriaJson: Prisma.JsonValue | null): WatchlistCriteria {
  if (!criteriaJson || typeof criteriaJson !== "object" || Array.isArray(criteriaJson)) {
    return {};
  }

  const criteria = criteriaJson as Record<string, unknown>;
  const terms = Array.isArray(criteria.terms)
    ? criteria.terms.map((item) => String(item).trim()).filter(Boolean)
    : typeof criteria.terms === "string"
      ? String(criteria.terms)
          .split(",")
          .map((item) => item.trim())
          .filter(Boolean)
      : [];

  return {
    pageType: typeof criteria.pageType === "string" ? criteria.pageType : undefined,
    filters: criteria.filters && typeof criteria.filters === "object" && !Array.isArray(criteria.filters) ? (criteria.filters as Record<string, unknown>) : undefined,
    query: typeof criteria.query === "string" ? criteria.query : undefined,
    terms,
    value: typeof criteria.value === "string" ? criteria.value : undefined
  };
}

function toInputJson(value: unknown): Prisma.InputJsonValue | Prisma.NullableJsonNullValueInput {
  if (value == null) return Prisma.JsonNull;
  return value as Prisma.InputJsonValue;
}

function matchesText(haystacks: Array<string | null | undefined>, needles: string[]) {
  if (!needles.length) return false;
  const corpus = haystacks.map(normalize).filter(Boolean).join(" ");
  return needles.some((needle) => corpus.includes(normalize(needle)));
}

function watchlistTerms(watchlist: WatchlistRecord) {
  const criteria = parseCriteria(watchlist.criteriaJson);
  const filters = criteria.filters ?? {};
  const explicitTerms = criteria.terms ?? [];
  const query = criteria.query ? [criteria.query] : [];
  const directValues = [
    criteria.value,
    typeof filters.buyer === "string" ? filters.buyer : null,
    typeof filters.platform === "string" ? filters.platform : null,
    typeof filters.studio === "string" ? filters.studio : null,
    typeof filters.genre === "string" ? filters.genre : null,
    typeof filters.status === "string" ? filters.status : null,
    typeof filters.country === "string" ? filters.country : null,
    typeof filters.source === "string" ? filters.source : null
  ].filter(Boolean) as string[];

  return Array.from(new Set([...explicitTerms, ...query, ...directValues].map((item) => item.trim()).filter(Boolean)));
}

function watchlistMatchesEntity(watchlist: WatchlistRecord, entity: WatchlistEntity) {
  const terms = watchlistTerms(watchlist);

  switch (watchlist.watchType) {
    case "buyer":
      return matchesText([entity.buyer, entity.title], terms);
    case "company":
      return matchesText([entity.company, entity.title], terms);
    case "person":
      return matchesText([entity.person, entity.title], terms);
    case "genre":
      return matchesText([entity.genre], terms);
    case "keyword":
      return matchesText([entity.title, entity.keywordText, entity.genre, entity.source], terms);
    case "source":
      return matchesText([entity.source, entity.url], terms);
    case "status":
      return matchesText([entity.status], terms);
    case "country":
      return matchesText([entity.country], terms);
    default:
      return false;
  }
}

async function createAlertIfMissing(args: {
  watchlistId?: string | null;
  entityType: WatchlistEntity["entityType"];
  entityId: string;
  alertType: AlertType;
  title: string;
  message: string;
  severity: MissingDataSeverity;
}) {
  const existing = await prisma.alert.findFirst({
    where: {
      watchlistId: args.watchlistId ?? null,
      entityType: args.entityType,
      entityId: args.entityId,
      alertType: args.alertType,
      title: args.title
    },
    select: { id: true }
  }).catch(() => null);

  if (existing) return null;

  return prisma.alert.create({
    data: {
      watchlistId: args.watchlistId ?? null,
      entityType: args.entityType,
      entityId: args.entityId,
      alertType: args.alertType,
      title: args.title,
      message: args.message,
      severity: args.severity
    }
  }).catch(() => null);
}

export async function getVisibleWatchlists() {
  const auth = await getCurrentUserContext();
  const email = auth.user?.email ?? null;

  return prisma.watchlist.findMany({
    where: {
      OR: [{ visibility: "team" }, ...(email ? [{ createdByEmail: email }] : [])]
    },
    orderBy: [{ visibility: "desc" }, { updatedAt: "desc" }]
  }).catch(() => []);
}

export async function getVisibleAlerts(filters?: {
  severity?: string | null;
  alertType?: string | null;
  watchlistId?: string | null;
  unreadOnly?: boolean;
}) {
  const auth = await getCurrentUserContext();
  const email = auth.user?.email ?? null;

  return prisma.alert.findMany({
    where: {
      ...(filters?.severity ? { severity: filters.severity as MissingDataSeverity } : {}),
      ...(filters?.alertType ? { alertType: filters.alertType as AlertType } : {}),
      ...(filters?.watchlistId ? { watchlistId: filters.watchlistId } : {}),
      ...(filters?.unreadOnly ? { isRead: false } : {}),
      OR: [
        { watchlist: null },
        { watchlist: { visibility: "team" } },
        ...(email ? [{ watchlist: { createdByEmail: email } }] : [])
      ]
    },
    include: {
      watchlist: {
        select: { id: true, name: true, visibility: true, createdByEmail: true }
      }
    },
    orderBy: [{ isRead: "asc" }, { severity: "desc" }, { createdAt: "desc" }]
  }).catch(() => []);
}

export async function getVisibleAlertsForEmail(
  email: string,
  filters?: {
    severity?: string | null;
    alertType?: string | null;
    unreadOnly?: boolean;
    watchlistOnly?: boolean;
  }
) {
  return prisma.alert.findMany({
    where: {
      ...(filters?.severity ? { severity: filters.severity as MissingDataSeverity } : {}),
      ...(filters?.alertType ? { alertType: filters.alertType as AlertType } : {}),
      ...(filters?.unreadOnly ? { isRead: false } : {}),
      ...(filters?.watchlistOnly ? { NOT: { watchlistId: null } } : {}),
      OR: [{ watchlist: null }, { watchlist: { visibility: "team" } }, { watchlist: { createdByEmail: email } }]
    },
    include: {
      watchlist: {
        select: { id: true, name: true, visibility: true, createdByEmail: true }
      }
    },
    orderBy: [{ isRead: "asc" }, { severity: "desc" }, { createdAt: "desc" }]
  }).catch(() => []);
}

export async function getUnreadAlertCount() {
  const alerts = await getVisibleAlerts({ unreadOnly: true });
  return alerts.length;
}

export async function triggerWatchlistAlertsForEntity(entity: WatchlistEntity, severity: MissingDataSeverity = "medium") {
  try {
    const watchlists = await getVisibleWatchlists();
    const matchingWatchlists = watchlists.filter((watchlist: (typeof watchlists)[number]) => watchlistMatchesEntity(watchlist, entity));

    await Promise.all(
      matchingWatchlists.map((watchlist: (typeof matchingWatchlists)[number]) =>
        createAlertIfMissing({
          watchlistId: watchlist.id,
          entityType: entity.entityType,
          entityId: entity.entityId,
          alertType: "new_match",
          title: `${watchlist.name} matched ${entity.title}`,
          message: `${entity.title} matched the ${watchlist.name} watchlist.`,
          severity
        })
      )
    );
  } catch {
    // Non-blocking alert creation
  }
}

export async function triggerStatusChangeAlert(args: {
  entityType: "Project" | "CurrentShow";
  entityId: string;
  label: string;
  previousStatus: string | null | undefined;
  nextStatus: string | null | undefined;
}) {
  if (!args.nextStatus || normalize(args.previousStatus) === normalize(args.nextStatus)) return;

  await createAlertIfMissing({
    entityType: args.entityType,
    entityId: args.entityId,
    alertType: args.entityType === "CurrentShow" ? "premiere_update" : "status_change",
    title: `${args.label} updated`,
    message:
      args.entityType === "CurrentShow"
        ? `${args.label} schedule changed to ${args.nextStatus}.`
        : `${args.label} changed from ${args.previousStatus ?? "unknown"} to ${args.nextStatus}.`,
    severity: "medium"
  }).catch(() => null);
}

export async function triggerPremiereUpdateAlert(args: {
  entityId: string;
  label: string;
  previousPremiereDate: Date | null | undefined;
  nextPremiereDate: Date | null | undefined;
}) {
  const previous = args.previousPremiereDate?.toISOString() ?? null;
  const next = args.nextPremiereDate?.toISOString() ?? null;
  if (previous === next || !next) return;

  await createAlertIfMissing({
    entityType: "CurrentShow",
    entityId: args.entityId,
    alertType: "premiere_update",
    title: `${args.label} premiere updated`,
    message: `${args.label} now points to ${new Date(next).toLocaleDateString("en-US")}.`,
    severity: "high"
  }).catch(() => null);
}

export async function triggerLowConfidenceAlert(args: {
  entityType: WatchlistEntity["entityType"];
  entityId: string;
  label: string;
  confidenceLevel?: string | null;
  impact?: "low" | "medium" | "high";
}) {
  if (normalize(args.confidenceLevel) !== "low") return;
  await createAlertIfMissing({
    entityType: args.entityType,
    entityId: args.entityId,
    alertType: "low_confidence",
    title: `${args.label} is low confidence`,
    message: `${args.label} is flagged as low confidence${args.impact === "high" ? " and may need quick review" : ""}.`,
    severity: args.impact === "high" ? "high" : "medium"
  }).catch(() => null);
}

export async function triggerDuplicateDetectedAlert(args: {
  entityType: WatchlistEntity["entityType"];
  entityId: string;
  label: string;
  details?: string | null;
}) {
  await createAlertIfMissing({
    entityType: args.entityType,
    entityId: args.entityId,
    alertType: "duplicate_detected",
    title: `${args.label} may be a duplicate`,
    message: args.details ?? `${args.label} was flagged as a possible duplicate and needs human review.`,
    severity: "high"
  }).catch(() => null);
}

export async function triggerMissingDataAlert(args: {
  entityType: WatchlistEntity["entityType"];
  entityId: string;
  missingField: string;
  reason: string;
  severity: MissingDataSeverity;
}) {
  await createAlertIfMissing({
    entityType: args.entityType,
    entityId: args.entityId,
    alertType: "missing_data",
    title: `${args.entityType} missing ${args.missingField.replaceAll("_", " ")}`,
    message: args.reason,
    severity: args.severity
  }).catch(() => null);
}

export async function saveWatchlist(args: {
  id?: string | null;
  name: string;
  description?: string | null;
  watchType: WatchlistType;
  criteriaJson?: unknown;
  visibility: SavedViewVisibility;
  createdByUserId?: string | null;
  createdByEmail?: string | null;
}) {
  if (args.id) {
    return prisma.watchlist.update({
      where: { id: args.id },
      data: {
        name: args.name,
        description: args.description ?? null,
        watchType: args.watchType,
        criteriaJson: toInputJson(args.criteriaJson),
        visibility: args.visibility
      }
    });
  }

  return prisma.watchlist.create({
    data: {
      name: args.name,
      description: args.description ?? null,
      watchType: args.watchType,
      criteriaJson: toInputJson(args.criteriaJson),
      visibility: args.visibility,
      createdByUserId: args.createdByUserId ?? null,
      createdByEmail: args.createdByEmail ?? null
    }
  });
}
