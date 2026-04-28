import type { RelationshipProject } from "@/components/relationships/types";

export function toRelationshipProject(project: any): RelationshipProject {
  return {
    id: project.id,
    title: project.title,
    status: project.status,
    genre: project.genre,
    buyerId: project.buyerId,
    buyer: project.buyer?.name ?? project.networkOrPlatform ?? null,
    studioId: project.studioId,
    studio: project.studio?.name ?? null,
    productionCompanies: project.productionCompanies?.map((company: any) => ({ id: company.id, name: company.name })) ?? [],
    people: project.people?.map((person: any) => ({ id: person.id, name: person.name, role: person.role })) ?? [],
    isAcquisition: project.isAcquisition,
    isCoProduction: project.isCoProduction,
    isInternational: project.isInternational,
    announcementDate: project.announcementDate?.toISOString() ?? null,
    sourceUrl: project.sourceUrl
  };
}
