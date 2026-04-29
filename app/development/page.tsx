import { DevelopmentTable } from "@/components/tables/development-table";
import type { DevelopmentRow } from "@/components/tables/development-table";
import { mockBuyerDetails } from "@/lib/mock-buyers";
import { prisma } from "@/lib/prisma";
import { getSavedViewsForPage } from "@/lib/saved-views";
import { getCurrentUserContext } from "@/lib/team-auth";

export const dynamic = "force-dynamic";

function getMockRows(): DevelopmentRow[] {
  return mockBuyerDetails.flatMap((buyer) =>
    buyer.projects.map((project) => ({
      id: project.id,
      title: project.title,
      type: project.type,
      status: project.status,
      logline: null,
      genre: project.genre,
      format: null,
      buyerId: buyer.id,
      buyer: buyer.name,
      networkOrPlatform: buyer.name,
      studio: project.studio,
      productionCompanies: project.productionCompanies,
      people: project.people,
      countryOfOrigin: project.countryOfOrigin,
      isInternational: project.isInternational,
      isCoProduction: project.isCoProduction,
      isAcquisition: project.isAcquisition,
      announcementDate: project.announcementDate,
      lastUpdateDate: project.lastUpdateDate,
      sourceUrl: project.sourceUrl,
      sourcePublication: null,
      confidenceScore: 0.75,
      needsReview: project.status === "stale",
      notes: project.notes
    }))
  );
}

async function getDevelopmentRows(): Promise<DevelopmentRow[]> {
  try {
    const projects = await prisma.project.findMany({
      include: { buyer: true, studio: true, productionCompanies: true, people: true },
      orderBy: [{ announcementDate: "desc" }, { title: "asc" }]
    });

    return projects.map((project) => ({
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
    }));
  } catch {
    return getMockRows();
  }
}

export default async function DevelopmentPage() {
  const rows = await getDevelopmentRows();
  const auth = await getCurrentUserContext();
  const savedViews = await getSavedViewsForPage("development_tracker").catch(() => []);

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
        rows={rows}
        savedViewsData={savedViews}
        currentUserEmail={auth.user?.email ?? null}
        canCreateTeamView={auth.canEditContent || auth.adminUnlocked}
        canManageAllSavedViews={auth.canManageUsers || auth.adminUnlocked}
        canWriteSavedViews
      />
    </div>
  );
}
