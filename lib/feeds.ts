import { SOURCE_CONNECTORS } from "@/lib/source-connectors";

export type FeedConfig = {
  name: string;
  url: string;
  category: string;
};

export const FEEDS: FeedConfig[] = SOURCE_CONNECTORS.flatMap((source) =>
  source.rssUrls.map((url) => ({
    name: source.name,
    url,
    category: source.sourceType === "trade" ? "Trades" : source.sourceType === "official_press" ? "Official Press" : "Calendar"
  }))
);
