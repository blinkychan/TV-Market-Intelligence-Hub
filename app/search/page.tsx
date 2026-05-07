import type { Metadata } from "next";
import MarketSearch from "@/components/search/market-search";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Market Search – TV Market Intelligence Hub",
  description: "Search for concepts, loglines, premises, and topics across development projects, current shows, and source articles.",
};

export default function MarketSearchPage() {
  return <MarketSearch />;
}
