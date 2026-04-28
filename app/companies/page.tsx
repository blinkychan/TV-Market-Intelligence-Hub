import { RelationshipIndex } from "@/components/relationships/relationship-index";
import type { RelationshipIndexData } from "@/components/relationships/types";
import { mockRelationshipIndex } from "@/lib/mock-relationships";
import { prisma } from "@/lib/prisma";

async function getRelationshipData(): Promise<{ data: RelationshipIndexData; dataSource: "database" | "mock"; errorMessage?: string }> {
  try {
    const [companies, people, projects, buyers] = await Promise.all([
      prisma.company.findMany({
        include: {
          studioProjects: { include: { buyer: true, studio: true, productionCompanies: true, people: true } },
          productionProjects: { include: { buyer: true, studio: true, productionCompanies: true, people: true } }
        },
        orderBy: { name: "asc" }
      }),
      prisma.person.findMany({ include: { projects: { include: { buyer: true, studio: true, productionCompanies: true, people: true } } }, orderBy: { name: "asc" } }),
      prisma.project.findMany({ include: { buyer: true, studio: true, productionCompanies: true, people: true } }),
      prisma.buyer.findMany()
    ]);
    if (!companies.length && !people.length) return { data: mockRelationshipIndex, dataSource: "mock", errorMessage: "SQLite returned no company or person rows." };
    const nodes = [
      ...buyers.map((buyer) => ({ id: buyer.id, label: buyer.name, type: "buyer" as const, href: `/buyers/${buyer.id}` })),
      ...companies.map((company) => ({ id: company.id, label: company.name, type: "company" as const, href: `/companies/${company.id}` })),
      ...people.map((person) => ({ id: person.id, label: person.name, type: "person" as const, href: `/talent/${person.id}` })),
      ...projects.map((project) => ({ id: project.id, label: project.title, type: "project" as const, href: `/projects/${project.id}` }))
    ];
    const edges = projects.flatMap((project) => {
      const year = project.announcementDate?.getFullYear().toString();
      return [
        project.buyerId ? { from: project.buyerId, to: project.id, projectId: project.id, projectStatus: project.status, year } : null,
        project.studioId ? { from: project.studioId, to: project.id, projectId: project.id, projectStatus: project.status, year } : null,
        ...project.productionCompanies.map((company) => ({ from: company.id, to: project.id, projectId: project.id, projectStatus: project.status, year })),
        ...project.people.map((person) => ({ from: person.id, to: project.id, projectId: project.id, projectStatus: project.status, year }))
      ].filter(Boolean) as RelationshipIndexData["edges"];
    });
    return {
      dataSource: "database",
      data: {
        companies: companies.map((company) => {
          const companyProjects = [...company.studioProjects, ...company.productionProjects];
          return {
            id: company.id,
            name: company.name,
            type: company.type,
            projectCount: companyProjects.length,
            connectedBuyers: Array.from(new Set(companyProjects.map((project) => project.buyer?.name).filter(Boolean) as string[])),
            connectedPeople: Array.from(new Set(companyProjects.flatMap((project) => project.people.map((person) => person.name))))
          };
        }),
        people: people.map((person) => ({
          id: person.id,
          name: person.name,
          role: person.role,
          company: person.company,
          reps: person.reps,
          projectCount: person.projects.length,
          connectedBuyers: Array.from(new Set(person.projects.map((project) => project.buyer?.name).filter(Boolean) as string[])),
          connectedCompanies: Array.from(new Set(person.projects.flatMap((project) => [project.studio?.name, ...project.productionCompanies.map((company) => company.name)]).filter(Boolean) as string[]))
        })),
        nodes,
        edges
      }
    };
  } catch (error) {
    return { data: mockRelationshipIndex, dataSource: "mock", errorMessage: error instanceof Error ? error.message : "Unknown database error." };
  }
}

export default async function CompaniesPage() {
  const { data, dataSource, errorMessage } = await getRelationshipData();
  return (
    <div className="space-y-6">
      <section className="rounded-lg border bg-white p-6 shadow-panel">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-primary">Relationship Tracker</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">Companies & Talent</h1>
        <p className="mt-3 max-w-3xl text-muted-foreground">Explore how buyers, studios, production companies, people, and projects connect.</p>
      </section>
      <RelationshipIndex data={data} dataSource={dataSource} errorMessage={errorMessage} />
    </div>
  );
}
