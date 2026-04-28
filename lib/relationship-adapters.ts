import type { Prisma } from "@prisma/client";
import type { RelationshipProject } from "@/components/relationships/types";

type RelationshipProjectPayload = Prisma.ProjectGetPayload<{
  include: {
    buyer: true;
    studio: true;
    productionCompanies: true;
    people: true;
  };
}>;

type RelationshipCompanyPayload = RelationshipProjectPayload["productionCompanies"][number];
type RelationshipPersonPayload = RelationshipProjectPayload["people"][number];

export function toRelationshipProject(project: RelationshipProjectPayload): RelationshipProject {
  return {
    id: project.id,
    title: project.title,
    status: project.status,
    genre: project.genre,
    buyerId: project.buyerId,
    buyer: project.buyer?.name ?? project.networkOrPlatform ?? null,
    studioId: project.studioId,
    studio: project.studio?.name ?? null,
    productionCompanies:
      project.productionCompanies?.map((company: RelationshipCompanyPayload) => ({ id: company.id, name: company.name })) ?? [],
    people:
      project.people?.map((person: RelationshipPersonPayload) => ({ id: person.id, name: person.name, role: person.role })) ?? [],
    isAcquisition: project.isAcquisition,
    isCoProduction: project.isCoProduction,
    isInternational: project.isInternational,
    announcementDate: project.announcementDate?.toISOString() ?? null,
    sourceUrl: project.sourceUrl
  };
}
