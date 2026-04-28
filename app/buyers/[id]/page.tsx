import { notFound } from "next/navigation";
import { BuyerDetail } from "@/components/buyers/buyer-detail";
import type { BuyerDetailData } from "@/components/buyers/types";
import { mockBuyerDetails } from "@/lib/mock-buyers";
import { prisma } from "@/lib/prisma";

async function getBuyerDetail(id: string): Promise<{ buyer: BuyerDetailData | null; dataSource: "database" | "mock"; errorMessage?: string }> {
  try {
    const buyer = await prisma.buyer.findUnique({
      where: { id },
      include: {
        projects: {
          include: { studio: true, productionCompanies: true, people: true },
          orderBy: [{ announcementDate: "desc" }, { title: "asc" }]
        }
      }
    });

    if (!buyer) {
      const mockBuyer = mockBuyerDetails.find((item) => item.id === id);
      return mockBuyer ? { buyer: mockBuyer, dataSource: "mock", errorMessage: "Buyer was not found in SQLite." } : { buyer: null, dataSource: "mock" };
    }

    const currentShows = await prisma.currentShow.findMany({
      where: { networkOrPlatform: buyer.name },
      orderBy: [{ premiereDate: "asc" }, { title: "asc" }]
    });

    return {
      dataSource: "database",
      buyer: {
        id: buyer.id,
        name: buyer.name,
        type: buyer.type,
        parentCompany: buyer.parentCompany,
        notes: buyer.notes,
        projects: buyer.projects.map((project) => ({
          id: project.id,
          title: project.title,
          status: project.status,
          genre: project.genre,
          type: project.type,
          studio: project.studio?.name ?? null,
          productionCompanies: project.productionCompanies.map((company) => company.name),
          people: project.people.map((person) => person.name),
          countryOfOrigin: project.countryOfOrigin,
          isInternational: project.isInternational,
          isCoProduction: project.isCoProduction,
          isAcquisition: project.isAcquisition,
          announcementDate: project.announcementDate?.toISOString() ?? null,
          lastUpdateDate: project.lastUpdateDate?.toISOString() ?? null,
          sourceUrl: project.sourceUrl,
          notes: project.notes
        })),
        currentShows: currentShows.map((show) => ({
          id: show.id,
          title: show.title,
          networkOrPlatform: show.networkOrPlatform,
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
      }
    };
  } catch (error) {
    const mockBuyer = mockBuyerDetails.find((item) => item.id === id) ?? mockBuyerDetails[0] ?? null;
    return {
      buyer: mockBuyer,
      dataSource: "mock",
      errorMessage: error instanceof Error ? error.message : "Unknown database error."
    };
  }
}

export default async function BuyerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { buyer, dataSource, errorMessage } = await getBuyerDetail(id);

  if (!buyer) notFound();

  return <BuyerDetail buyer={buyer} dataSource={dataSource} errorMessage={errorMessage} />;
}
