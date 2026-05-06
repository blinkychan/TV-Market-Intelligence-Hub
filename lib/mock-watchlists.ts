import type { AlertRecord, WatchlistRecord } from "@/lib/watchlists";

const now = new Date("2026-05-06T15:00:00.000Z");

export const mockWatchlists: WatchlistRecord[] = [
  {
    id: "mock-watchlist-netflix-comedy",
    name: "Netflix Comedy Push",
    description: "Track streamer comedy activity and fresh sales.",
    watchType: "buyer",
    criteriaJson: { pageType: "development_tracker", filters: { buyer: "Netflix", genre: "Comedy" }, query: "Netflix comedy" },
    visibility: "team",
    createdByUserId: "preview-admin",
    createdByEmail: "preview@example.com",
    createdAt: now,
    updatedAt: now
  },
  {
    id: "mock-watchlist-international",
    name: "International Co-Pro Lane",
    description: "Surface new international and co-production activity.",
    watchType: "keyword",
    criteriaJson: { terms: ["co-production", "international", "format"], pageType: "review" },
    visibility: "private",
    createdByUserId: "preview-analyst",
    createdByEmail: "analyst@example.com",
    createdAt: now,
    updatedAt: now
  }
];

export const mockAlerts: AlertRecord[] = [
  {
    id: "mock-alert-harbor-lights",
    watchlistId: "mock-watchlist-netflix-comedy",
    entityType: "Project",
    entityId: "mock-project-harbor-lights",
    alertType: "new_match",
    title: "Netflix Comedy Push matched Harbor Lights",
    message: "Harbor Lights matched the Netflix Comedy Push watchlist.",
    severity: "medium",
    isRead: false,
    createdAt: now,
    watchlist: {
      id: "mock-watchlist-netflix-comedy",
      name: "Netflix Comedy Push",
      visibility: "team",
      createdByEmail: "preview@example.com"
    }
  },
  {
    id: "mock-alert-red-valley",
    watchlistId: "mock-watchlist-international",
    entityType: "Article",
    entityId: "mock-article-red-valley",
    alertType: "low_confidence",
    title: "Red Valley is low confidence",
    message: "Red Valley is flagged as low confidence and may need quick review.",
    severity: "high",
    isRead: false,
    createdAt: now,
    watchlist: {
      id: "mock-watchlist-international",
      name: "International Co-Pro Lane",
      visibility: "private",
      createdByEmail: "analyst@example.com"
    }
  }
];
