import { DevelopmentTable } from "@/components/tables/development-table";
import { prisma } from "@/lib/prisma";

export default async function DevelopmentPage() {
  const projects = await prisma.project.findMany({
    include: { buyer: true, studio: true, productionCompanies: true, people: true },
    orderBy: [{ announcementDate: "desc" }, { title: "asc" }]
  });

  return (
    <div className="space-y-5">
      <section className="rounded-lg border bg-white p-6 shadow-panel">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-primary">Master Grid</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">Development Tracker</h1>
        <p className="mt-3 max-w-3xl text-muted-foreground">
          Search and filter development projects by buyer, studio, genre, year, country, status, and market flags.
        </p>
      </section>
      <DevelopmentTable
        rows={projects.map((project) => ({
          id: project.id,
          title: project.title,
          type: project.type,
          status: project.status,
          logline: project.logline,
          genre: project.genre,
          format: project.format,
          buyerId: project.buyerId,
          buyer: project.buyer?.name ?? null,
          networkOrPlatform: project.networkOrPlatform,
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
          sourcePublication: project.sourcePublication,
          confidenceScore: project.confidenceScore,
          needsReview: project.needsReview,
          notes: project.notes
        }))}
      />
    </div>
  );
}
