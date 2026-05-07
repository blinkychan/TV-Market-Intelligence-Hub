import { DevelopmentTable } from "@/components/tables/development-table";
import type { DevelopmentRow } from "@/components/tables/development-table";
import { PageIntro } from "@/components/layout/page-intro";
import { calculateProjectConfidence, joinConfidenceReasons } from "@/lib/confidence";
import { recordUsageEvent } from "@/lib/feedback";
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

async function getDevelopmentRows(): Promise<{ rows: DevelopmentRow[]; dataSource: "database" | "mock" }> {
  try {
    const projects = await prisma.project.findMany({
      include: { buyer: true, studio: true, productionCompanies: true, people: true },
      orderBy: [{ announcementDate: "desc" }, { title: "asc" }]
    });

    return {
      dataSource: "database",
      rows: projects.map((project) => ({
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
      }))
    };
  } catch {
    return { rows: getMockRows(), dataSource: "mock" };
  }
}

export default async function DevelopmentPage({
  searchParams
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const params = await searchParams;
  const { rows, dataSource } = await getDevelopmentRows();
  const auth = await getCurrentUserContext();
  const savedViews = await getSavedViewsForPage("development_tracker").catch(() => []);

  if (params.savedView || params.status || params.buyer || params.genre || params.confidence) {
    await recordUsageEvent({
      userId: auth.user?.id ?? null,
      email: auth.user?.email ?? null,
      eventType: params.savedView ? "saved_view_used" : "filter_used",
      page: "/development",
      value: params.savedView ?? JSON.stringify(params)
    });
  }

  return (
    <div className="space-y-5">
      <PageIntro
        eyebrow="Development"
        title="Development Tracker"
        description="Search and filter development projects by buyer, studio, genre, year, country, status, and market flags."
        helperText="Use saved views for recurring team lenses. Low-confidence or stale projects are worth checking first before they make it into summaries."
        dataSource={dataSource}
      />
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
