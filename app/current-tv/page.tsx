import { CurrentTvTracker, type CurrentTvRow } from "@/components/tables/current-tv-tracker";
import { mockBuyerDetails } from "@/lib/mock-buyers";
import { mockCurrentShows } from "@/lib/mock-current-tv";
import { prisma } from "@/lib/prisma";

async function getCurrentShows(): Promise<{ rows: CurrentTvRow[]; dataSource: "database" | "mock"; errorMessage?: string }> {
  try {
    const [shows, buyers] = await Promise.all([
      prisma.currentShow.findMany({
        orderBy: [{ premiereDate: "asc" }, { title: "asc" }]
      }),
      prisma.buyer.findMany({ select: { id: true, name: true } })
    ]);
    const buyerHrefByName = new Map(buyers.map((buyer) => [buyer.name, `/buyers/${buyer.id}`]));

    if (!shows.length) {
      return { rows: mockCurrentShows, dataSource: "mock", errorMessage: "SQLite returned no CurrentShow rows." };
    }

    return {
      dataSource: "database",
      rows: shows.map((show) => ({
        id: show.id,
        title: show.title,
        networkOrPlatform: show.networkOrPlatform,
        buyerHref: buyerHrefByName.get(show.networkOrPlatform) ?? null,
        premiereDate: show.premiereDate?.toISOString() ?? null,
        finaleDate: show.finaleDate?.toISOString() ?? null,
        seasonNumber: show.seasonNumber,
        episodeCount: show.episodeCount,
        status: show.status,
        genre: show.genre,
        studio: show.studio,
        productionCompanies: show.productionCompanies,
        country: show.country,
        sourceUrl: show.sourceUrl,
        notes: show.notes
      }))
    };
  } catch (error) {
    const hrefByName = new Map(mockBuyerDetails.map((buyer) => [buyer.name, `/buyers/${buyer.id}`]));
    return {
      rows: mockCurrentShows.map((show) => ({ ...show, buyerHref: show.buyerHref ?? hrefByName.get(show.networkOrPlatform) ?? null })),
      dataSource: "mock",
      errorMessage: error instanceof Error ? error.message : "Unknown database error."
    };
  }
}

export default async function CurrentTvPage() {
  const { rows, dataSource, errorMessage } = await getCurrentShows();

  return (
    <div className="space-y-5">
      <section className="rounded-lg border bg-white p-6 shadow-panel">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-primary">Airing and Upcoming</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">Current TV Tracker</h1>
        <p className="mt-3 max-w-3xl text-muted-foreground">
          Track what is airing now, what premieres soon, and where finales and returning seasons are landing.
        </p>
      </section>
      <CurrentTvTracker rows={rows} dataSource={dataSource} errorMessage={errorMessage} />
    </div>
  );
}
