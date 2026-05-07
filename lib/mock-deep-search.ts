/**
 * Mock data for Deep Similarity Search (Step 34).
 * Used in preview/demo mode.
 */

import type { DeepSearchResult, DeepSearchOptions, PitchCompareResult } from "@/lib/deep-search";

const MOCK_DB: DeepSearchResult[] = [
  {
    id: "mock-project-dead-letter",
    kind: "project",
    title: "Dead Letter Office",
    logline: "A disgraced US Postal Inspection Service agent investigates a string of mail-based murders in small-town Ohio, uncovering a conspiracy that reaches the highest levels of the federal government.",
    studio: "A24 Television",
    buyer: "Peacock",
    genre: "procedural crime",
    status: "pilot_order",
    isStale: false,
    isAutoCreated: true,
    needsReview: true,
    sourceUrl: "https://deadline.com/dead-letter-office",
    confidenceScore: 0.88,
    confidenceLevel: "high",
    matchScore: 0.94,
    matchReasons: ["exact_phrase_in_logline", "logline_similarity"],
    matchLabel: "Exact phrase in record",
    snippet: "…US Postal Inspection Service procedural, federal law enforcement, mail fraud investigation Ohio…",
    announcementYear: 2025,
  },
  {
    id: "mock-project-stamp",
    kind: "project",
    title: "Stamp of Approval",
    logline: "When a series of art thefts turns out to involve forged postal stamps worth millions, a forensic accountant teams with a postal inspector to dismantle a sophisticated smuggling ring.",
    studio: "Blumhouse Television",
    buyer: "FX",
    genre: "crime procedural",
    status: "in_development",
    isStale: false,
    isAutoCreated: false,
    needsReview: false,
    sourceUrl: "https://variety.com/stamp-of-approval",
    confidenceScore: 0.74,
    confidenceLevel: "medium",
    matchScore: 0.81,
    matchReasons: ["logline_similarity", "genre_theme_overlap"],
    matchLabel: "Logline similarity",
    snippet: "…postal inspector, stamps, smuggling ring, federal investigation procedural…",
    announcementYear: 2025,
  },
  {
    id: "mock-project-field-office",
    kind: "project",
    title: "Field Office",
    logline: "Inside a mid-level FBI field office, a team of agents navigates bureaucracy, personal crises, and the occasional case that turns out to be more dangerous than it first appeared.",
    studio: "Universal Television",
    buyer: "CBS",
    genre: "workplace procedural",
    status: "series_order",
    isStale: false,
    isAutoCreated: false,
    needsReview: false,
    sourceUrl: "https://thewrap.com/field-office",
    confidenceScore: 0.91,
    confidenceLevel: "high",
    matchScore: 0.72,
    matchReasons: ["conceptual_similarity", "genre_theme_overlap"],
    matchLabel: "Conceptual similarity",
    snippet: "…federal agency workplace drama, government bureaucracy, procedural investigation…",
    announcementYear: 2024,
  },
  {
    id: "mock-project-wire-transfer",
    kind: "project",
    title: "The Wire Transfer",
    logline: "A team of financial crimes investigators unravels a global wire fraud scheme that threatens to destabilize three major banks.",
    studio: "Sony Pictures Television",
    buyer: "Hulu",
    genre: "financial crime",
    status: "pilot_order",
    isStale: false,
    isAutoCreated: false,
    needsReview: false,
    sourceUrl: "https://deadline.com/wire-transfer",
    confidenceScore: 0.79,
    confidenceLevel: "high",
    matchScore: 0.68,
    matchReasons: ["conceptual_similarity"],
    matchLabel: "Conceptual similarity",
    snippet: "…financial crimes, federal investigation, wire fraud, banking, government enforcement…",
    announcementYear: 2025,
  },
  {
    id: "mock-project-northern-exchange",
    kind: "project",
    title: "Northern Exchange",
    logline: "A co-production drama set inside the postal service of a fictional Nordic country, following the lives of workers during a period of radical privatization.",
    studio: "BBC Studios",
    buyer: "BBC",
    genre: "workplace drama",
    status: "in_development",
    isStale: false,
    isAutoCreated: false,
    needsReview: false,
    sourceUrl: "https://deadline.com/northern-exchange",
    confidenceScore: 0.82,
    confidenceLevel: "high",
    matchScore: 0.65,
    matchReasons: ["conceptual_similarity", "genre_theme_overlap"],
    matchLabel: "Conceptual similarity",
    snippet: "…postal service workplace drama, government agency, co-production…",
    announcementYear: 2025,
  },
  {
    id: "mock-show-signal-house",
    kind: "current_show",
    title: "Signal House",
    logline: null,
    studio: "Bad Robot",
    buyer: "HBO",
    genre: "thriller procedural",
    status: "airing",
    isStale: false,
    isAutoCreated: false,
    needsReview: false,
    sourceUrl: "https://hbo.com/signal-house",
    confidenceScore: 0.93,
    confidenceLevel: "high",
    matchScore: 0.61,
    matchReasons: ["genre_theme_overlap"],
    matchLabel: "Genre / theme overlap",
    snippet: "…government communications agency, procedural thriller, federal employees…",
    announcementYear: 2024,
  },
  {
    id: "mock-show-mail-watch",
    kind: "current_show",
    title: "Mail Watch",
    logline: null,
    studio: "Fremantle",
    buyer: "Peacock",
    genre: "crime procedural",
    status: "airing",
    isStale: false,
    isAutoCreated: true,
    needsReview: false,
    sourceUrl: "https://peacocktv.com/mail-watch",
    confidenceScore: 0.77,
    confidenceLevel: "medium",
    matchScore: 0.85,
    matchReasons: ["exact_phrase_in_logline", "logline_similarity"],
    matchLabel: "Exact phrase in record",
    snippet: "…mail, postal, package investigation, law enforcement, crime procedural…",
    announcementYear: 2024,
  },
  {
    id: "mock-project-stale-postal",
    kind: "project",
    title: "Postmark",
    logline: "A letter carrier discovers she's been unknowingly delivering messages for a domestic terrorism cell.",
    studio: null,
    buyer: "Netflix",
    genre: "thriller",
    status: "passed",
    isStale: true,
    isAutoCreated: false,
    needsReview: false,
    sourceUrl: "https://deadline.com/postmark",
    confidenceScore: 0.55,
    confidenceLevel: "low",
    matchScore: 0.58,
    matchReasons: ["logline_similarity"],
    matchLabel: "Logline similarity",
    snippet: "…letter carrier, postal, domestic terrorism, mail delivery…",
    announcementYear: 2022,
  },
  {
    id: "mock-article-postal-1",
    kind: "article",
    title: "Peacock Orders Pilot for Postal Drama 'Dead Letter Office' From A24",
    logline: "Peacock has ordered a pilot for the postal service procedural Dead Letter Office, following a US Postal Inspection Service agent.",
    studio: null,
    buyer: "Peacock",
    genre: "crime procedural",
    status: null,
    isStale: false,
    needsReview: false,
    sourceUrl: "https://deadline.com/dead-letter-office-pilot",
    publication: "Deadline",
    publishedDate: new Date("2025-03-14"),
    confidenceScore: 0.91,
    confidenceLevel: null,
    matchScore: 0.88,
    matchReasons: ["exact_phrase_in_logline"],
    matchLabel: "Exact phrase in record",
    snippet: "…Peacock pilot postal drama, US Postal Inspection Service, A24 procedural…",
    announcementYear: 2025,
  },
  {
    id: "mock-article-postal-2",
    kind: "article",
    title: "FX Developing 'Stamp of Approval' Postal Crime Drama",
    logline: null,
    studio: null,
    buyer: "FX",
    genre: "crime",
    status: null,
    isStale: false,
    needsReview: false,
    sourceUrl: "https://variety.com/stamp-fx",
    publication: "Variety",
    publishedDate: new Date("2025-01-22"),
    confidenceScore: 0.78,
    confidenceLevel: null,
    matchScore: 0.74,
    matchReasons: ["fuzzy_keyword_match"],
    matchLabel: "Keyword match",
    snippet: "…FX postal crime procedural, mail fraud, stamp forgery…",
    announcementYear: 2025,
  },
];

function scoreQuery(query: string, result: DeepSearchResult): number {
  const q = query.toLowerCase();
  const tokens = q.split(/\W+/).filter((t) => t.length > 2);

  const text = [
    result.title,
    result.logline ?? "",
    result.genre ?? "",
    result.snippet ?? "",
    result.buyer ?? "",
    result.studio ?? "",
  ].join(" ").toLowerCase();

  let score = result.matchScore;

  if (text.includes(q)) score = Math.min(1, score + 0.15);
  for (const t of tokens) {
    if (text.includes(t)) score = Math.min(1, score + 0.03);
  }

  return Math.round(score * 100) / 100;
}

export function mockDeepSearchResults(
  query: string,
  options?: DeepSearchOptions
): DeepSearchResult[] {
  const includeStale = options?.includeStale ?? false;
  const includeProjects = options?.includeProjects ?? true;
  const includeShows = options?.includeShows ?? true;
  const includeArticles = options?.includeArticles ?? true;
  const genre = options?.genre?.toLowerCase();
  const buyer = options?.buyer?.toLowerCase();
  const yearFrom = options?.yearFrom;
  const yearTo = options?.yearTo;

  return MOCK_DB
    .filter((r) => {
      if (!includeStale && r.isStale) return false;
      if (!includeProjects && r.kind === "project") return false;
      if (!includeShows && r.kind === "current_show") return false;
      if (!includeArticles && r.kind === "article") return false;
      if (genre && !r.genre?.toLowerCase().includes(genre)) return false;
      if (buyer && !r.buyer?.toLowerCase().includes(buyer)) return false;
      if (yearFrom && r.announcementYear && r.announcementYear < yearFrom) return false;
      if (yearTo && r.announcementYear && r.announcementYear > yearTo) return false;
      return true;
    })
    .map((r) => ({ ...r, matchScore: scoreQuery(query, r) }))
    .filter((r) => r.matchScore > 0.3)
    .sort((a, b) => b.matchScore - a.matchScore)
    .slice(0, options?.maxResults ?? 50);
}

export function mockPitchCompareResult(pitch: string): PitchCompareResult {
  const similar = mockDeepSearchResults(pitch, { includeStale: true });

  return {
    dataSource: "mock",
    pitch,
    similar: similar.slice(0, 12),
    activeBuyers: [
      {
        name: "Peacock",
        activeTitles: ["Dead Letter Office", "Mail Watch"],
        activeCount: 2,
        genres: ["crime procedural", "workplace drama"],
        recentActivity: "2 active titles in similar space",
      },
      {
        name: "FX",
        activeTitles: ["Stamp of Approval"],
        activeCount: 1,
        genres: ["crime procedural"],
        recentActivity: "1 active title in similar space",
      },
      {
        name: "CBS",
        activeTitles: ["Field Office"],
        activeCount: 1,
        genres: ["workplace procedural"],
        recentActivity: "1 active title in similar space",
      },
    ],
    whiteSpaceBuyers: [
      {
        name: "Apple TV+",
        activeTitles: [],
        activeCount: 0,
        genres: [],
        recentActivity: "No recent activity in this space — potential opening",
      },
      {
        name: "Amazon MGM",
        activeTitles: [],
        activeCount: 0,
        genres: [],
        recentActivity: "No recent activity in this space — potential opening",
      },
    ],
    cautionFlags: [
      {
        severity: "high",
        message: "Very similar concept already in active development: \"Dead Letter Office\" at Peacock (pilot order)",
        relatedTitle: "Dead Letter Office",
        relatedId: "mock-project-dead-letter",
      },
      {
        severity: "medium",
        message: "3 active projects/shows overlap with this premise. Lane may be crowded.",
      },
      {
        severity: "low",
        message: "1 stale/dead project with similar premise — Netflix passed on \"Postmark\" in 2022.",
      },
    ],
    searchedAt: new Date(),
  };
}
