import { DevelopmentTable } from "@/components/tables/development-table";
import type { DevelopmentRow } from "@/components/tables/development-table";
import { calculateProjectConfidence, joinConfidenceReasons } from "@/lib/confidence";
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
      confidenceLevel: "medium",
      confidenceReasons: "Mock preview data",
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
      ...(() => {
        const confidence = calculateProjectConfidence({
          sourceReliability: project.sourcePublication ? "medium" : "low",
          bodyAvailable: true,
          title: project.title,
          buyer: project.buyer?.name ?? project.networkOrPlatform ?? null,
          studio: project.studio?.name ?? null,
          genre: project.genre,
          status: project.status,
          country: project.countryOfOrigin,
          announcementDate: project.announcementDate,
          logline: project.logline,
          sourceUrl: project.sourceUrl,
          productionCompanies: project.productionCompanies.map((company) => company.name),
          people: project.people.map((person) => person.name),
          needsReview: project.needsReview
        });
        return {
          confidenceScore: project.confidenceScore ?? confidence.score,
          confidenceLevel: project.confidenceLevel ?? confidence.level,
          confidenceReasons: project.confidenceReasons ?? joinConfidenceReasons(confidence.reasons)
        };
      })(),
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
      needsReview: project.needsReview,
      notes: project.notes
    }));
  } catch {
    return getMockRows();
  }
}

export default async function DevelopmentPage({
  searchParams
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const params = await searchParams;
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
        canBulkEdit={auth.canEditContent || auth.adminUnlocked}
        canArchive={auth.canManageUsers || auth.adminUnlocked}
        initialFilters={{
          savedView: params.savedView,
          globalFilter: params.q,
          status: params.status,
          buyer: params.buyer,
          studio: params.studio,
          genre: params.genre,
          year: params.year,
          country: params.country,
          acquisition: params.acquisition,
          coProduction: params.coProduction,
          international: params.international,
          needsReview: params.needsReview,
          confidence: params.confidence
        }}
      />
    </div>
  );
}
