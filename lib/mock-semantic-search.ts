import type { SearchResult } from "@/lib/semantic-search";

const MOCK_SEARCH_DB: SearchResult[] = [
  // Projects
  {
    id: "mock-project-harbor-lights",
    kind: "project",
    title: "Harbor Lights",
    subtitle: "Netflix · in_development",
    matchType: "exact_title",
    matchScore: 0.92,
    confidenceScore: 0.87,
    confidenceLevel: "high",
    status: "in_development",
    genre: "crime drama",
    buyer: "Netflix",
    sourceUrl: "https://deadline.com/harbor-lights",
    isAutoCreated: false,
    needsReview: false,
    snippet: "…harbor lights crime drama from A24 and wiip, netflix development slate 2026…",
  },
  {
    id: "mock-project-postal",
    kind: "project",
    title: "Dead Letter Office",
    subtitle: "Peacock · pilot_order",
    matchType: "logline_topic",
    matchScore: 0.88,
    confidenceScore: 0.84,
    confidenceLevel: "high",
    status: "pilot_order",
    genre: "procedural crime",
    buyer: "Peacock",
    sourceUrl: "https://deadline.com/dead-letter-office",
    isAutoCreated: true,
    needsReview: true,
    snippet: "…US Postal Inspection Service procedural drama, federal law enforcement, mail fraud investigation…",
  },
  {
    id: "mock-project-postal-crimes",
    kind: "project",
    title: "Stamp of Approval",
    subtitle: "FX · in_development",
    matchType: "logline_topic",
    matchScore: 0.74,
    confidenceScore: 0.68,
    confidenceLevel: "medium",
    status: "in_development",
    genre: "crime procedural",
    buyer: "FX",
    sourceUrl: "https://variety.com/stamp-of-approval",
    isAutoCreated: false,
    needsReview: false,
    snippet: "…postal crime drama, mail inspector, federal investigation procedural series…",
  },
  {
    id: "mock-project-northern-exchange",
    kind: "project",
    title: "Northern Exchange",
    subtitle: "BBC · in_development",
    matchType: "genre_theme",
    matchScore: 0.68,
    confidenceScore: 0.82,
    confidenceLevel: "high",
    status: "in_development",
    genre: "workplace drama",
    buyer: "BBC",
    sourceUrl: "https://deadline.com/northern-exchange",
    isAutoCreated: false,
    needsReview: false,
    snippet: "…workplace drama, government agency, bureaucratic procedural, co-production…",
  },
  {
    id: "mock-project-scam-series",
    kind: "project",
    title: "The Wire Transfer",
    subtitle: "Hulu · pilot_order",
    matchType: "logline_topic",
    matchScore: 0.79,
    confidenceScore: 0.76,
    confidenceLevel: "medium",
    status: "pilot_order",
    genre: "true crime limited series",
    buyer: "Hulu",
    sourceUrl: "https://variety.com/wire-transfer",
    isAutoCreated: false,
    needsReview: false,
    snippet: "…true crime limited series about financial fraud, wire transfer scams, white collar crime…",
  },
  {
    id: "mock-project-fbi-drama",
    kind: "project",
    title: "Field Office",
    subtitle: "CBS · series_order",
    matchType: "genre_theme",
    matchScore: 0.82,
    confidenceScore: 0.91,
    confidenceLevel: "high",
    status: "series_order",
    genre: "procedural drama",
    buyer: "CBS",
    sourceUrl: "https://tvinsider.com/field-office",
    isAutoCreated: false,
    needsReview: false,
    snippet: "…FBI adjacent workplace drama, federal agents, workplace procedural, investigative series…",
  },

  // Current Shows
  {
    id: "mock-show-signal-house",
    kind: "current_show",
    title: "Signal House",
    subtitle: "HBO · airing",
    matchType: "genre_theme",
    matchScore: 0.71,
    confidenceScore: 0.88,
    confidenceLevel: "high",
    status: "airing",
    genre: "crime drama",
    buyer: "HBO",
    sourceUrl: null,
    isAutoCreated: false,
    needsReview: false,
    snippet: "…signal house hbo crime drama workplace investigative series current season…",
  },
  {
    id: "mock-show-postal-watch",
    kind: "current_show",
    title: "Mail Watch",
    subtitle: "Peacock · airing",
    matchType: "exact_title",
    matchScore: 0.65,
    confidenceScore: 0.73,
    confidenceLevel: "medium",
    status: "airing",
    genre: "procedural",
    buyer: "Peacock",
    sourceUrl: null,
    isAutoCreated: true,
    needsReview: true,
    snippet: "…mail watch peacock postal service procedural drama auto-created needs review…",
  },

  // Articles
  {
    id: "mock-article-postal-1",
    kind: "article",
    title: "Peacock Developing Postal Inspection Service Drama After FBI Hit",
    subtitle: "Deadline · April 15, 2026",
    matchType: "logline_topic",
    matchScore: 0.86,
    confidenceScore: 0.81,
    confidenceLevel: null,
    status: "Needs Review",
    genre: "crime procedural",
    buyer: "Peacock",
    sourceUrl: "https://deadline.com/peacock-postal-drama",
    publication: "Deadline",
    publishedDate: new Date("2026-04-15"),
    needsReview: true,
    snippet: "…US Postal Inspection Service drama in development at Peacock, inspired by popularity of FBI-adjacent procedurals…",
  },
  {
    id: "mock-article-scam-2",
    kind: "article",
    title: "Hulu Eyes True Crime Limited Series About $2B Wire Transfer Fraud Ring",
    subtitle: "Variety · April 20, 2026",
    matchType: "logline_topic",
    matchScore: 0.77,
    confidenceScore: 0.76,
    confidenceLevel: null,
    status: "Needs Review",
    genre: "true crime",
    buyer: "Hulu",
    sourceUrl: "https://variety.com/hulu-wire-fraud",
    publication: "Variety",
    publishedDate: new Date("2026-04-20"),
    needsReview: false,
    snippet: "…true crime limited series about international wire transfer scam, white collar fraud, financial crime…",
  },
];

function tokenScore(text: string, query: string): number {
  if (!text) return 0;
  const lowerText = text.toLowerCase();
  const lowerQuery = query.toLowerCase();
  if (lowerText.includes(lowerQuery)) return 1;
  const queryWords = lowerQuery.split(/\W+/).filter((w) => w.length > 2);
  let matches = 0;
  for (const word of queryWords) {
    if (lowerText.includes(word)) matches++;
  }
  return queryWords.length > 0 ? matches / queryWords.length : 0;
}

export function mockSemanticSearchResults(query: string): SearchResult[] {
  if (!query.trim()) return [];

  return MOCK_SEARCH_DB.map((result) => {
    const titleScore = tokenScore(result.title, query) * 1.4;
    const snippetScore = tokenScore(result.snippet ?? "", query);
    const subtitleScore = tokenScore(result.subtitle, query) * 0.5;
    const adjusted = Math.min(1, (titleScore + snippetScore + subtitleScore) / 2.9) * result.matchScore;
    return { ...result, matchScore: adjusted };
  })
    .filter((r) => r.matchScore > 0.08)
    .sort((a, b) => {
      const kindOrder = { project: 0, current_show: 1, article: 2 };
      const kindDiff = kindOrder[a.kind] - kindOrder[b.kind];
      if (Math.abs(kindDiff) > 0 && Math.abs(a.matchScore - b.matchScore) < 0.15) return kindDiff;
      return b.matchScore - a.matchScore;
    })
    .slice(0, 20);
}
