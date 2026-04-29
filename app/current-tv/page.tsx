import { CurrentTvTracker, type CurrentTvRow } from "@/components/tables/current-tv-tracker";
import { mockAuditLogs } from "@/lib/mock-audit";
import { defaultCurrentTvSources, type CurrentTvSourceRecord } from "@/lib/current-tv-sources";
import { mockBuyerDetails } from "@/lib/mock-buyers";
import { mockCurrentShows } from "@/lib/mock-current-tv";
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

export default async function CurrentTvPage() {
  const { rows, sources, dataSource, errorMessage } = await getCurrentShows();
  const auth = await getCurrentUserContext();
  const savedViews = await getSavedViewsForPage("current_tv_tracker").catch(() => []);
  const canEdit = (auth.canEditContent || auth.adminUnlocked) && dataSource === "database";

  return (
    <div className="space-y-5">
      <section className="rounded-lg border bg-white p-6 shadow-panel">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-primary">Airing and Upcoming</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">Current TV Tracker</h1>
        <p className="mt-3 max-w-3xl text-muted-foreground">
          Track what is airing now, what premieres soon, and where finales and returning seasons are landing.
        </p>
      </section>
      <CurrentTvTracker
        rows={rows}
        sources={sources}
        dataSource={dataSource}
        errorMessage={errorMessage}
        canEdit={canEdit}
        currentUserEmail={auth.user?.email ?? null}
        canManageAllNotes={auth.canManageUsers || auth.adminUnlocked}
        savedViewsData={savedViews}
        canCreateTeamView={auth.canEditContent || auth.adminUnlocked}
        canManageAllSavedViews={auth.canManageUsers || auth.adminUnlocked}
      />
    </div>
  );
}
