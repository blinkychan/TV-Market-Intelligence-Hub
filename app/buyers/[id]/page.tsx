import { notFound } from "next/navigation";
import type { Prisma } from "@prisma/client";
import { BuyerDetail } from "@/components/buyers/buyer-detail";
import type {
  BuyerCompanySummary,
  BuyerCurrentShowSummary,
  BuyerDetailData,
  BuyerPersonSummary,
  BuyerProjectSummary,
  BuyerRelationshipSummary
} from "@/components/buyers/types";
import { mockBuyerDetails } from "@/lib/mock-buyers";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type BuyerDetailProjectPayload = Prisma.ProjectGetPayload<{
  include: {
    studio: true;
    productionCompanies: true;
    people: true;
    relationships: true;
  };
}>;

type BuyerDetailShowPayload = Prisma.CurrentShowGetPayload<Record<string, never>>;

type BuyerDetailProjectCompanyPayload = BuyerDetailProjectPayload["productionCompanies"][number];
type BuyerDetailProjectPersonPayload = BuyerDetailProjectPayload["people"][number];
type BuyerDetailRelationshipPayload = BuyerDetailProjectPayload["relationships"][number];

function toBuyerProjectSummary(project: BuyerDetailProjectPayload): BuyerProjectSummary {
  return {
    id: project.id,
    title: project.title,
    status: project.status,
    genre: project.genre,
    type: project.type,
    studio: project.studio?.name ?? null,
    productionCompanies: project.productionCompanies.map((company: BuyerDetailProjectCompanyPayload) => company.name),
    people: project.people.map((person: BuyerDetailProjectPersonPayload) => person.name),
    countryOfOrigin: project.countryOfOrigin,
    isInternational: project.isInternational,
    isCoProduction: project.isCoProduction,
    isAcquisition: project.isAcquisition,
    announcementDate: project.announcementDate?.toISOString() ?? null,
    lastUpdateDate: project.lastUpdateDate?.toISOString() ?? null,
    sourceUrl: project.sourceUrl,
    notes: project.notes
  };
}

function toBuyerCurrentShowSummary(show: BuyerDetailShowPayload): BuyerCurrentShowSummary {
  return {
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
  };
}

function toBuyerCompanySummary(project: BuyerDetailProjectPayload): BuyerCompanySummary[] {
  const summaries: BuyerCompanySummary[] = [];
  if (project.studio) {
    summaries.push({ id: project.studio.id, name: project.studio.name, type: project.studio.type });
  }
  summaries.push(
    ...project.productionCompanies.map((company: BuyerDetailProjectCompanyPayload) => ({
      id: company.id,
      name: company.name,
      type: company.type
    }))
  );
  return summaries;
}

function toBuyerPersonSummary(person: BuyerDetailProjectPersonPayload): BuyerPersonSummary {
  return {
    id: person.id,
    name: person.name,
    role: person.role
  };
}

function toBuyerRelationshipSummary(relationship: BuyerDetailRelationshipPayload): BuyerRelationshipSummary {
  return {
    id: relationship.id,
    relationshipType: relationship.relationshipType,
    buyerId: relationship.buyerId,
    companyId: relationship.companyId,
    personId: relationship.personId,
    projectId: relationship.projectId,
    sourceUrl: relationship.sourceUrl,
    date: relationship.date?.toISOString() ?? null
  };
}

async function getBuyerDetail(id: string): Promise<{ buyer: BuyerDetailData | null; dataSource: "database" | "mock"; errorMessage?: string }> {
  try {
    const buyer = await prisma.buyer.findUnique({
      where: { id },
      include: {
        projects: {
          include: { studio: true, productionCompanies: true, people: true, relationships: true },
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
        projects: buyer.projects.map((project: BuyerDetailProjectPayload) => toBuyerProjectSummary(project)),
        currentShows: currentShows.map((show: BuyerDetailShowPayload) => toBuyerCurrentShowSummary(show)),
        companies: Array.from(
          new Map(
            buyer.projects
              .flatMap((project: BuyerDetailProjectPayload) => toBuyerCompanySummary(project))
              .map((company: BuyerCompanySummary) => [company.id, company])
          ).values()
        ),
        people: Array.from(
          new Map(
            buyer.projects
              .flatMap((project: BuyerDetailProjectPayload) => project.people.map((person: BuyerDetailProjectPersonPayload) => toBuyerPersonSummary(person)))
              .map((person: BuyerPersonSummary) => [person.id, person])
          ).values()
        ),
        relationships: buyer.projects.flatMap((project: BuyerDetailProjectPayload) =>
          project.relationships.map((relationship: BuyerDetailRelationshipPayload) => toBuyerRelationshipSummary(relationship))
        )
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
