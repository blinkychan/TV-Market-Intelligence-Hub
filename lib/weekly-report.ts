import { addDays, endOfDay, format, isFriday, parseISO, startOfDay } from "date-fns";
import { getDashboardReportInsights, getDashboardSnapshot } from "@/lib/dashboard-insights";
import { prisma } from "@/lib/prisma";
import { mockBuyerDetails } from "@/lib/mock-buyers";
import { mockCurrentShows } from "@/lib/mock-current-tv";
import { mockAlerts } from "@/lib/mock-watchlists";
import { formatDate, humanize } from "@/lib/utils";
import { getAutoPopulationWeeklySummary } from "@/lib/autonomous-population";
import { getDigDeeperWeeklySummary } from "@/lib/dig-deeper";

type ReportProject = {
  title: string;
  status: string;
  genre: string | null;
  buyer: string | null;
  people: { name: string; role?: string }[];
  isAcquisition: boolean;
  isCoProduction: boolean;
  isInternational: boolean;
  announcementDate: Date | null;
  lastUpdateDate: Date | null;
  confidenceLevel?: string | null;
};

type ReportShow = {
  title: string;
  networkOrPlatform: string;
  premiereDate: Date | null;
  finaleDate: Date | null;
  status: string;
  seasonType: string | null;
  confidenceLevel?: string | null;
};

type ReportArticle = {
  headline: string;
  publication: string | null;
  publishedDate: Date | null;
  confidenceLevel?: string | null;
};

type ReportTeamNote = {
  id: string;
  entityType: string;
  entityId: string;
  note: string;
  tags: string | null;
  createdByEmail: string | null;
  updatedAt: Date;
};

type ReportCoverageIssue = {
  sourceName: string;
  sourceType: string;
  failuresLast7Days: number;
  articlesSavedLastRun: number;
  lastSuccessfulFetchAt: Date | null;
};

type ReportMissingFlag = {
  entityType: string;
  entityId: string;
  missingField: string;
  severity: string;
  reason: string;
};

type ReportWatchlistAlert = {
  id: string;
  title: string;
  message: string;
  severity: string;
  watchlistName: string | null;
  entityType: string;
  entityId: string;
};

export type WeeklyReportPayload = {
  title: string;
  markdown: string;
  reportDate: Date;
  weekStart: Date;
  weekEnd: Date;
  dataSource: "database" | "mock";
  executiveSummary: string;
  includedTeamNotes: ReportTeamNote[];
  includedDashboardSignals: string[];
  includedCoverageIssues: string[];
  includedWatchlistAlerts: ReportWatchlistAlert[];
};

function getCoverageWindow(reportDate: Date) {
  const weekStart = addDays(startOfDay(reportDate), -4);
  const weekEnd = endOfDay(addDays(reportDate, 2));
  const nextWeekStart = startOfDay(addDays(reportDate, 3));
  const nextWeekEnd = endOfDay(addDays(reportDate, 9));
  return { weekStart, weekEnd, nextWeekStart, nextWeekEnd };
}

function listProjects(projects: ReportProject[]) {
  if (!projects.length) return "- None logged.";
  return projects
    .map((project) => {
      const buyer = project.buyer ?? "Unknown buyer";
      const people = project.people.length ? ` Attachments: ${project.people.map((person) => person.name).join(", ")}.` : "";
      return `- **${project.title}** (${humanize(project.status)}) - ${buyer}; ${project.genre ?? "genre TBD"}.${people}`;
    })
    .join("\n");
}

function listShows(shows: ReportShow[]) {
  if (!shows.length) return "- No premieres logged for next week.";
  const groups = new Map<string, ReportShow[]>();
  shows.forEach((show) => {
    const key = formatDate(show.premiereDate ?? show.finaleDate);
    groups.set(key, [...(groups.get(key) ?? []), show]);
  });

  return Array.from(groups.entries())
    .map(([dateLabel, items]) => {
      const lines = items
        .map((show) => {
          const eventLabel =
            show.seasonType === "finale" || show.status.toLowerCase().includes("finale")
              ? "finale"
              : show.seasonType === "returning_series" || show.status.toLowerCase().includes("returning")
                ? "returning season"
                : show.seasonType === "special"
                  ? "special"
                  : "new series";

          return `  - **${show.networkOrPlatform}**: ${show.title} (${eventLabel})`;
        })
        .join("\n");
      return `- **${dateLabel}**\n${lines}`;
    })
    .join("\n");
}

function listArticles(articles: ReportArticle[]) {
  if (!articles.length) return "- No review items currently flagged.";
  return articles.map((article) => `- ${article.headline} (${article.publication ?? "Unknown source"})`).join("\n");
}

function listLowConfidenceItems(items: Array<{ label: string; type: string; confidenceLevel?: string | null }>) {
  if (!items.length) return "- No low-confidence items are currently elevated.";
  return items.map((item) => `- **${item.label}** (${item.type})`).join("\n");
}

function listCoverageIssues(sourceCoverageIssues: ReportCoverageIssue[], missingDataFlags: ReportMissingFlag[]) {
  const items = [
    ...sourceCoverageIssues.map(
      (issue) =>
        `- **${issue.sourceName}** (${humanize(issue.sourceType)}): ${issue.failuresLast7Days} failure${issue.failuresLast7Days === 1 ? "" : "s"} in the last 7 days, ${issue.articlesSavedLastRun} saved on the last run, last success ${formatDate(issue.lastSuccessfulFetchAt)}.`
    ),
    ...missingDataFlags.map(
      (flag) =>
        `- **${flag.entityType} ${flag.entityId.slice(0, 8)}**: ${humanize(flag.missingField)} (${humanize(flag.severity)}) - ${flag.reason}`
    )
  ];

  if (!items.length) return "- No elevated data-quality or coverage issues this week.";
  return items.join("\n");
}

function listTeamNotes(notes: ReportTeamNote[]) {
  if (!notes.length) return "- No team notes flagged for this report.";
  return notes
    .map((note) => {
      const tags = note.tags ? ` [${note.tags}]` : "";
      const author = note.createdByEmail ?? "Unknown teammate";
      return `- **${humanize(note.entityType)} ${note.entityId.slice(0, 8)}**${tags}: ${note.note} (${author})`;
    })
    .join("\n");
}

function listWatchlistAlerts(alerts: ReportWatchlistAlert[]) {
  if (!alerts.length) return "- No unread high-severity watchlist alerts are currently elevated.";
  return alerts
    .map((alert) => {
      const watchlist = alert.watchlistName ? ` [${alert.watchlistName}]` : "";
      return `- **${alert.title}**${watchlist}: ${alert.message}`;
    })
    .join("\n");
}

type AutoPopSummary = {
  created: Array<{ entityType: string | null; entityId: string | null; confidenceScore: number | null; notes: string | null }>;
  flagged: Array<{ articleId: string | null; notes: string | null }>;
  deduplicated: Array<{ entityId: string | null }>;
  total: number;
};

type DigDeeperSummary = {
  total: number;
  withFindings: number;
  applied: number;
};

function listAutoPopulation(summary: AutoPopSummary) {
  if (summary.total === 0) return "- No auto-population activity this week.";
  const lines: string[] = [];
  if (summary.created.length) {
    lines.push(`**Auto-Created Records (${summary.created.length})** _(All marked Needs Review)_`);
    for (const entry of summary.created.slice(0, 8)) {
      const conf = entry.confidenceScore ? ` · ${Math.round(entry.confidenceScore * 100)}% confidence` : "";
      lines.push(`- ${entry.entityType ?? "Record"} \`${(entry.entityId ?? "").slice(0, 8)}\`${conf}${entry.notes ? ` — ${entry.notes}` : ""}`);
    }
    if (summary.created.length > 8) lines.push(`- _…and ${summary.created.length - 8} more_`);
  }
  if (summary.flagged.length) {
    lines.push(`\n**Flagged for Human Review (${summary.flagged.length})**`);
    for (const entry of summary.flagged.slice(0, 5)) {
      lines.push(`- Article \`${(entry.articleId ?? "").slice(0, 8)}\`${entry.notes ? `: ${entry.notes}` : ""}`);
    }
    if (summary.flagged.length > 5) lines.push(`- _…and ${summary.flagged.length - 5} more_`);
  }
  if (summary.deduplicated.length) {
    lines.push(`\n**Deduplicated / Linked (${summary.deduplicated.length})** — linked to existing records, not re-created.`);
  }
  return lines.join("\n");
}

function listDigDeeperActivity(summary: DigDeeperSummary) {
  if (summary.total === 0) return "- No Dig Deeper runs this week.";
  const lines = [
    `- **${summary.total}** Dig Deeper run${summary.total === 1 ? "" : "s"} this week`,
    `- **${summary.withFindings}** returned new findings`,
    `- **${summary.applied}** had approved updates applied`,
  ];
  if (summary.applied > 0) {
    lines.push("- _Note: all applied updates remain marked Needs Review for final verification._");
  }
  return lines.join("\n");
}

function buildMarkdown({
  reportDate,
  weekStart,
  weekEnd,
  sales,
  pilotOrders,
  seriesOrders,
  majorAttachments,
  acquisitions,
  international,
  premieres,
  buyerSummary,
  staleProjects,
  reviewItems,
  teamNotes,
  watchlistAlerts,
  lowConfidenceItems,
  sourceCoverageIssues,
  missingDataFlags,
  autoPopSummary,
  digDeeperSummary,
}: {
  reportDate: Date;
  weekStart: Date;
  weekEnd: Date;
  sales: ReportProject[];
  pilotOrders: ReportProject[];
  seriesOrders: ReportProject[];
  majorAttachments: ReportProject[];
  acquisitions: ReportProject[];
  international: ReportProject[];
  premieres: ReportShow[];
  buyerSummary: string;
  staleProjects: ReportProject[];
  reviewItems: ReportArticle[];
  teamNotes: ReportTeamNote[];
  watchlistAlerts: ReportWatchlistAlert[];
  lowConfidenceItems: Array<{ label: string; type: string; confidenceLevel?: string | null }>;
  sourceCoverageIssues: ReportCoverageIssue[];
  missingDataFlags: ReportMissingFlag[];
  autoPopSummary: AutoPopSummary;
  digDeeperSummary: DigDeeperSummary;
}) {
  const executiveSummary = [
    `${sales.filter((project) => project.confidenceLevel !== "low").length} sales`,
    `${pilotOrders.filter((project) => project.confidenceLevel !== "low").length} pilot orders`,
    `${seriesOrders.filter((project) => project.confidenceLevel !== "low").length} series orders`,
    `${premieres.filter((show) => show.confidenceLevel !== "low").length} premieres next week`,
    `${reviewItems.length} items needing review`,
    ...(autoPopSummary.created.length ? [`${autoPopSummary.created.length} auto-created drafts`] : []),
  ].join(" · ");

  const attachmentSummary = majorAttachments.length
    ? majorAttachments
        .map((project) => `- **${project.title}**: ${project.people.map((person) => `${person.name}${person.role ? ` (${humanize(person.role)})` : ""}`).join(", ")}`)
        .join("\n")
    : "- No major attachments logged.";

  const markdown = `# TV Market Intelligence Weekly Report

**Friday report date:** ${format(reportDate, "MMMM d, yyyy")}
**Coverage window:** ${format(weekStart, "MMMM d, yyyy")} - ${format(weekEnd, "MMMM d, yyyy")}

## Executive Summary
${executiveSummary}

## TV Sales This Week
${listProjects(sales)}

## Pilot Orders This Week
${listProjects(pilotOrders)}

## Series Orders This Week
${listProjects(seriesOrders)}

## Major Talent Attachments
${attachmentSummary}

## Acquisitions / Co-Productions
${listProjects(acquisitions)}

## International Projects
${listProjects(international)}

## Shows Premiering Next Week
${listShows(premieres)}

## Buyer Activity Summary
${buyerSummary}

## Stale / Possibly Dead Projects
${listProjects(staleProjects)}

## Items Needing Review
${listArticles(reviewItems)}

## Low Confidence / Needs Review
${listLowConfidenceItems(lowConfidenceItems)}

## Auto-Population Activity
${listAutoPopulation(autoPopSummary)}

## Dig Deeper Activity
${listDigDeeperActivity(digDeeperSummary)}

## Data Quality / Coverage Issues
${listCoverageIssues(sourceCoverageIssues, missingDataFlags)}

## Team Notes / Flags
${listTeamNotes(teamNotes)}

## Watchlist Alerts
${listWatchlistAlerts(watchlistAlerts)}
`;

  return { markdown, executiveSummary };
}

async function fetchDatabaseData(reportDate: Date) {
  const { weekStart, weekEnd, nextWeekStart, nextWeekEnd } = getCoverageWindow(reportDate);
  const [projects, premieres, reviewItems, teamNotes, sourceCoverageIssues, missingDataFlags, watchlistAlerts] = await Promise.all([
    prisma.project.findMany({
      where: { announcementDate: { gte: weekStart, lte: weekEnd } },
      include: { buyer: true, people: true },
      orderBy: [{ announcementDate: "asc" }, { title: "asc" }]
    }),
    prisma.currentShow.findMany({
      where: {
        OR: [
          { premiereDate: { gte: nextWeekStart, lte: nextWeekEnd } },
          { finaleDate: { gte: nextWeekStart, lte: nextWeekEnd } }
        ]
      },
      orderBy: [{ premiereDate: "asc" }, { finaleDate: "asc" }, { title: "asc" }]
    }),
    prisma.article.findMany({
      where: { needsReview: true },
      orderBy: [{ publishedDate: "desc" }, { createdAt: "desc" }],
      take: 12
    }),
    prisma.teamNote.findMany({
      where: { includeInNextWeeklyReport: true },
      orderBy: [{ updatedAt: "desc" }],
      take: 12
    }),
    prisma.sourceCoverage.findMany({
      where: {
        OR: [{ failuresLast7Days: { gt: 0 } }, { enabled: true, articlesSavedLastRun: 0 }]
      },
      orderBy: [{ failuresLast7Days: "desc" }, { updatedAt: "desc" }],
      take: 8
    }),
    prisma.missingDataFlag.findMany({
      where: {
        resolvedAt: null,
        severity: { in: ["high", "medium"] }
      },
      orderBy: [{ severity: "desc" }, { createdAt: "desc" }],
      take: 10
    }),
    prisma.alert.findMany({
      where: { severity: "high", isRead: false },
      include: { watchlist: { select: { name: true } } },
      orderBy: [{ createdAt: "desc" }],
      take: 10
    })
  ]);

  const reportProjects: ReportProject[] = projects.map((project: (typeof projects)[number]) => ({
    title: project.title,
    status: project.status,
    genre: project.genre,
    buyer: project.buyer?.name ?? project.networkOrPlatform ?? null,
    people: project.people.map((person: (typeof project.people)[number]) => ({ name: person.name, role: person.role })),
    isAcquisition: project.isAcquisition,
    isCoProduction: project.isCoProduction,
    isInternational: project.isInternational,
    announcementDate: project.announcementDate,
    lastUpdateDate: project.lastUpdateDate,
    confidenceLevel: project.confidenceLevel
  }));
  const staleProjects = await prisma.project.findMany({
    where: { status: "stale" },
    include: { buyer: true, people: true },
    orderBy: [{ lastUpdateDate: "desc" }, { title: "asc" }],
    take: 12
  });

  return {
    dataSource: "database" as const,
    weekStart,
    weekEnd,
    projects: reportProjects,
    premieres: premieres.map((show: (typeof premieres)[number]) => ({
      title: show.title,
      networkOrPlatform: show.networkOrPlatform,
      premiereDate: show.premiereDate,
      finaleDate: show.finaleDate,
      status: show.status,
      seasonType: show.seasonType,
      confidenceLevel: show.confidenceLevel
    })),
    reviewItems: reviewItems.map((article: (typeof reviewItems)[number]) => ({
      headline: article.headline,
      publication: article.publication,
      publishedDate: article.publishedDate,
      confidenceLevel: article.extractionConfidence != null && article.extractionConfidence < 0.55 ? "low" : "medium"
    })),
    teamNotes: teamNotes.map((note: (typeof teamNotes)[number]) => ({
      id: note.id,
      entityType: note.entityType,
      entityId: note.entityId,
      note: note.note,
      tags: note.tags,
      createdByEmail: note.createdByEmail,
      updatedAt: note.updatedAt
    })),
    sourceCoverageIssues: sourceCoverageIssues.map((issue: (typeof sourceCoverageIssues)[number]) => ({
      sourceName: issue.sourceName,
      sourceType: issue.sourceType,
      failuresLast7Days: issue.failuresLast7Days,
      articlesSavedLastRun: issue.articlesSavedLastRun,
      lastSuccessfulFetchAt: issue.lastSuccessfulFetchAt
    })),
    missingDataFlags: missingDataFlags.map((flag: (typeof missingDataFlags)[number]) => ({
      entityType: flag.entityType,
      entityId: flag.entityId,
      missingField: flag.missingField,
      severity: flag.severity,
      reason: flag.reason
    })),
    watchlistAlerts: watchlistAlerts.map((alert: (typeof watchlistAlerts)[number]) => ({
      id: alert.id,
      title: alert.title,
      message: alert.message,
      severity: alert.severity,
      watchlistName: alert.watchlist?.name ?? null,
      entityType: alert.entityType,
      entityId: alert.entityId
    })),
    staleProjects: staleProjects.map((project: (typeof staleProjects)[number]) => ({
      title: project.title,
      status: project.status,
      genre: project.genre,
      buyer: project.buyer?.name ?? project.networkOrPlatform ?? null,
      people: project.people.map((person: (typeof project.people)[number]) => ({ name: person.name, role: person.role })),
      isAcquisition: project.isAcquisition,
      isCoProduction: project.isCoProduction,
      isInternational: project.isInternational,
      announcementDate: project.announcementDate,
      lastUpdateDate: project.lastUpdateDate,
      confidenceLevel: project.confidenceLevel
    })),
    autoPopSummary: await getAutoPopulationWeeklySummary(weekStart, weekEnd),
    digDeeperSummary: await getDigDeeperWeeklySummary(weekStart, weekEnd),
  };
}

function fetchMockData(reportDate: Date) {
  const { weekStart, weekEnd, nextWeekStart, nextWeekEnd } = getCoverageWindow(reportDate);
  const projects: ReportProject[] = mockBuyerDetails.flatMap((buyer) =>
    buyer.projects.map((project) => ({
      title: project.title,
      status: project.status,
      genre: project.genre,
      buyer: buyer.name,
      people: project.people.map((name) => ({ name })),
      isAcquisition: project.isAcquisition,
      isCoProduction: project.isCoProduction,
      isInternational: project.isInternational,
      announcementDate: project.announcementDate ? new Date(project.announcementDate) : null,
      lastUpdateDate: project.lastUpdateDate ? new Date(project.lastUpdateDate) : null,
      confidenceLevel: project.status === "stale" ? "low" : "medium"
    }))
  );

  return {
    dataSource: "mock" as const,
    weekStart,
    weekEnd,
    projects: projects.filter((project) => project.announcementDate && project.announcementDate >= weekStart && project.announcementDate <= weekEnd),
    premieres: mockCurrentShows
      .map((show) => ({
        title: show.title,
        networkOrPlatform: show.networkOrPlatform,
        premiereDate: show.premiereDate ? new Date(show.premiereDate) : null,
        finaleDate: show.finaleDate ? new Date(show.finaleDate) : null,
        status: show.status,
        seasonType: show.seasonType ?? null,
        confidenceLevel: show.confidenceLevel ?? "medium"
      }))
      .filter(
        (show) =>
          (show.premiereDate && show.premiereDate >= nextWeekStart && show.premiereDate <= nextWeekEnd) ||
          (show.finaleDate && show.finaleDate >= nextWeekStart && show.finaleDate <= nextWeekEnd)
      ),
    reviewItems: [
      { headline: "Netflix buys Harbor Lights from A24 Television and wiip", publication: "Sample Trade", publishedDate: new Date("2026-04-21T12:00:00.000Z"), confidenceLevel: "medium" },
      { headline: "BBC and Universal set Northern Exchange co-production", publication: "Sample Trade", publishedDate: new Date("2026-04-24T12:00:00.000Z"), confidenceLevel: "low" }
    ],
    teamNotes: [
      {
        id: "mock-team-note-1",
        entityType: "Project",
        entityId: "mock-project-harbor-lights",
        note: "A24 package is drawing stronger buyer urgency than the first headline suggested.",
        tags: "heat, follow-up",
        createdByEmail: "preview@team.local",
        updatedAt: new Date("2026-04-25T12:00:00.000Z")
      }
    ],
    watchlistAlerts: mockAlerts
      .filter((alert) => alert.severity === "high" && !alert.isRead)
      .map((alert) => ({
        id: alert.id,
        title: alert.title,
        message: alert.message,
        severity: alert.severity,
        watchlistName: alert.watchlist?.name ?? null,
        entityType: alert.entityType,
        entityId: alert.entityId
      })),
    sourceCoverageIssues: [
      {
        sourceName: "TVLine",
        sourceType: "rss",
        failuresLast7Days: 2,
        articlesSavedLastRun: 0,
        lastSuccessfulFetchAt: new Date("2026-04-21T12:00:00.000Z")
      }
    ],
    missingDataFlags: [
      {
        entityType: "Article",
        entityId: "mock-article-3",
        missingField: "body_text",
        severity: "medium",
        reason: "Article body text is unavailable; extraction is relying on excerpt, summary, or headline."
      },
      {
        entityType: "CurrentShow",
        entityId: "mock-signal-house",
        missingField: "low_confidence",
        severity: "high",
        reason: "Current show confidence is low."
      }
    ],
    staleProjects: projects.filter((project) => project.status === "stale"),
    autoPopSummary: {
      created: [
        { entityType: "Project", entityId: "mock-auto-project-1", confidenceScore: 0.87, notes: "Auto-created \"Harbor Lights\" (cautious mode)" },
        { entityType: "Project", entityId: "mock-auto-project-2", confidenceScore: 0.82, notes: "Auto-created \"Northern Exchange\" (cautious mode)" },
        { entityType: "CurrentShow", entityId: "mock-auto-show-1", confidenceScore: 0.91, notes: "Auto-created \"Signal House S2\" (cautious mode)" },
      ],
      flagged: [
        { articleId: "mock-ap-4", notes: "Confidence 61% below 80% threshold" },
        { articleId: "mock-ap-5", notes: "Confidence 58% below 80% threshold" },
      ],
      deduplicated: [],
      total: 5,
    },
    digDeeperSummary: { total: 2, withFindings: 2, applied: 1 },
  };
}

export function getDefaultFriday(now = new Date()) {
  const date = startOfDay(now);
  for (let offset = 0; offset < 7; offset += 1) {
    const candidate = addDays(date, -offset);
    if (isFriday(candidate)) return candidate;
  }
  return date;
}

export async function generateWeeklyReportPayload(reportDateValue: string, forceMock = false): Promise<WeeklyReportPayload> {
  const reportDate = parseISO(reportDateValue);
  const sourceData = forceMock ? fetchMockData(reportDate) : await fetchDatabaseData(reportDate).catch(() => fetchMockData(reportDate));
  const { projects, premieres, reviewItems, staleProjects, teamNotes, watchlistAlerts, sourceCoverageIssues, missingDataFlags, weekStart, weekEnd, dataSource, autoPopSummary, digDeeperSummary } = sourceData;

  const sales = projects.filter((project) => project.status === "sold");
  const pilotOrders = projects.filter((project) => project.status === "pilot_order");
  const seriesOrders = projects.filter((project) => project.status === "series_order");
  const majorAttachments = projects.filter((project) => project.people.length > 0);
  const acquisitions = projects.filter((project) => project.isAcquisition || project.isCoProduction);
  const international = projects.filter((project) => project.isInternational);
  const lowConfidenceItems = [
    ...projects.filter((project) => project.confidenceLevel === "low").map((project) => ({ label: project.title, type: `Project · ${project.status}`, confidenceLevel: project.confidenceLevel })),
    ...premieres
      .filter((show: (typeof premieres)[number]) => show.confidenceLevel === "low")
      .map((show: (typeof premieres)[number]) => ({ label: show.title, type: `Current Show · ${show.networkOrPlatform}`, confidenceLevel: show.confidenceLevel })),
    ...reviewItems
      .filter((article: (typeof reviewItems)[number]) => article.confidenceLevel === "low")
      .map((article: (typeof reviewItems)[number]) => ({ label: article.headline, type: "Article", confidenceLevel: article.confidenceLevel }))
  ];

  const buyerCounts = new Map<string, number>();
  projects.forEach((project) => {
    const buyer = project.buyer ?? "Unknown buyer";
    buyerCounts.set(buyer, (buyerCounts.get(buyer) ?? 0) + 1);
  });
  const buyerSummary =
    Array.from(buyerCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([buyer, count]) => `- **${buyer}**: ${count} tracked item${count === 1 ? "" : "s"}`)
      .join("\n") || "- No buyer activity logged for this week.";

  const dashboardSnapshot = await getDashboardSnapshot({}, reportDate, dataSource === "mock").catch(() => null);
  const dashboardInsights = dashboardSnapshot ? getDashboardReportInsights(dashboardSnapshot) : { markdown: "", signals: [] };

  const { markdown, executiveSummary } = buildMarkdown({
    reportDate,
    weekStart,
    weekEnd,
    sales,
    pilotOrders,
    seriesOrders,
    majorAttachments,
    acquisitions,
    international,
    premieres,
    buyerSummary,
    staleProjects,
    reviewItems,
    teamNotes,
    watchlistAlerts,
    lowConfidenceItems,
    sourceCoverageIssues,
    missingDataFlags,
    autoPopSummary,
    digDeeperSummary,
  });

  const fullMarkdown = `${markdown}
${dashboardInsights.markdown ? `\n${dashboardInsights.markdown}` : ""}`;

  return {
    title: `TV Market Intelligence Weekly Report - ${reportDate.toISOString().slice(0, 10)}`,
    markdown: fullMarkdown,
    reportDate,
    weekStart,
    weekEnd,
    dataSource,
    executiveSummary,
    includedTeamNotes: teamNotes,
    includedDashboardSignals: dashboardInsights.signals.map((signal) => signal.title),
    includedCoverageIssues: [
      ...sourceCoverageIssues.map((issue: (typeof sourceCoverageIssues)[number]) => `${issue.sourceName} (${issue.failuresLast7Days} failures)`),
      ...missingDataFlags.map((flag: (typeof missingDataFlags)[number]) => `${flag.entityType} ${flag.entityId.slice(0, 8)} missing ${flag.missingField}`)
    ],
    includedWatchlistAlerts: watchlistAlerts
  };
}
