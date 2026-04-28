export type MockFeed = {
  id: string;
  publicationName: string;
  feedUrl: string;
  category: string;
  enabled: boolean;
  lastChecked: Date | null;
};

export type MockIngestionRun = {
  id: string;
  sourceType: string;
  sourceName: string | null;
  status: string;
  itemsFetched: number;
  itemsSaved: number;
  itemsSkipped: number;
  startedAt: Date;
  completedAt: Date | null;
  notes: string | null;
};

export const mockFeeds: MockFeed[] = [
  { id: "mock-feed-1", publicationName: "Deadline", feedUrl: "https://deadline.com/feed/", category: "Trades", enabled: true, lastChecked: new Date("2026-04-27T12:00:00.000Z") },
  { id: "mock-feed-2", publicationName: "Variety", feedUrl: "https://variety.com/feed/", category: "Trades", enabled: true, lastChecked: new Date("2026-04-27T12:00:00.000Z") },
  { id: "mock-feed-3", publicationName: "The Hollywood Reporter", feedUrl: "https://www.hollywoodreporter.com/feed/", category: "Trades", enabled: true, lastChecked: new Date("2026-04-26T12:00:00.000Z") },
  { id: "mock-feed-4", publicationName: "TheWrap", feedUrl: "https://www.thewrap.com/feed/", category: "Trades", enabled: false, lastChecked: new Date("2026-04-24T12:00:00.000Z") },
  { id: "mock-feed-5", publicationName: "TVLine", feedUrl: "https://tvline.com/feed/", category: "Trades", enabled: true, lastChecked: new Date("2026-04-25T12:00:00.000Z") },
  { id: "mock-feed-6", publicationName: "ABC Press", feedUrl: "https://feeds.mock/abc/press", category: "Network Press", enabled: false, lastChecked: new Date("2026-04-22T12:00:00.000Z") },
  { id: "mock-feed-7", publicationName: "NBCUniversal Press", feedUrl: "https://feeds.mock/nbcu/press", category: "Network Press", enabled: false, lastChecked: new Date("2026-04-20T12:00:00.000Z") },
  { id: "mock-feed-8", publicationName: "BBC Press Office", feedUrl: "https://feeds.mock/bbc/press", category: "Network Press", enabled: false, lastChecked: new Date("2026-04-21T12:00:00.000Z") }
];

export const mockIngestionRuns: MockIngestionRun[] = [
  {
    id: "mock-run-1",
    sourceType: "rss_placeholder",
    sourceName: "Deadline",
    status: "completed",
    itemsFetched: 16,
    itemsSaved: 5,
    itemsSkipped: 11,
    startedAt: new Date("2026-04-27T15:00:00.000Z"),
    completedAt: new Date("2026-04-27T15:06:00.000Z"),
    notes: "Mock feed check for preview mode."
  },
  {
    id: "mock-run-2",
    sourceType: "manual_url",
    sourceName: "Manual Article Entry",
    status: "queued",
    itemsFetched: 1,
    itemsSaved: 1,
    itemsSkipped: 0,
    startedAt: new Date("2026-04-26T18:00:00.000Z"),
    completedAt: new Date("2026-04-26T18:01:00.000Z"),
    notes: "Mock editor-submitted URL waiting for review."
  },
  {
    id: "mock-run-3",
    sourceType: "backfill",
    sourceName: "International drama scan",
    status: "queued",
    itemsFetched: 0,
    itemsSaved: 0,
    itemsSkipped: 0,
    startedAt: new Date("2026-04-23T12:00:00.000Z"),
    completedAt: null,
    notes: "Queued preview-only backfill search."
  }
];
