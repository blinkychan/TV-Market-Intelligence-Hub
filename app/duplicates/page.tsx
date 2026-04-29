import { redirect } from "next/navigation";
import { AlertTriangle, ArrowRightLeft, CheckCircle2, CopyMinus } from "lucide-react";
import { markDuplicateGroupNotDuplicateAction, mergeDuplicateGroupAction } from "./actions";
import { SavedViewRouterPanel } from "@/components/shared/saved-view-router-panel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input, Select } from "@/components/ui/input";
import { Table, Td, Th } from "@/components/ui/table";
import {
  buildDuplicateGroups,
  duplicateStatusTone,
  type DuplicateEntityType,
  type DuplicateGroup,
  type DuplicateGroupRecord
} from "@/lib/deduplication";
import { mockDuplicateGroups } from "@/lib/mock-duplicates";
import { prisma } from "@/lib/prisma";
import { canUseMockPreview, mockPreviewDisabledReason } from "@/lib/runtime-mode";
import { getSavedViewsForPage } from "@/lib/saved-views";
import { getCurrentUserContext } from "@/lib/team-auth";
import { cn, formatDate, humanize } from "@/lib/utils";

export const dynamic = "force-dynamic";

function summarizePayload(payload: Record<string, unknown>) {
  return Object.entries(payload)
    .filter(([, value]) => value != null && value !== "")
    .slice(0, 4);
}

function entityTone(entityType: DuplicateEntityType) {
  if (entityType === "article") return "bg-sky-50 text-sky-700 ring-sky-200";
  if (entityType === "project") return "bg-violet-50 text-violet-700 ring-violet-200";
  if (entityType === "current_show") return "bg-emerald-50 text-emerald-700 ring-emerald-200";
  if (entityType === "buyer") return "bg-fuchsia-50 text-fuchsia-700 ring-fuchsia-200";
  if (entityType === "company") return "bg-amber-50 text-amber-800 ring-amber-200";
  return "bg-rose-50 text-rose-700 ring-rose-200";
}

async function loadDuplicateGroups() {
  try {
    const [articles, projects, currentShows, buyers, companies, people] = await Promise.all([
      prisma.article.findMany({
        select: {
          id: true,
          headline: true,
          aliases: true,
          url: true,
          extractedBuyer: true,
          extractedStudio: true,
          publishedDate: true,
          confidenceScore: true,
          duplicateGroupId: true,
          duplicateConfidence: true,
          possibleDuplicateOfId: true,
          duplicateStatus: true,
          publication: true,
          extractedStatus: true,
          extractedDeduplicationNotes: true
        }
      }),
      prisma.project.findMany({
        select: {
          id: true,
          title: true,
          aliases: true,
          sourceUrl: true,
          networkOrPlatform: true,
          studio: { select: { name: true } },
          announcementDate: true,
          confidenceScore: true,
          duplicateGroupId: true,
          duplicateConfidence: true,
          possibleDuplicateOfId: true,
          duplicateStatus: true,
          status: true,
          notes: true
        }
      }),
      prisma.currentShow.findMany({
        select: {
          id: true,
          title: true,
          aliases: true,
          sourceUrl: true,
          networkOrPlatform: true,
          studio: true,
          premiereDate: true,
          duplicateGroupId: true,
          duplicateConfidence: true,
          possibleDuplicateOfId: true,
          duplicateStatus: true,
          status: true,
          notes: true
        }
      }),
      prisma.buyer.findMany({
        select: {
          id: true,
          name: true,
          aliases: true,
          parentCompany: true,
          duplicateGroupId: true,
          duplicateConfidence: true,
          possibleDuplicateOfId: true,
          duplicateStatus: true,
          type: true,
          notes: true
        }
      }),
      prisma.company.findMany({
        select: {
          id: true,
          name: true,
          aliases: true,
          duplicateGroupId: true,
          duplicateConfidence: true,
          possibleDuplicateOfId: true,
          duplicateStatus: true,
          type: true,
          notes: true
        }
      }),
      prisma.person.findMany({
        select: {
          id: true,
          name: true,
          aliases: true,
          company: true,
          duplicateGroupId: true,
          duplicateConfidence: true,
          possibleDuplicateOfId: true,
          duplicateStatus: true,
          role: true,
          notes: true
        }
      })
    ]);

    const records: DuplicateGroupRecord[] = [
      ...articles.map((article) => ({
        id: article.id,
        entityType: "article" as const,
        label: article.headline,
        url: article.url,
        buyerOrPlatform: article.extractedBuyer,
        studioOrCompany: article.extractedStudio,
        date: article.publishedDate,
        aliases: article.aliases,
        notes: article.extractedDeduplicationNotes,
        confidenceScore: article.confidenceScore,
        duplicateGroupId: article.duplicateGroupId,
        duplicateConfidence: article.duplicateConfidence,
        possibleDuplicateOfId: article.possibleDuplicateOfId,
        duplicateStatus: article.duplicateStatus,
        payload: {
          publication: article.publication,
          status: article.extractedStatus,
          notes: article.extractedDeduplicationNotes
        }
      })),
      ...projects.map((project) => ({
        id: project.id,
        entityType: "project" as const,
        label: project.title,
        url: project.sourceUrl,
        buyerOrPlatform: project.networkOrPlatform,
        studioOrCompany: project.studio?.name ?? null,
        date: project.announcementDate,
        aliases: project.aliases,
        notes: project.notes,
        confidenceScore: project.confidenceScore,
        duplicateGroupId: project.duplicateGroupId,
        duplicateConfidence: project.duplicateConfidence,
        possibleDuplicateOfId: project.possibleDuplicateOfId,
        duplicateStatus: project.duplicateStatus,
        payload: {
          status: project.status,
          notes: project.notes
        }
      })),
      ...currentShows.map((show) => ({
        id: show.id,
        entityType: "current_show" as const,
        label: show.title,
        url: show.sourceUrl,
        buyerOrPlatform: show.networkOrPlatform,
        studioOrCompany: show.studio,
        date: show.premiereDate,
        aliases: show.aliases,
        notes: show.notes,
        duplicateGroupId: show.duplicateGroupId,
        duplicateConfidence: show.duplicateConfidence,
        possibleDuplicateOfId: show.possibleDuplicateOfId,
        duplicateStatus: show.duplicateStatus,
        payload: {
          status: show.status,
          notes: show.notes
        }
      })),
      ...buyers.map((buyer) => ({
        id: buyer.id,
        entityType: "buyer" as const,
        label: buyer.name,
        studioOrCompany: buyer.parentCompany,
        aliases: buyer.aliases,
        notes: buyer.notes,
        duplicateGroupId: buyer.duplicateGroupId,
        duplicateConfidence: buyer.duplicateConfidence,
        possibleDuplicateOfId: buyer.possibleDuplicateOfId,
        duplicateStatus: buyer.duplicateStatus,
        payload: {
          type: buyer.type,
          notes: buyer.notes
        }
      })),
      ...companies.map((company) => ({
        id: company.id,
        entityType: "company" as const,
        label: company.name,
        studioOrCompany: company.type,
        aliases: company.aliases,
        notes: company.notes,
        duplicateGroupId: company.duplicateGroupId,
        duplicateConfidence: company.duplicateConfidence,
        possibleDuplicateOfId: company.possibleDuplicateOfId,
        duplicateStatus: company.duplicateStatus,
        payload: {
          type: company.type,
          notes: company.notes
        }
      })),
      ...people.map((person) => ({
        id: person.id,
        entityType: "person" as const,
        label: person.name,
        studioOrCompany: person.company,
        aliases: person.aliases,
        notes: person.notes,
        duplicateGroupId: person.duplicateGroupId,
        duplicateConfidence: person.duplicateConfidence,
        possibleDuplicateOfId: person.possibleDuplicateOfId,
        duplicateStatus: person.duplicateStatus,
        payload: {
          role: person.role,
          company: person.company,
          notes: person.notes
        }
      }))
    ];

    const groups = buildDuplicateGroups(records);
    return {
      dataSource: "database" as const,
      groups,
      errorMessage:
        groups.length === 0
          ? "No duplicate groups are currently flagged. As ingestion expands, possible matches will surface here for human review."
          : undefined
    };
  } catch (error) {
    if (!canUseMockPreview()) {
      return {
        dataSource: "database" as const,
        groups: [] as DuplicateGroup[],
        errorMessage: mockPreviewDisabledReason() ?? (error instanceof Error ? error.message : "Could not load duplicate review data.")
      };
    }

    return {
      dataSource: "mock" as const,
      groups: mockDuplicateGroups,
      errorMessage: error instanceof Error ? error.message : "Could not load duplicate review data."
    };
  }
}

export default async function DuplicateReviewPage({
  searchParams
}: {
  searchParams: Promise<{ entityType?: string; confidence?: string }>;
}) {
  const params = await searchParams;
  const auth = await getCurrentUserContext();
  if (!auth.isAuthenticated) {
    redirect("/login");
  }

  if (!auth.canEditContent && !auth.adminUnlocked) {
    redirect("/access-denied");
  }

  const { groups, dataSource, errorMessage } = await loadDuplicateGroups();
  const savedViews = await getSavedViewsForPage("duplicate_review").catch(() => []);
  const filteredGroups = groups.filter((group) => {
    if (params.entityType && group.entityType !== params.entityType) return false;
    if (params.confidence === "high" && group.confidence < 0.85) return false;
    if (params.confidence === "medium" && (group.confidence < 0.6 || group.confidence >= 0.85)) return false;
    return true;
  });
  const canMerge = dataSource === "database" && (auth.canEditContent || auth.adminUnlocked);
  const confirmedCount = filteredGroups.flatMap((group) => group.records).filter((record) => record.duplicateStatus === "confirmed_duplicate").length;
  const highConfidenceCount = filteredGroups.filter((group) => group.confidence >= 0.85).length;

  return (
    <div className="space-y-6">
      <section className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-sm font-medium uppercase tracking-[0.18em] text-muted-foreground">Data Hygiene</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">Duplicate Review</h1>
          <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
            Review possible overlaps before the database fills up with near-miss projects, current shows, companies, people, buyers, and articles.
          </p>
        </div>
        <Badge className={cn("rounded-full px-3 py-1 text-xs font-medium ring-1", dataSource === "database" ? "bg-emerald-50 text-emerald-700 ring-emerald-200" : "bg-amber-50 text-amber-800 ring-amber-200")}>
          {dataSource === "database" ? "Database" : "Mock Preview Data"}
        </Badge>
      </section>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader><CardTitle className="text-sm text-muted-foreground">Duplicate Groups</CardTitle></CardHeader>
          <CardContent><div className="text-3xl font-semibold">{filteredGroups.length}</div></CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-sm text-muted-foreground">High Confidence</CardTitle></CardHeader>
          <CardContent><div className="text-3xl font-semibold">{highConfidenceCount}</div></CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-sm text-muted-foreground">Confirmed Duplicate Records</CardTitle></CardHeader>
          <CardContent><div className="text-3xl font-semibold">{confirmedCount}</div></CardContent>
        </Card>
      </div>

      <SavedViewRouterPanel
        pageType="duplicate_review"
        savedViews={savedViews}
        returnPath="/duplicates"
        currentState={{ filtersJson: { entityType: params.entityType ?? "", confidence: params.confidence ?? "" } }}
        canCreateTeamView={auth.canEditContent || auth.adminUnlocked}
        currentUserEmail={auth.user?.email ?? null}
        canManageAll={auth.canManageUsers || auth.adminUnlocked}
        canWrite={dataSource === "database"}
      />

      <Card>
        <CardHeader><CardTitle>Filters</CardTitle></CardHeader>
        <CardContent>
          <form className="grid gap-3 md:grid-cols-[1fr_1fr_auto]">
            <Select name="entityType" defaultValue={params.entityType ?? ""}>
              <option value="">All record types</option>
              <option value="article">Articles</option>
              <option value="project">Projects</option>
              <option value="current_show">Current Shows</option>
              <option value="buyer">Buyers</option>
              <option value="company">Companies</option>
              <option value="person">People</option>
            </Select>
            <Select name="confidence" defaultValue={params.confidence ?? ""}>
              <option value="">All confidence levels</option>
              <option value="high">High confidence</option>
              <option value="medium">Medium confidence</option>
            </Select>
            <Button type="submit">Apply</Button>
          </form>
        </CardContent>
      </Card>

      {errorMessage ? (
        <Card className="border-amber-200 bg-amber-50/60">
          <CardContent className="flex items-start gap-3 py-5 text-sm text-amber-900">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <div>{errorMessage}</div>
          </CardContent>
        </Card>
      ) : null}

      {filteredGroups.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-slate-100">
              <CheckCircle2 className="h-5 w-5" />
            </div>
            No duplicate clusters are waiting for review right now.
          </CardContent>
        </Card>
      ) : null}

      <div className="space-y-5">
        {filteredGroups.map((group) => (
          <Card key={group.id} className="overflow-hidden">
            <CardHeader className="border-b bg-slate-50/70">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge className={cn("rounded-full px-2.5 py-1 text-[11px] font-medium ring-1", entityTone(group.entityType))}>
                      {humanize(group.entityType)}
                    </Badge>
                    <Badge className="rounded-full bg-slate-900 px-2.5 py-1 text-[11px] font-medium text-white">
                      {Math.round(group.confidence * 100)}% confidence
                    </Badge>
                  </div>
                  <CardTitle className="text-xl">{group.label}</CardTitle>
                  <p className="text-sm text-muted-foreground">{group.reason}</p>
                </div>
                {!canMerge ? (
                  <div className="rounded-md border border-dashed border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                    Preview mode shows example groups, but merge actions stay disabled.
                  </div>
                ) : null}
              </div>
            </CardHeader>
            <CardContent className="space-y-5 p-0">
              <div className="overflow-x-auto">
                <Table className="min-w-full">
                  <thead>
                    <tr>
                      <Th>Record</Th>
                      <Th>Status</Th>
                      <Th>Buyer / Platform</Th>
                      <Th>Studio / Company</Th>
                      <Th>Date</Th>
                      <Th>Source</Th>
                      <Th>Signals</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {group.records.map((record) => (
                      <tr key={record.id}>
                        <Td>
                          <div className="space-y-1">
                            <div className="font-medium">{record.label}</div>
                            {record.aliases ? <div className="text-xs text-muted-foreground">Aliases: {record.aliases}</div> : null}
                            <div className="text-xs text-muted-foreground">{record.id}</div>
                          </div>
                        </Td>
                        <Td>
                          <Badge className={cn("rounded-full px-2.5 py-1 text-[11px] font-medium ring-1", duplicateStatusTone(record.duplicateStatus ?? null))}>
                            {humanize(record.duplicateStatus ?? "not_duplicate")}
                          </Badge>
                        </Td>
                        <Td>{record.buyerOrPlatform ?? "—"}</Td>
                        <Td>{record.studioOrCompany ?? "—"}</Td>
                        <Td>{formatDate(record.date ?? null)}</Td>
                        <Td className="max-w-[280px] break-words text-xs text-muted-foreground">{record.url ?? "—"}</Td>
                        <Td>
                          <ul className="space-y-1 text-xs text-muted-foreground">
                            {summarizePayload(record.payload).map(([key, value]) => (
                              <li key={key}>
                                <span className="font-medium text-slate-700">{humanize(key)}:</span> {String(value)}
                              </li>
                            ))}
                          </ul>
                        </Td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              </div>

              <div className="grid gap-4 px-6 pb-6 lg:grid-cols-[1.4fr_1fr]">
                <form action={mergeDuplicateGroupAction} className="space-y-4 rounded-xl border bg-white p-4">
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <ArrowRightLeft className="h-4 w-4" />
                    Merge Review
                  </div>
                  <input type="hidden" name="groupId" value={group.id} />
                  <input type="hidden" name="entityType" value={group.entityType} />
                  <input type="hidden" name="recordIds" value={group.records.map((record) => record.id).join(",")} />

                  <div className="space-y-2">
                    <div className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">Winning record</div>
                    <div className="space-y-2">
                      {group.records.map((record, index) => (
                        <label key={record.id} className="flex items-start gap-3 rounded-lg border px-3 py-3 text-sm">
                          <input type="radio" name="winnerId" value={record.id} defaultChecked={index === 0} className="mt-1" disabled={!canMerge} />
                          <span>
                            <span className="font-medium">{record.label}</span>
                            <span className="block text-xs text-muted-foreground">{record.id}</span>
                          </span>
                        </label>
                      ))}
                    </div>
                  </div>

                  <div className="grid gap-3 md:grid-cols-3">
                    <label className="space-y-1 text-sm">
                      <span className="font-medium">Keep display name from</span>
                      <Input name="keepLabelFromId" defaultValue={group.records[0]?.id ?? ""} list={`${group.id}-records`} disabled={!canMerge} />
                    </label>
                    <label className="space-y-1 text-sm">
                      <span className="font-medium">Keep aliases from</span>
                      <Input name="keepAliasesFromId" defaultValue={group.records[0]?.id ?? ""} list={`${group.id}-records`} disabled={!canMerge} />
                    </label>
                    <label className="space-y-1 text-sm">
                      <span className="font-medium">Keep notes from</span>
                      <Input name="keepNotesFromId" defaultValue={group.records[0]?.id ?? ""} list={`${group.id}-records`} disabled={!canMerge} />
                    </label>
                  </div>

                  <datalist id={`${group.id}-records`}>
                    {group.records.map((record) => (
                      <option key={record.id} value={record.id}>
                        {record.label}
                      </option>
                    ))}
                  </datalist>

                  <div className="rounded-lg bg-slate-50 px-3 py-3 text-xs text-muted-foreground">
                    Merge keeps the losing records in place, marks them as merged, carries linked relationships/articles forward, and appends an audit note.
                  </div>

                  <Button type="submit" disabled={!canMerge}>
                    <CopyMinus className="mr-2 h-4 w-4" />
                    Merge Into Winner
                  </Button>
                </form>

                <form action={markDuplicateGroupNotDuplicateAction} className="space-y-4 rounded-xl border bg-white p-4">
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <CheckCircle2 className="h-4 w-4" />
                    Mark As Not Duplicate
                  </div>
                  <input type="hidden" name="entityType" value={group.entityType} />
                  <input type="hidden" name="recordIds" value={group.records.map((record) => record.id).join(",")} />
                  <p className="text-sm text-muted-foreground">
                    Use this when the records are legitimately distinct and should stop surfacing as a duplicate group.
                  </p>
                  <Button type="submit" variant="secondary" disabled={!canMerge}>
                    Keep Records Separate
                  </Button>
                </form>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
