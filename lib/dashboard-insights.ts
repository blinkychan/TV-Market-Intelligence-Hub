import { addDays, endOfDay, format, isWithinInterval, startOfDay, subDays } from "date-fns";
import { mockBuyerDetails } from "@/lib/mock-buyers";
import { mockCurrentShows } from "@/lib/mock-current-tv";
import { prisma } from "@/lib/prisma";
import { mockReviewArticles } from "@/lib/mock-review";
import { canUseMockPreview, mockPreviewDisabledReason } from "@/lib/runtime-mode";
import { humanize } from "@/lib/utils";

export type DashboardFilters = {
  from?: string;
  to?: string;
  buyer?: string;
  genre?: string;
  status?: string;
  country?: string;
  type?: string;
  acquisition?: string;
  coProduction?: string;
  international?: string;
};

export type DashboardProjectRecord = {
  id: string;
  title: string;
  type: string;
  status: string;
  buyer: string | null;
  buyerId: string | null;
  studio: string | null;
  productionCompanies: string[];
  people: string[];
  genre: string | null;
  country: string | null;
  isInternational: boolean;
  isCoProduction: boolean;
  isAcquisition: boolean;
  announcementDate: Date | null;
  lastUpdateDate: Date | null;
  sourceUrl: string | null;
  needsReview: boolean;
};

export type DashboardShowRecord = {
  id: string;
  title: string;
  networkOrPlatform: string;
  buyerHref: string | null;
  premiereDate: Date | null;
  finaleDate: Date | null;
  status: string;
  genre: string | null;
  studio: string | null;
  country: string | null;
  seasonType: string | null;
};

export type DashboardArticleRecord = {
  id: string;
  headline: string;
  publication: string | null;
  publishedDate: Date | null;
  extractionStatus: string;
  needsReview: boolean;
};

export type DashboardSignal = {
  title: string;
  signal: string;
  support: string[];
  href: string;
};

export type DashboardSnapshot = {
  dataSource: "database" | "mock";
  errorMessage?: string | null;
  filters: DashboardFilters;
  referenceDate: Date;
  projects: DashboardProjectRecord[];
  shows: DashboardShowRecord[];
  articles: DashboardArticleRecord[];
  availableBuyers: string[];
  availableGenres: string[];
  availableStatuses: string[];
  availableCountries: string[];
  availableTypes: string[];
};

function truthyBooleanFilter(value: boolean, filter?: string) {
  if (!filter || filter === "all") return true;
  if (filter === "yes") return value;
  if (filter === "no") return !value;
  return true;
}

function inDateRange(value: Date | null, from?: string, to?: string) {
  if (!value) return !from && !to;
  if (from && value < startOfDay(new Date(from))) return false;
  if (to && value > endOfDay(new Date(to))) return false;
  return true;
}

function buildDevelopmentHref(filters: Record<string, string>) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) {
    if (!value || value === "all") continue;
    params.set(key, value);
  }
  return params.size ? `/development?${params.toString()}` : "/development";
}

function buildCurrentTvHref(filters: Record<string, string>) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) {
    if (!value || value === "all") continue;
    params.set(key, value);
  }
  return params.size ? `/current-tv?${params.toString()}` : "/current-tv";
}

function countByLabel(labels: string[]) {
  const counts = new Map<string, number>();
  for (const label of labels) {
    counts.set(label, (counts.get(label) ?? 0) + 1);
  }
  return Array.from(counts.entries())
    .map(([label, count]) => ({ label, count }))
    .sort((left, right) => right.count - left.count);
}

function monthKey(date: Date | null) {
  return date ? format(date, "MMM yyyy") : "Undated";
}

function monthsBackSeries(records: DashboardProjectRecord[], extractor: (record: DashboardProjectRecord) => boolean, referenceDate: Date, months = 6) {
  const windows = Array.from({ length: months }, (_, index) => {
    const start = startOfDay(subDays(referenceDate, (months - index - 1) * 30));
    const end = endOfDay(addDays(start, 29));
    return { label: format(start, "MMM yyyy"), start, end };
  });

  return windows.map((window) => ({
    label: window.label,
    count: records.filter((record) => {
      const date = record.announcementDate ?? record.lastUpdateDate;
      return extractor(record) && Boolean(date) && isWithinInterval(date as Date, { start: window.start, end: window.end });
    }).length
  }));
}

function parseMockProjects(): DashboardProjectRecord[] {
  return mockBuyerDetails.flatMap((buyer) =>
    buyer.projects.map((project) => ({
      id: project.id,
      title: project.title,
      type: project.type,
      status: project.status,
      buyer: buyer.name,
      buyerId: buyer.id,
      studio: project.studio,
      productionCompanies: project.productionCompanies,
      people: project.people,
      genre: project.genre,
      country: project.countryOfOrigin,
      isInternational: project.isInternational,
      isCoProduction: project.isCoProduction,
      isAcquisition: project.isAcquisition,
      announcementDate: project.announcementDate ? new Date(project.announcementDate) : null,
      lastUpdateDate: project.lastUpdateDate ? new Date(project.lastUpdateDate) : null,
      sourceUrl: project.sourceUrl,
      needsReview: project.status === "stale"
    }))
  );
}

function parseMockShows(): DashboardShowRecord[] {
  return mockCurrentShows.map((show) => ({
    id: show.id,
    title: show.title,
    networkOrPlatform: show.networkOrPlatform,
    buyerHref: show.buyerHref,
    premiereDate: show.premiereDate ? new Date(show.premiereDate) : null,
    finaleDate: show.finaleDate ? new Date(show.finaleDate) : null,
    status: show.status,
    genre: show.genre,
    studio: show.studio,
    country: show.country,
    seasonType: show.seasonType ?? null
  }));
}

function parseMockArticles(): DashboardArticleRecord[] {
  return mockReviewArticles.map((article) => ({
    id: article.id,
    headline: article.headline,
    publication: article.publication,
    publishedDate: article.publishedDate,
    extractionStatus: article.extractionStatus,
    needsReview: article.extractionStatus === "Needs Review" || article.extractionStatus === "New"
  }));
}

function applyProjectFilters(projects: DashboardProjectRecord[], filters: DashboardFilters) {
  return projects.filter((project) => {
    if (filters.buyer && filters.buyer !== "all" && project.buyer !== filters.buyer) return false;
    if (filters.genre && filters.genre !== "all" && project.genre !== filters.genre) return false;
    if (filters.status && filters.status !== "all" && project.status !== filters.status) return false;
    if (filters.country && filters.country !== "all" && project.country !== filters.country) return false;
    if (filters.type && filters.type !== "all" && project.type !== filters.type) return false;
    if (!truthyBooleanFilter(project.isAcquisition, filters.acquisition)) return false;
    if (!truthyBooleanFilter(project.isCoProduction, filters.coProduction)) return false;
    if (!truthyBooleanFilter(project.isInternational, filters.international)) return false;
    const date = project.announcementDate ?? project.lastUpdateDate;
    if (!inDateRange(date, filters.from, filters.to)) return false;
    return true;
  });
}

function applyShowFilters(shows: DashboardShowRecord[], filters: DashboardFilters) {
  return shows.filter((show) => {
    if (filters.genre && filters.genre !== "all" && show.genre !== filters.genre) return false;
    if (filters.country && filters.country !== "all" && show.country !== filters.country) return false;
    return true;
  });
}

function applyArticleFilters(articles: DashboardArticleRecord[], filters: DashboardFilters) {
  return articles.filter((article) => inDateRange(article.publishedDate, filters.from, filters.to));
}

export async function getDashboardSnapshot(filters: DashboardFilters, referenceDate = new Date(), forceMock = false): Promise<DashboardSnapshot> {
  if (!forceMock) {
    try {
      const [projects, shows, articles] = await Promise.all([
        prisma.project.findMany({
          include: { buyer: true, studio: true, productionCompanies: true, people: true },
          orderBy: [{ announcementDate: "desc" }, { title: "asc" }]
        }),
        prisma.currentShow.findMany({ orderBy: [{ premiereDate: "asc" }, { title: "asc" }] }),
        prisma.article.findMany({ orderBy: [{ publishedDate: "desc" }, { createdAt: "desc" }] })
      ]);

      const normalizedProjects: DashboardProjectRecord[] = projects.map((project) => ({
        id: project.id,
        title: project.title,
        type: project.type,
        status: project.status,
        buyer: project.buyer?.name ?? project.networkOrPlatform ?? null,
        buyerId: project.buyerId,
        studio: project.studio?.name ?? null,
        productionCompanies: project.productionCompanies.map((company) => company.name),
        people: project.people.map((person) => person.name),
        genre: project.genre,
        country: project.countryOfOrigin,
        isInternational: project.isInternational,
        isCoProduction: project.isCoProduction,
        isAcquisition: project.isAcquisition,
        announcementDate: project.announcementDate,
        lastUpdateDate: project.lastUpdateDate,
        sourceUrl: project.sourceUrl,
        needsReview: project.needsReview
      }));

      const normalizedShows: DashboardShowRecord[] = shows.map((show) => ({
        id: show.id,
        title: show.title,
        networkOrPlatform: show.networkOrPlatform,
        buyerHref: null,
        premiereDate: show.premiereDate,
        finaleDate: show.finaleDate,
        status: show.status,
        genre: show.genre,
        studio: show.studio,
        country: show.country,
        seasonType: show.seasonType ?? null
      }));

      const normalizedArticles: DashboardArticleRecord[] = articles.map((article) => ({
        id: article.id,
        headline: article.headline,
        publication: article.publication,
        publishedDate: article.publishedDate,
        extractionStatus: article.extractionStatus,
        needsReview: article.needsReview
      }));

      const filteredProjects = applyProjectFilters(normalizedProjects, filters);
      const filteredShows = applyShowFilters(normalizedShows, filters);
      const filteredArticles = applyArticleFilters(normalizedArticles, filters);

      return {
        dataSource: "database",
        filters,
        referenceDate,
        projects: filteredProjects,
        shows: filteredShows,
        articles: filteredArticles,
        availableBuyers: Array.from(new Set(normalizedProjects.map((project) => project.buyer).filter(Boolean) as string[])).sort(),
        availableGenres: Array.from(new Set(normalizedProjects.map((project) => project.genre).filter(Boolean) as string[])).sort(),
        availableStatuses: Array.from(new Set(normalizedProjects.map((project) => project.status))).sort(),
        availableCountries: Array.from(new Set(normalizedProjects.map((project) => project.country).filter(Boolean) as string[])).sort(),
        availableTypes: Array.from(new Set(normalizedProjects.map((project) => project.type))).sort()
      };
    } catch (error) {
      if (!canUseMockPreview()) {
        return {
          dataSource: "database",
          errorMessage: mockPreviewDisabledReason() ?? (error instanceof Error ? error.message : "Unable to load dashboard data."),
          filters,
          referenceDate,
          projects: [],
          shows: [],
          articles: [],
          availableBuyers: [],
          availableGenres: [],
          availableStatuses: [],
          availableCountries: [],
          availableTypes: []
        };
      }
    }
  }

  const mockProjects = parseMockProjects();
  const mockShows = parseMockShows();
  const mockArticles = parseMockArticles();

  return {
    dataSource: "mock",
    filters,
    referenceDate,
    projects: applyProjectFilters(mockProjects, filters),
    shows: applyShowFilters(mockShows, filters),
    articles: applyArticleFilters(mockArticles, filters),
    availableBuyers: Array.from(new Set(mockProjects.map((project) => project.buyer).filter(Boolean) as string[])).sort(),
    availableGenres: Array.from(new Set(mockProjects.map((project) => project.genre).filter(Boolean) as string[])).sort(),
    availableStatuses: Array.from(new Set(mockProjects.map((project) => project.status))).sort(),
    availableCountries: Array.from(new Set(mockProjects.map((project) => project.country).filter(Boolean) as string[])).sort(),
    availableTypes: Array.from(new Set(mockProjects.map((project) => project.type))).sort()
  };
}

export function getDashboardMetrics(snapshot: DashboardSnapshot) {
  const thisYear = snapshot.referenceDate.getFullYear();
  const today = startOfDay(snapshot.referenceDate);
  const nextThirty = endOfDay(addDays(today, 30));

  const yearProjects = snapshot.projects.filter((project) => (project.announcementDate ?? project.lastUpdateDate)?.getFullYear() === thisYear);
  const currentAiring = snapshot.shows.filter((show) => show.status.toLowerCase().includes("airing")).length;
  const upcomingPremieres = snapshot.shows.filter(
    (show) => show.premiereDate && isWithinInterval(show.premiereDate, { start: today, end: nextThirty })
  ).length;

  return [
    {
      label: "Total Development Projects",
      value: snapshot.projects.length,
      href: buildDevelopmentHref(snapshot.filters)
    },
    {
      label: "Active Development Projects",
      value: snapshot.projects.filter((project) => ["sold", "in_development", "pilot_order", "series_order"].includes(project.status)).length,
      href: buildDevelopmentHref({ ...snapshot.filters, savedView: "current" })
    },
    {
      label: "Pilot Orders This Year",
      value: yearProjects.filter((project) => project.status === "pilot_order").length,
      href: buildDevelopmentHref({ ...snapshot.filters, status: "pilot_order" })
    },
    {
      label: "Series Orders This Year",
      value: yearProjects.filter((project) => project.status === "series_order").length,
      href: buildDevelopmentHref({ ...snapshot.filters, status: "series_order" })
    },
    {
      label: "Acquisitions This Year",
      value: yearProjects.filter((project) => project.isAcquisition).length,
      href: buildDevelopmentHref({ ...snapshot.filters, acquisition: "yes" })
    },
    {
      label: "International / Co-Productions This Year",
      value: yearProjects.filter((project) => project.isInternational || project.isCoProduction).length,
      href: buildDevelopmentHref({ ...snapshot.filters, international: "yes" })
    },
    {
      label: "Current Shows Airing",
      value: currentAiring,
      href: buildCurrentTvHref({ ...snapshot.filters, view: "airing" })
    },
    {
      label: "Upcoming Premieres",
      value: upcomingPremieres,
      href: buildCurrentTvHref({ ...snapshot.filters, view: "new-month" })
    },
    {
      label: "Articles Needing Review",
      value: snapshot.articles.filter((article) => article.needsReview).length,
      href: "/review?status=Needs%20Review"
    },
    {
      label: "Stale Projects",
      value: snapshot.projects.filter((project) => project.status === "stale").length,
      href: buildDevelopmentHref({ ...snapshot.filters, status: "stale" })
    }
  ];
}

export function getDashboardTrendModules(snapshot: DashboardSnapshot) {
  const today = snapshot.referenceDate;
  return {
    buyerActivityOverTime: monthsBackSeries(snapshot.projects, (project) => Boolean(project.buyer), today),
    genreActivityOverTime: monthsBackSeries(snapshot.projects, (project) => Boolean(project.genre), today),
    statusMovementOverTime: monthsBackSeries(snapshot.projects, (project) => ["sold", "pilot_order", "series_order", "renewed", "canceled"].includes(project.status), today),
    acquisitionCoProductionActivity: countByLabel(
      snapshot.projects.flatMap((project) => [
        ...(project.isAcquisition ? ["Acquisition"] : []),
        ...(project.isCoProduction ? ["Co-Production"] : [])
      ])
    ),
    internationalActivity: countByLabel(
      snapshot.projects
        .filter((project) => project.isInternational || project.isCoProduction)
        .map((project) => project.country ?? "Unknown country")
    ),
    mostActiveBuyers: countByLabel(snapshot.projects.map((project) => project.buyer ?? "Unknown buyer")).slice(0, 6),
    mostActiveStudiosProdcos: countByLabel(
      snapshot.projects.flatMap((project) => [project.studio ?? "Unknown studio", ...project.productionCompanies])
    ).slice(0, 6),
    mostAttachedTalentCreators: countByLabel(snapshot.projects.flatMap((project) => project.people)).slice(0, 6)
  };
}

export function getThisWeekSnapshot(snapshot: DashboardSnapshot) {
  const weekStart = startOfDay(subDays(snapshot.referenceDate, 6));
  const weekEnd = endOfDay(snapshot.referenceDate);
  const nextWeekStart = startOfDay(addDays(snapshot.referenceDate, 1));
  const nextWeekEnd = endOfDay(addDays(snapshot.referenceDate, 7));

  const thisWeekProjects = snapshot.projects.filter((project) => {
    const date = project.announcementDate ?? project.lastUpdateDate;
    return date ? isWithinInterval(date, { start: weekStart, end: weekEnd }) : false;
  });

  return {
    sales: thisWeekProjects.filter((project) => project.status === "sold"),
    orders: thisWeekProjects.filter((project) => project.status === "pilot_order" || project.status === "series_order"),
    majorAttachments: thisWeekProjects.filter((project) => project.people.length > 0),
    acquisitions: thisWeekProjects.filter((project) => project.isAcquisition || project.isCoProduction),
    premieresNextWeek: snapshot.shows.filter((show) => show.premiereDate && isWithinInterval(show.premiereDate, { start: nextWeekStart, end: nextWeekEnd })),
    reviewItems: snapshot.articles.filter((article) => article.needsReview).slice(0, 8)
  };
}

export function getOpportunitySignals(snapshot: DashboardSnapshot): DashboardSignal[] {
  const recentWindowStart = startOfDay(subDays(snapshot.referenceDate, 90));
  const priorWindowStart = startOfDay(subDays(snapshot.referenceDate, 180));
  const priorWindowEnd = endOfDay(subDays(snapshot.referenceDate, 91));
  const recentProjects = snapshot.projects.filter((project) => {
    const date = project.announcementDate ?? project.lastUpdateDate;
    return date ? isWithinInterval(date, { start: recentWindowStart, end: endOfDay(snapshot.referenceDate) }) : false;
  });
  const priorProjects = snapshot.projects.filter((project) => {
    const date = project.announcementDate ?? project.lastUpdateDate;
    return date ? isWithinInterval(date, { start: priorWindowStart, end: priorWindowEnd }) : false;
  });

  const signals: DashboardSignal[] = [];

  const buyerGenreCombo = Array.from(
    recentProjects.reduce((map, project) => {
      if (!project.buyer || !project.genre) return map;
      const key = `${project.buyer}|||${project.genre}`;
      const existing = map.get(key) ?? [];
      existing.push(project);
      map.set(key, existing);
      return map;
    }, new Map<string, DashboardProjectRecord[]>()).entries()
  )
    .sort((left, right) => right[1].length - left[1].length)[0];

  if (buyerGenreCombo && buyerGenreCombo[1].length >= 2) {
    const [buyer, genre] = buyerGenreCombo[0].split("|||");
    signals.push({
      title: "Buyer active in a genre",
      signal: `${buyer} has multiple ${genre} moves in the recent window. Treat this as a signal, not a mandate.`,
      support: buyerGenreCombo[1].slice(0, 3).map((project) => project.title),
      href: buildDevelopmentHref({ buyer, genre })
    });
  }

  const risingGenre = Array.from(
    new Set([...recentProjects.map((project) => project.genre).filter(Boolean), ...priorProjects.map((project) => project.genre).filter(Boolean)])
  )
    .map((genre) => {
      const recentCount = recentProjects.filter((project) => project.genre === genre).length;
      const priorCount = priorProjects.filter((project) => project.genre === genre).length;
      return { genre: genre as string, recentCount, priorCount };
    })
    .filter((item) => item.recentCount >= 2 && item.recentCount > item.priorCount)
    .sort((left, right) => (right.recentCount - right.priorCount) - (left.recentCount - left.priorCount))[0];

  if (risingGenre) {
    signals.push({
      title: "Genre with rising activity",
      signal: `${risingGenre.genre} appears more active in the last 90 days than the prior 90-day window. Treat this as directional signal only.`,
      support: recentProjects.filter((project) => project.genre === risingGenre.genre).slice(0, 3).map((project) => project.title),
      href: buildDevelopmentHref({ genre: risingGenre.genre })
    });
  }

  const staleBuyer = countByLabel(snapshot.projects.filter((project) => project.status === "stale" && project.buyer).map((project) => project.buyer as string))[0];
  if (staleBuyer && staleBuyer.count > 0) {
    signals.push({
      title: "Buyer with stale projects",
      signal: `${staleBuyer.label} has stale projects on the board that may need a refresh or disposition check.`,
      support: snapshot.projects
        .filter((project) => project.buyer === staleBuyer.label && project.status === "stale")
        .slice(0, 3)
        .map((project) => project.title),
      href: buildDevelopmentHref({ buyer: staleBuyer.label, status: "stale" })
    });
  }

  const quietBuyer = countByLabel(snapshot.projects.filter((project) => project.buyer).map((project) => project.buyer as string))
    .map((buyer) => {
      const buyerProjects = snapshot.projects.filter((project) => project.buyer === buyer.label);
      const recentPickups = recentProjects.filter(
        (project) => project.buyer === buyer.label && ["sold", "pilot_order", "series_order"].includes(project.status)
      );
      return { buyer: buyer.label, total: buyer.count, recentPickups: recentPickups.length, buyerProjects };
    })
    .filter((buyer) => buyer.total >= 2 && buyer.recentPickups === 0)[0];

  if (quietBuyer) {
    const topGenre = countByLabel(quietBuyer.buyerProjects.map((project) => project.genre ?? "Unknown"))[0];
    signals.push({
      title: "Buyer with fewer recent pickups",
      signal: `${quietBuyer.buyer} has tracked development activity but no recent sold / pilot / series-order moves in this filtered set${topGenre ? `, especially around ${topGenre.label}` : ""}.`,
      support: quietBuyer.buyerProjects.slice(0, 3).map((project) => project.title),
      href: buildDevelopmentHref({ buyer: quietBuyer.buyer })
    });
  }

  const intlLane = countByLabel(
    recentProjects
      .filter((project) => project.isInternational || project.isCoProduction)
      .map((project) => `${project.country ?? "Unknown country"} · ${project.buyer ?? "Unknown buyer"}`)
  )[0];

  if (intlLane) {
    signals.push({
      title: "International / co-production lane",
      signal: `${intlLane.label} is showing recent cross-border activity. Treat this as a live lane signal rather than a volume guarantee.`,
      support: recentProjects
        .filter((project) => `${project.country ?? "Unknown country"} · ${project.buyer ?? "Unknown buyer"}` === intlLane.label)
        .slice(0, 3)
        .map((project) => project.title),
      href: buildDevelopmentHref({ international: "yes" })
    });
  }

  return signals.slice(0, 5);
}

export function getDashboardReportInsights(snapshot: DashboardSnapshot) {
  const trends = getDashboardTrendModules(snapshot);
  const signals = getOpportunitySignals(snapshot);

  const topBuyers = trends.mostActiveBuyers
    .slice(0, 3)
    .map((item) => `- **${item.label}**: ${item.count} tracked project${item.count === 1 ? "" : "s"}`)
    .join("\n") || "- No buyer concentration yet.";

  const topStudios = trends.mostActiveStudiosProdcos
    .slice(0, 3)
    .map((item) => `- **${item.label}**: ${item.count} tracked attachment${item.count === 1 ? "" : "s"}`)
    .join("\n") || "- No studio/prodco concentration yet.";

  const signalLines = signals.length
    ? signals.map((signal) => `- **${signal.title}**: ${signal.signal} Support: ${signal.support.join(", ")}.`).join("\n")
    : "- No dashboard signals cleared the current threshold.";

  return {
    markdown: `## Dashboard Insight Signals
${signalLines}

## Dashboard Leadership Snapshot
### Most Active Buyers
${topBuyers}

### Most Active Studios / Prodcos
${topStudios}
`,
    signals
  };
}

export function getFilterSummary(filters: DashboardFilters) {
  const parts = [
    filters.from ? `from ${filters.from}` : null,
    filters.to ? `to ${filters.to}` : null,
    filters.buyer && filters.buyer !== "all" ? filters.buyer : null,
    filters.genre && filters.genre !== "all" ? filters.genre : null,
    filters.status && filters.status !== "all" ? humanize(filters.status) : null,
    filters.country && filters.country !== "all" ? filters.country : null,
    filters.type && filters.type !== "all" ? humanize(filters.type) : null,
    filters.acquisition === "yes" ? "acquisition only" : null,
    filters.coProduction === "yes" ? "co-productions only" : null,
    filters.international === "yes" ? "international only" : null
  ].filter(Boolean);

  return parts.length ? parts.join(" · ") : "All tracked records";
}
