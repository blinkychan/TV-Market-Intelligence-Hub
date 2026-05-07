import type { Metadata } from "next";
import { Search } from "lucide-react";
import { MarketSearch } from "@/components/search/market-search";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Market Search – TV Market Intelligence Hub",
  description: "Search projects, shows, and articles by concept, logline, topic, buyer, or genre.",
};

export default function MarketSearchPage() {
  return (
    <div className="space-y-6">
      {/* Page header */}
      <section className="rounded-lg border bg-white p-6 shadow-panel">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-primary">Intelligence</p>
        <h1 className="mt-2 flex items-center gap-3 text-3xl font-semibold tracking-tight">
          <Search className="h-7 w-7 text-sky-600" />
          Market Search
        </h1>
        <p className="mt-3 max-w-3xl text-muted-foreground">
          Search across all tracked projects, current shows, and source articles by concept, logline,
          topic, buyer, genre, or any free-form text — not just exact titles. Results are ranked by
          relevance and grouped by type.
        </p>
        <div className="mt-4 flex flex-wrap gap-3 text-xs text-muted-foreground">
          <span className="rounded-full bg-sky-50 px-3 py-1 text-sky-700">Projects in development</span>
          <span className="rounded-full bg-emerald-50 px-3 py-1 text-emerald-700">Current shows</span>
          <span className="rounded-full bg-slate-100 px-3 py-1 text-slate-700">Source articles</span>
          <span className="rounded-full bg-amber-50 px-3 py-1 text-amber-700">Auto-created records flagged</span>
        </div>
      </section>

      {/* Search component */}
      <MarketSearch />
    </div>
  );
}
