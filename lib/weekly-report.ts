import { addDays, endOfDay, format, isFriday, parseISO, startOfDay } from "date-fns";
import { prisma } from "@/lib/prisma";
import { mockBuyerDetails } from "@/lib/mock-buyers";
import { mockCurrentShows } from "@/lib/mock-current-tv";
import { formatDate, humanize } from "@/lib/utils";

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
};

type ReportShow = {
  title: string;
  networkOrPlatform: string;
  premiereDate: Date | null;
  status: string;
};

type ReportArticle = {
  headline: string;
  publication: string | null;
  publishedDate: Date | null;
};

export type WeeklyReportPayload = {
  title: string;
  markdown: string;
  reportDate: Date;
  weekStart: Date;
  weekEnd: Date;
  dataSource: "database" | "mock";
  executiveSummary: string;
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
  return shows.map((show) => `- **${show.title}** premieres ${formatDate(show.premiereDate)} on ${show.networkOrPlatform}.`).join("\n");
}

function listArticles(articles: ReportArticle[]) {
  if (!articles.length) return "- No review items currently flagged.";
  return articles.map((article) => `- ${article.headline} (${article.publication ?? "Unknown source"})`).join("\n");
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
  reviewItems
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
}) {
  const executiveSummary = [
    `${sales.length} sales`,
    `${pilotOrders.length} pilot orders`,
    `${seriesOrders.length} series orders`,
    `${premieres.length} premieres next week`,
    `${reviewItems.length} items needing review`
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
`;

  return { markdown, executiveSummary };
}

async function fetchDatabaseData(reportDate: Date) {
  const { weekStart, weekEnd, nextWeekStart, nextWeekEnd } = getCoverageWindow(reportDate);
  const [projects, premieres, reviewItems] = await Promise.all([
    prisma.project.findMany({
      where: { announcementDate: { gte: weekStart, lte: weekEnd } },
      include: { buyer: true, people: true },
      orderBy: [{ announcementDate: "asc" }, { title: "asc" }]
    }),
    prisma.currentShow.findMany({
      where: { premiereDate: { gte: nextWeekStart, lte: nextWeekEnd } },
      orderBy: [{ premiereDate: "asc" }, { title: "asc" }]
    }),
    prisma.article.findMany({
      where: { needsReview: true },
      orderBy: [{ publishedDate: "desc" }, { createdAt: "desc" }],
      take: 12
    })
  ]);

  const reportProjects: ReportProject[] = projects.map((project) => ({
    title: project.title,
    status: project.status,
    genre: project.genre,
    buyer: project.buyer?.name ?? project.networkOrPlatform ?? null,
    people: project.people.map((person) => ({ name: person.name, role: person.role })),
    isAcquisition: project.isAcquisition,
    isCoProduction: project.isCoProduction,
    isInternational: project.isInternational,
    announcementDate: project.announcementDate,
    lastUpdateDate: project.lastUpdateDate
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
    premieres: premieres.map((show) => ({
      title: show.title,
      networkOrPlatform: show.networkOrPlatform,
      premiereDate: show.premiereDate,
      status: show.status
    })),
    reviewItems: reviewItems.map((article) => ({
      headline: article.headline,
      publication: article.publication,
      publishedDate: article.publishedDate
    })),
    staleProjects: staleProjects.map((project) => ({
      title: project.title,
      status: project.status,
      genre: project.genre,
      buyer: project.buyer?.name ?? project.networkOrPlatform ?? null,
      people: project.people.map((person) => ({ name: person.name, role: person.role })),
      isAcquisition: project.isAcquisition,
      isCoProduction: project.isCoProduction,
      isInternational: project.isInternational,
      announcementDate: project.announcementDate,
      lastUpdateDate: project.lastUpdateDate
    }))
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
      lastUpdateDate: project.lastUpdateDate ? new Date(project.lastUpdateDate) : null
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
        status: show.status
      }))
      .filter((show) => show.premiereDate && show.premiereDate >= nextWeekStart && show.premiereDate <= nextWeekEnd),
    reviewItems: [
      { headline: "Netflix buys Harbor Lights from A24 Television and wiip", publication: "Sample Trade", publishedDate: new Date("2026-04-21T12:00:00.000Z") },
      { headline: "BBC and Universal set Northern Exchange co-production", publication: "Sample Trade", publishedDate: new Date("2026-04-24T12:00:00.000Z") }
    ],
    staleProjects: projects.filter((project) => project.status === "stale")
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
  const { projects, premieres, reviewItems, staleProjects, weekStart, weekEnd, dataSource } = sourceData;

  const sales = projects.filter((project) => project.status === "sold");
  const pilotOrders = projects.filter((project) => project.status === "pilot_order");
  const seriesOrders = projects.filter((project) => project.status === "series_order");
  const majorAttachments = projects.filter((project) => project.people.length > 0);
  const acquisitions = projects.filter((project) => project.isAcquisition || project.isCoProduction);
  const international = projects.filter((project) => project.isInternational);

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
    reviewItems
  });

  return {
    title: `TV Market Intelligence Weekly Report - ${reportDate.toISOString().slice(0, 10)}`,
    markdown,
    reportDate,
    weekStart,
    weekEnd,
    dataSource,
    executiveSummary
  };
}
