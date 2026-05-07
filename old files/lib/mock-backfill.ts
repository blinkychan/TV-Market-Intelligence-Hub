export type BackfillJobStatus = "queued" | "running" | "completed" | "failed" | "paused";

export type BackfillKeywordSet = {
  id: string;
  label: string;
  query: string;
};

export type MockBackfillJob = {
  id: string;
  source: string;
  year: number;
  month: number;
  keywords: string | null;
  status: BackfillJobStatus;
  articlesFound: number;
  articlesSaved: number;
  duplicatesSkipped: number;
  lastError: string | null;
  createdAt: Date;
  updatedAt: Date;
  completedAt: Date | null;
};

export type MockHistoricalArticle = {
  id: string;
  source: string;
  publishedDate: string;
  headline: string;
  url: string;
  summary: string;
  category: string;
  keywords: string[];
  bodyText?: string | null;
};

export const BACKFILL_KEYWORD_SETS: BackfillKeywordSet[] = [
  { id: "tv-development", label: "TV development", query: "tv development series drama comedy project lands at" },
  { id: "pilot-order", label: "Pilot order", query: "pilot order pilot presentation broadcast pilot" },
  { id: "series-order", label: "Series order", query: "series order picked up ordered straight-to-series" },
  { id: "script-sale", label: "Script sale", query: "script sale sells to lands at package sale" },
  { id: "straight-to-series", label: "Straight-to-series", query: "straight-to-series ordered straight to series" },
  { id: "acquisition", label: "Acquisition", query: "acquisition remake rights option rights acquired" },
  { id: "international-co-production", label: "International co-production", query: "international co-production co-production format adaptation" },
  { id: "renewal-cancellation", label: "Renewal cancellation", query: "renewal cancellation canceled renewed finale ending" }
];

export const mockBackfillJobs: MockBackfillJob[] = [
  {
    id: "mock-backfill-1",
    source: "Deadline",
    year: 2024,
    month: 5,
    keywords: "script sale; series order; drama",
    status: "queued" as BackfillJobStatus,
    articlesFound: 0,
    articlesSaved: 0,
    duplicatesSkipped: 0,
    lastError: null,
    createdAt: new Date("2026-04-24T12:00:00.000Z"),
    updatedAt: new Date("2026-04-24T12:00:00.000Z"),
    completedAt: null
  },
  {
    id: "mock-backfill-2",
    source: "Variety",
    year: 2023,
    month: 11,
    keywords: "pilot order; broadcast; family drama",
    status: "queued" as BackfillJobStatus,
    articlesFound: 0,
    articlesSaved: 0,
    duplicatesSkipped: 0,
    lastError: null,
    createdAt: new Date("2026-04-24T12:05:00.000Z"),
    updatedAt: new Date("2026-04-24T12:05:00.000Z"),
    completedAt: null
  },
  {
    id: "mock-backfill-3",
    source: "The Hollywood Reporter",
    year: 2025,
    month: 2,
    keywords: "international co-production; thriller",
    status: "completed" as BackfillJobStatus,
    articlesFound: 2,
    articlesSaved: 2,
    duplicatesSkipped: 0,
    lastError: null,
    createdAt: new Date("2026-04-22T09:00:00.000Z"),
    updatedAt: new Date("2026-04-22T09:10:00.000Z"),
    completedAt: new Date("2026-04-22T09:10:00.000Z")
  }
];

export const mockHistoricalArticles: MockHistoricalArticle[] = [
  {
    id: "hist-1",
    source: "Deadline",
    publishedDate: "2024-05-04T12:00:00.000Z",
    headline: "Netflix lands Harbor District script sale from wiip and A24 Television",
    url: "https://history.example.com/deadline/harbor-district-sale",
    summary: "A coastal crime drama package lands at Netflix in an early-2024 script sale.",
    category: "Script Sale",
    keywords: ["script sale", "tv development", "drama", "lands at"]
  },
  {
    id: "hist-2",
    source: "Deadline",
    publishedDate: "2024-05-18T12:00:00.000Z",
    headline: "ABC gives The Family Ledger a pilot order from 20th Television",
    url: "https://history.example.com/deadline/family-ledger-pilot",
    summary: "A family drama project receives a pilot order at ABC.",
    category: "Pilot Order",
    keywords: ["pilot order", "broadcast", "family drama"]
  },
  {
    id: "hist-3",
    source: "Deadline",
    publishedDate: "2024-05-21T12:00:00.000Z",
    headline: "Peacock ordered straight-to-series legal dramedy Brief Season",
    url: "https://history.example.com/deadline/brief-season-series-order",
    summary: "Peacock moves ahead with a straight-to-series legal dramedy order.",
    category: "Series Order",
    keywords: ["straight-to-series", "series order", "ordered", "comedy"]
  },
  {
    id: "hist-4",
    source: "Variety",
    publishedDate: "2023-11-07T12:00:00.000Z",
    headline: "CBS lands Midcounty pilot order from showrunner Marcus Bell",
    url: "https://history.example.com/variety/midcounty-pilot",
    summary: "A broadcast procedural lands a pilot order for the 2024 cycle.",
    category: "Pilot Order",
    keywords: ["pilot order", "broadcast", "family drama", "development"]
  },
  {
    id: "hist-5",
    source: "Variety",
    publishedDate: "2023-11-14T12:00:00.000Z",
    headline: "Apple TV+ acquires remake rights to Spanish western Red Valley",
    url: "https://history.example.com/variety/red-valley-acquisition",
    summary: "Apple TV+ acquires remake rights to a Spanish western format.",
    category: "Acquisition",
    keywords: ["acquisition", "international", "rights acquired", "tv development"]
  },
  {
    id: "hist-6",
    source: "The Hollywood Reporter",
    publishedDate: "2025-02-06T12:00:00.000Z",
    headline: "BBC, Bad Wolf set Northern Exchange international co-production",
    url: "https://history.example.com/thr/northern-exchange-coproduction",
    summary: "An international thriller package firms up as a UK-Canada co-production.",
    category: "International Co-Production",
    keywords: ["international co-production", "thriller", "co-production", "development"]
  },
  {
    id: "hist-7",
    source: "The Hollywood Reporter",
    publishedDate: "2025-02-19T12:00:00.000Z",
    headline: "Fremantle backs Port of Call as international mystery series",
    url: "https://history.example.com/thr/port-of-call-fremantle",
    summary: "Fremantle backs an international mystery series set across major shipping ports.",
    category: "International Development",
    keywords: ["international co-production", "thriller", "development", "series"]
  },
  {
    id: "hist-8",
    source: "TVLine",
    publishedDate: "2024-09-03T12:00:00.000Z",
    headline: "FX comedy Open Tabs canceled after one season",
    url: "https://history.example.com/tvline/open-tabs-cancellation",
    summary: "Trade brief tracking the cancellation of comedy Open Tabs.",
    category: "Cancellation",
    keywords: ["renewal cancellation", "cancellation", "comedy"]
  }
];
