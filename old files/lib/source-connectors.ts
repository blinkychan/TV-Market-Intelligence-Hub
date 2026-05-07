import type { SourceCoverageType } from "@prisma/client";

export type SourceConnector = {
  name: string;
  sourceType: SourceCoverageType;
  baseUrl: string;
  rssUrls: string[];
  enabled: boolean;
  reliabilityScore: number;
  allowedCategories: string[];
  blockedKeywords: string[];
  preferredKeywords: string[];
  notes: string;
};

export const SOURCE_CONNECTORS: SourceConnector[] = [
  {
    name: "Deadline",
    sourceType: "trade",
    baseUrl: "https://deadline.com",
    rssUrls: ["https://deadline.com/feed/"],
    enabled: true,
    reliabilityScore: 0.94,
    allowedCategories: ["development_sale", "pilot_order", "series_order", "casting", "acquisition", "current_tv"],
    blockedKeywords: ["box office", "movie review", "trailer", "fashion", "music video", "sports"],
    preferredKeywords: ["series", "pilot", "development", "lands at", "sells to", "ordered", "cast", "straight-to-series"],
    notes: "High-signal trade feed. Good for development and buyer activity."
  },
  {
    name: "Variety",
    sourceType: "trade",
    baseUrl: "https://variety.com",
    rssUrls: ["https://variety.com/feed/"],
    enabled: true,
    reliabilityScore: 0.93,
    allowedCategories: ["development_sale", "pilot_order", "series_order", "acquisition", "casting", "premiere_date", "current_tv"],
    blockedKeywords: ["box office", "film review", "album", "festival style", "gaming"],
    preferredKeywords: ["series", "pilot", "renewal", "cancellation", "premiere", "streamer", "network", "ordered"],
    notes: "Broad trade feed. Needs stronger relevance scoring because it carries more non-TV entertainment noise."
  },
  {
    name: "The Hollywood Reporter",
    sourceType: "trade",
    baseUrl: "https://www.hollywoodreporter.com",
    rssUrls: ["https://www.hollywoodreporter.com/feed/"],
    enabled: true,
    reliabilityScore: 0.92,
    allowedCategories: ["development_sale", "pilot_order", "series_order", "international", "co_production", "casting"],
    blockedKeywords: ["red carpet", "box office", "movie review", "music"],
    preferredKeywords: ["series", "pilot", "co-production", "international", "showrunner", "cast", "ordered"],
    notes: "Strong source for premium TV projects and international packaging."
  },
  {
    name: "TheWrap",
    sourceType: "trade",
    baseUrl: "https://www.thewrap.com",
    rssUrls: ["https://www.thewrap.com/feed/"],
    enabled: true,
    reliabilityScore: 0.82,
    allowedCategories: ["development_sale", "series_order", "renewal", "cancellation", "premiere_date"],
    blockedKeywords: ["box office", "film review", "awards fashion", "music"],
    preferredKeywords: ["series", "ordered", "premiere", "renewed", "canceled", "cast"],
    notes: "Useful secondary trade. More noise than Deadline/Variety, so blocked-keyword tuning matters."
  },
  {
    name: "TVLine",
    sourceType: "trade",
    baseUrl: "https://tvline.com",
    rssUrls: ["https://tvline.com/feed/"],
    enabled: true,
    reliabilityScore: 0.86,
    allowedCategories: ["premiere_date", "current_tv", "renewal", "cancellation", "casting"],
    blockedKeywords: ["recap", "spoilers", "ratings recap", "episode review"],
    preferredKeywords: ["premiere date", "returning", "finale", "renewed", "canceled", "cast"],
    notes: "Very useful for premiere calendar and current TV status tracking."
  },
  {
    name: "Futon Critic",
    sourceType: "calendar",
    baseUrl: "http://www.thefutoncritic.com",
    rssUrls: [],
    enabled: false,
    reliabilityScore: 0.8,
    allowedCategories: ["premiere_date", "current_tv"],
    blockedKeywords: ["ratings", "daily listings"],
    preferredKeywords: ["premiere", "schedule", "returning", "special"],
    notes: "Reference source only if terms allow it; avoid aggressive fetching."
  },
  {
    name: "Official Network/Platform Press Sites",
    sourceType: "official_press",
    baseUrl: "https://www.disneyabcpress.com",
    rssUrls: [
      "https://feeds.example.com/abc/press",
      "https://feeds.example.com/nbcu/press",
      "https://feeds.example.com/bbc/press"
    ],
    enabled: false,
    reliabilityScore: 0.96,
    allowedCategories: ["premiere_date", "current_tv", "series_order", "renewal"],
    blockedKeywords: ["corporate earnings", "ad sales", "executive appointment"],
    preferredKeywords: ["premiere", "returning", "special", "schedule", "ordered", "renewed"],
    notes: "Best for premiere verification and official order dates."
  },
  {
    name: "Manual / Imported Sources",
    sourceType: "manual_csv",
    baseUrl: "local",
    rssUrls: [],
    enabled: true,
    reliabilityScore: 0.88,
    allowedCategories: ["development_sale", "pilot_order", "series_order", "acquisition", "current_tv", "premiere_date"],
    blockedKeywords: [],
    preferredKeywords: [],
    notes: "Human-curated imports and manual URL intake."
  }
];

export function getSourceConnector(name: string) {
  const normalized = name.trim().toLowerCase();
  return SOURCE_CONNECTORS.find((source) => source.name.toLowerCase() === normalized) ?? null;
}
