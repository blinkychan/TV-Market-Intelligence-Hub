import { CurrentTvTracker, type CurrentTvRow } from "@/components/tables/current-tv-tracker";
import { PageIntro } from "@/components/layout/page-intro";
import { mockAuditLogs } from "@/lib/mock-audit";
import { defaultCurrentTvSources, type CurrentTvSourceRecord } from "@/lib/current-tv-sources";
import { mockBuyerDetails } from "@/lib/mock-buyers";
import { mockCurrentShows } from "@/lib/mock-current-tv";
import { calculateCurrentShowConfidence, joinConfidenceReasons } from "@/lib/confidence";
import { recordUsageEvent } from "@/lib/feedback";
import { prisma } from "@/lib/prisma";
import { getSavedViewsForPage } from "@/lib/saved-views";
import { getCurrentUserContext } from "@/lib/team-auth";

export const dynamic = "force-dynamic";

async function getCurrentShows(): Promise<{ rows: CurrentTvRow[]; sources: CurrentTvSourceRecord[]; dataSource: "database" | "mock"; errorMessage?: string }> {
  try {
    const [shows, buyers, sources, auditLogs, allNotes] = await Promise.all([
      prisma.currentShow.findMany({
        orderBy: [{ premiereDate: "asc" }, { title: "asc" }]
      }),
      prisma.buyer.findMany({ select: { id: true, name: true } }),
      prisma.currentTvSource.findMany({ orderBy: [{ enabled: "desc" }, { name: "asc" }] }),
      prisma.auditLog.findMany({
        where: { entityType: "CurrentShow" },
        orderBy: { createdAt: "desc" }
      }),
      prisma.teamNote.findMany({
        where: { entityType: "CurrentShow" },
        orderBy: { updatedAt: "desc" }
      })
    ]);
    const buyerHrefByName = new Map(buyers.map((buyer: { id: string; name: string }) => [buyer.name, `/buyers/${buyer.id}`]));
    const auditByShowId = new Map<string, typeof auditLogs>();
    const notesByShowId = new Map<string, typeof allNotes>();
    for (const log of auditLogs) {
      const existing = auditByShowId.get(log.entityId) ?? [];
      existing.push(log);
      auditByShowId.set(log.entityId, existing);
    }
    for (const note of allNotes) {
      const existing = notesByShowId.get(note.entityId) ?? [];
      existing.push(note);
      notesByShowId.set(note.entityId, existing);
    }

    if (!shows.length) {
      return { rows: mockCurrentShows, sources: defaultCurrentTvSources, dataSource: "mock", errorMessage: "SQLite returned no CurrentShow rows." };
    }

    return {
      dataSource: "database",
      sources: sources.map((source: typeof sources[number]) => ({
        id: source.id,
        name: source.name,
        sourceType: source.sourceType,
        url: source.url,
        category: source.category,
        enabled: source.enabled,
        sourceReliability: source.sourceReliability,
        lastChecked: source.lastChecked?.toISOString() ?? null,
        notes: source.notes
      })),
      rows: shows.map((show: typeof shows[number]) => ({
        ...(() => {
          const confidence = calculateCurrentShowConfidence({
            sourceReliability: show.sourceReliability,
            title: show.title,
            networkOrPlatform: show.networkOrPlatform,
            premiereDate: show.premiereDate,
            finaleDate: show.finaleDate,
            studio: show.studio,
            productionCompanies: show.productionCompanies,
            genre: show.genre,
            country: show.country,
            sourceUrl: show.sourceUrl,
            verifiedAt: show.verifiedAt,
            needsVerification: show.needsVerification,
            notes: show.notes
          });
          return {
            confidenceScore: show.confidenceScore ?? confidence.score,
            confidenceLevel: show.confidenceLevel ?? confidence.level,
            confidenceReasons: show.confidenceReasons ?? joinConfidenceReasons(confidence.reasons)
          };
        })(),
        id: show.id,
        title: show.title,
        networkOrPlatform: show.networkOrPlatform,
        buyerHref: buyerHrefByName.get(show.networkOrPlatform) ?? null,
        premiereDate: show.premiereDate?.toISOString() ?? null,
        finaleDate: show.finaleDate?.toISOString() ?? null,
        seasonNumber: show.seasonNumber,
        episodeCount: show.episodeCount,
        status: show.status,
        genre: show.genre,
        studio: show.studio,
        productionCompanies: show.productionCompanies,
        country: show.country,
        sourceType: show.sourceType,
        sourceReliability: show.sourceReliability,
        seasonType: show.seasonType,
        premiereTime: show.premiereTime,
        episodeTitle: show.episodeTitle,
        episodeNumber: show.episodeNumber,
        airPattern: show.airPattern,
        verifiedAt: show.verifiedAt?.toISOString() ?? null,
        needsVerification: show.needsVerification,
        sourceUrl: show.sourceUrl,
        notes: show.notes,
        auditHistory: auditByShowId.get(show.id) ?? [],
        teamNotes: notesByShowId.get(show.id) ?? []
      }))
    };
  } catch (error) {
    const hrefByName = new Map(mockBuyerDetails.map((buyer) => [buyer.name, `/buyers/${buyer.id}`]));
    return {
      rows: mockCurrentShows.map((show) => ({
        ...show,
        buyerHref: show.buyerHref ?? hrefByName.get(show.networkOrPlatform) ?? null,
        auditHistory: mockAuditLogs.filter((log) => log.entityType === "CurrentShow" && log.entityId === show.id),
        teamNotes: []
      })),
      sources: defaultCurrentTvSources,
      dataSource: "mock",
      errorMessage: error instanceof Error ? error.message : "Unknown database error."
    };
  }
}

export default async function CurrentTvPage({
  searchParams
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const params = await searchParams;
  const { rows, sources, dataSource, errorMessage } = await getCurrentShows();
  const auth = await getCurrentUserContext();
  const savedViews = await getSavedViewsForPage("current_tv_tracker").catch(() => []);
  const canEdit = (auth.canEditContent || auth.adminUnlocked) && dataSource === "database";

  if (params.view || params.platform || params.genre || params.status || params.confidence) {
    await recordUsageEvent({
      userId: auth.user?.id ?? null,
      email: auth.user?.email ?? null,
      eventType: params.view ? "saved_view_used" : "filter_used",
      page: "/current-tv",
      value: params.view ?? JSON.stringify(params)
    });
  }

  return (
    <div className="space-y-5">
      <PageIntro
        eyebrow="Current TV"
        title="Current TV Tracker"
        description="Track what is airing now, what premieres soon, and where finales and returning seasons are landing."
        helperText="Use the calendar view for scheduling work, and the table view when you need to verify dates, networks, or source details record by record."
        dataSource={dataSource}
        errorMessage={errorMessage ? (dataSource === "mock" ? `Demo preview is active because the current TV database read failed: ${errorMessage}` : errorMessage) : null}
      />
      <CurrentTvTracker
        rows={rows}
        sources={sources}
        dataSource={dataSource}
        errorMessage={errorMessage}
        canEdit={canEdit}
        canArchive={auth.canManageUsers || auth.adminUnlocked}
        currentUserEmail={auth.user?.email ?? null}
        canManageAllNotes={auth.canManageUsers || auth.adminUnlocked}
        savedViewsData={savedViews}
        canCreateTeamView={auth.canEditContent || auth.adminUnlocked}
        canManageAllSavedViews={auth.canManageUsers || auth.adminUnlocked}
        initialFilters={{
          mode: params.mode === "calendar" ? "calendar" : "table",
          savedView: params.view,
          calendarWindow: params.calendarWindow,
          query: params.q,
          platform: params.platform,
          premiereFrom: params.premiereFrom,
          premiereTo: params.premiereTo,
          genre: params.genre,
          studio: params.studio,
          status: params.status,
          country: params.country,
          confidence: params.confidence
        }}
      />
    </div>
  );
}
