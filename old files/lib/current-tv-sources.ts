export type CurrentTvSourceRecord = {
  id: string;
  name: string;
  sourceType: string;
  url: string | null;
  category: string;
  enabled: boolean;
  sourceReliability: string | null;
  lastChecked: string | null;
  notes: string | null;
};

export const defaultCurrentTvSources: CurrentTvSourceRecord[] = [
  {
    id: "current-tv-source-abc-press",
    name: "ABC Press Calendar",
    sourceType: "network_press",
    url: "https://www.dgepress.com/abc/",
    category: "network/platform press calendar",
    enabled: true,
    sourceReliability: "high",
    lastChecked: null,
    notes: "Official ABC press listings for premiere and finale timing."
  },
  {
    id: "current-tv-source-cbs-futon",
    name: "The Futon Critic Listings",
    sourceType: "listing_reference",
    url: "http://www.thefutoncritic.com/listings/",
    category: "listing reference",
    enabled: false,
    sourceReliability: "medium",
    lastChecked: null,
    notes: "Use only where allowed and cross-check against official network announcements."
  },
  {
    id: "current-tv-source-tvline",
    name: "TVLine Premiere Date Posts",
    sourceType: "trade_roundup",
    url: "https://tvline.com/category/premiere-dates/",
    category: "premiere roundup",
    enabled: true,
    sourceReliability: "medium",
    lastChecked: null,
    notes: "Useful roundup source for tracking changes, then verify against press sites."
  },
  {
    id: "current-tv-source-netflix",
    name: "Netflix Tudum / Press",
    sourceType: "platform_press",
    url: "https://about.netflix.com/en/news",
    category: "official platform press",
    enabled: true,
    sourceReliability: "high",
    lastChecked: null,
    notes: "Official streaming release calendar and premiere updates."
  },
  {
    id: "current-tv-source-manual-csv",
    name: "Manual CSV Import",
    sourceType: "manual_csv",
    url: null,
    category: "manual import",
    enabled: true,
    sourceReliability: "high",
    lastChecked: null,
    notes: "Preferred for curated premiere slates from internal research."
  }
];

