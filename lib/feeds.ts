export const FEEDS = [
  { name: "Deadline", url: "https://deadline.com/feed/", category: "Trades" },
  { name: "Variety", url: "https://variety.com/feed/", category: "Trades" },
  { name: "The Hollywood Reporter", url: "https://www.hollywoodreporter.com/feed/", category: "Trades" },
  { name: "TheWrap", url: "https://www.thewrap.com/feed/", category: "Trades" },
  { name: "TVLine", url: "https://tvline.com/feed/", category: "Trades" }
] as const;

export type FeedConfig = (typeof FEEDS)[number];
