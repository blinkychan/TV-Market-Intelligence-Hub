import { BuyerList } from "@/components/buyers/buyer-list";
import type { BuyerListItem } from "@/components/buyers/types";
import { mockBuyerList } from "@/lib/mock-buyers";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

async function getBuyers(): Promise<{ buyers: BuyerListItem[]; dataSource: "database" | "mock"; errorMessage?: string }> {
  try {
    const [buyers, currentShows] = await Promise.all([
      prisma.buyer.findMany({
        include: {
          projects: true
        },
        orderBy: { name: "asc" }
      }),
      prisma.currentShow.findMany()
    ]);

    if (!buyers.length) {
      return { buyers: mockBuyerList, dataSource: "mock", errorMessage: "SQLite returned no Buyer rows." };
    }

    return {
      dataSource: "database",
      buyers: buyers.map((buyer) => {
        const currentShowCount = currentShows.filter((show) => show.networkOrPlatform === buyer.name).length;
        return {
          id: buyer.id,
          name: buyer.name,
          type: buyer.type,
          parentCompany: buyer.parentCompany,
          notes: buyer.notes,
          projectCount: buyer.projects.length,
          currentShowCount,
          acquisitionCount: buyer.projects.filter((project) => project.isAcquisition).length,
          internationalCount: buyer.projects.filter((project) => project.isInternational || project.isCoProduction).length,
          staleCount: buyer.projects.filter((project) => project.status === "stale").length
        };
      })
    };
  } catch (error) {
    return {
      buyers: mockBuyerList,
      dataSource: "mock",
      errorMessage: error instanceof Error ? error.message : "Unknown database error."
    };
  }
}

export default async function BuyersPage() {
  const { buyers, dataSource, errorMessage } = await getBuyers();

  return (
    <div className="space-y-6">
      <section className="rounded-lg border bg-white p-6 shadow-panel">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-primary">Buyer Intelligence</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">Buyers</h1>
        <p className="mt-3 max-w-3xl text-muted-foreground">
          Compare buyer activity across development, current programming, acquisitions, co-productions, and relationships.
        </p>
      </section>
      <BuyerList buyers={buyers} dataSource={dataSource} errorMessage={errorMessage} />
    </div>
  );
}
