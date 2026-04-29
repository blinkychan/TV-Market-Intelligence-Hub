import Link from "next/link";
import { Check, CopyMinus, ExternalLink, FilePenLine, FileSearch, FileText, Link2, PlusCircle, ShieldAlert, X } from "lucide-react";
import {
  approveAndCreateRecordsAction,
  createCurrentShowFromArticle,
  createOrLinkBuyer,
  createOrLinkCompanies,
  createOrLinkPeople,
  createProjectFromArticle,
  createRelationships,
  fetchArticleBodyAction,
  fetchBodiesForNeedsReview,
  fetchSelectedBodiesAction,
  linkArticleToProject,
  linkArticleToShow,
  runAiExtractionAction,
  runAiExtractionForSelectedAction,
  saveExtractedFields,
  updateArticleStatus
} from "./actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input, Select } from "@/components/ui/input";
import { Table, Td, Th } from "@/components/ui/table";
import { ChangeHistoryPanel } from "@/components/audit/change-history";
import { SavedViewRouterPanel } from "@/components/shared/saved-view-router-panel";
import { TeamNotesPanel } from "@/components/shared/team-notes-panel";
import type { AuditLogEntry } from "@/lib/audit";
import { mockCurrentShows } from "@/lib/mock-current-tv";
import { mockAuditLogs } from "@/lib/mock-audit";
import { readMockPreviewState } from "@/lib/mock-preview-store";
import { mockReviewArticles } from "@/lib/mock-review";
import { prisma } from "@/lib/prisma";
import { canUseMockPreview, mockPreviewDisabledReason } from "@/lib/runtime-mode";
import { getSavedViewsForPage } from "@/lib/saved-views";
import { sourceReliabilityTone } from "@/lib/source-reliability";
import { getCurrentUserContext } from "@/lib/team-auth";
import { getTeamNotes } from "@/lib/team-notes";
import { cn, formatDate, humanize } from "@/lib/utils";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{ articleId?: string; status?: string; q?: string }>;

type ReviewArticle = {
  id: string;
  headline: string;
  publication: string | null;
  publishedDate: Date | null;
  url: string;
  sourceType: string | null;
  rawHtml?: string | null;
  extractedText?: string | null;
  extractedExcerpt?: string | null;
  extractionMethod?: string | null;
  bodyFetchStatus?: string | null;
  bodyFetchError?: string | null;
  bodyFetchedAt?: Date | null;
  robotsAllowed?: boolean | null;
  paywallLikely?: boolean | null;
  sourceReliability?: string | null;
  extractionStatus: string;
  extractionMode?: string | null;
  suspectedCategory: string | null;
  confidenceScore: number | null;
  summary: string | null;
  linkedProjectId: string | null;
  linkedProjectTitle: string | null;
  linkedShowId: string | null;
  linkedShowTitle: string | null;
  extractedProjectTitle: string | null;
  extractedFormat: string | null;
  extractedGenre?: string | null;
  extractedSourceMaterial?: string | null;
  extractedStatus: string | null;
  extractedLogline: string | null;
  extractedBuyer: string | null;
  extractedStudio: string | null;
  extractedCompanies: string | null;
  extractedPeople: string | null;
  extractedCountry: string | null;
  extractedIsAcquisition?: boolean | null;
  extractedIsCoProduction?: boolean | null;
  extractedIsInternational?: boolean | null;
  extractedAnnouncementDate: Date | null;
  extractedPremiereDate: Date | null;
  extractedRelationships: string | null;
  extractedFieldsNeedingReview?: string | null;
  extractedDeduplicationNotes?: string | null;
  extractedStructuredDataJson?: unknown;
  aiExtractionError?: string | null;
  changeHistory?: AuditLogEntry[];
};

const statusOptions = ["All", "New", "Needs Review", "Approved", "Rejected", "Duplicate"];

function extractionTone(status: string) {
  if (status === "Approved") return "bg-emerald-50 text-emerald-700 ring-emerald-200";
  if (status === "Needs Review") return "bg-amber-50 text-amber-800 ring-amber-200";
  if (status === "New") return "bg-sky-50 text-sky-700 ring-sky-200";
  if (status === "Rejected") return "bg-rose-50 text-rose-700 ring-rose-200";
  if (status === "Duplicate") return "bg-slate-100 text-slate-700 ring-slate-200";
  return "bg-slate-100 text-slate-700 ring-slate-200";
}

function parseList(value?: string | null) {
  return (value ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function percentConfidence(value?: number | null) {
  if (value == null) return "Unscored";
  return `${Math.round(value * 100)}%`;
}

function bodyFetchTone(status?: string | null) {
  if (status === "success") return "bg-emerald-50 text-emerald-700 ring-emerald-200";
  if (status === "robots_blocked") return "bg-amber-50 text-amber-800 ring-amber-200";
  if (status === "paywall_likely") return "bg-violet-50 text-violet-700 ring-violet-200";
  if (status === "timeout" || status === "fetch_error" || status === "extraction_error") return "bg-rose-50 text-rose-700 ring-rose-200";
  return "bg-slate-100 text-slate-700 ring-slate-200";
}

async function getReviewData() {
  const mockProjectOptions = Array.from(
    new Map(
      mockReviewArticles
        .filter((article) => article.linkedProjectId || article.extractedProjectTitle)
        .map((article) => [
          article.linkedProjectId ?? `mock-project-${(article.extractedProjectTitle ?? article.headline).toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
          {
            id: article.linkedProjectId ?? `mock-project-${(article.extractedProjectTitle ?? article.headline).toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
            title: article.linkedProjectTitle ?? article.extractedProjectTitle ?? article.headline
          }
        ])
    ).values()
  );

  const mockShowOptions = mockCurrentShows.map((show) => ({ id: show.id, title: show.title }));

  try {
    const [articles, projects, currentShows] = await Promise.all([
      prisma.article.findMany({
        include: {
          linkedProject: { select: { id: true, title: true } },
          linkedShow: { select: { id: true, title: true } }
        },
        orderBy: [{ needsReview: "desc" }, { publishedDate: "desc" }]
      }),
      prisma.project.findMany({ select: { id: true, title: true }, orderBy: { title: "asc" } }),
      prisma.currentShow.findMany({ select: { id: true, title: true }, orderBy: { title: "asc" } })
    ]);

    if (!articles.length && canUseMockPreview()) {
      const previewState = await readMockPreviewState().catch(() => null);
      return {
        dataSource: "mock" as const,
        articles: previewState?.reviewArticles ?? mockReviewArticles,
        projects: mockProjectOptions,
        currentShows: mockShowOptions,
        errorMessage: "SQLite returned no Article rows."
      };
    }

    if (!articles.length) {
      return {
        dataSource: "database" as const,
        articles: [] as ReviewArticle[],
        projects,
        currentShows,
        errorMessage: "No Article rows exist yet. Seed starter data or run ingestion to populate the review queue."
      };
    }

    return {
      dataSource: "database" as const,
      projects,
      currentShows,
      articles: articles.map((article) => ({
        id: article.id,
        headline: article.headline,
        publication: article.publication,
        publishedDate: article.publishedDate,
        url: article.url,
        sourceType: article.sourceType,
        rawHtml: article.rawHtml,
        extractedText: article.extractedText,
        extractedExcerpt: article.extractedExcerpt,
        extractionMethod: article.extractionMethod,
        bodyFetchStatus: article.bodyFetchStatus,
        bodyFetchError: article.bodyFetchError,
        bodyFetchedAt: article.bodyFetchedAt,
        robotsAllowed: article.robotsAllowed,
        paywallLikely: article.paywallLikely,
        sourceReliability: article.sourceReliability,
        extractionStatus: article.extractionStatus,
        extractionMode: article.extractionMode,
        suspectedCategory: article.suspectedCategory,
        confidenceScore: article.confidenceScore,
        summary: article.summary,
        linkedProjectId: article.linkedProjectId,
        linkedProjectTitle: article.linkedProject?.title ?? null,
        linkedShowId: article.linkedShowId,
        linkedShowTitle: article.linkedShow?.title ?? null,
        extractedProjectTitle: article.extractedProjectTitle,
        extractedFormat: article.extractedFormat,
        extractedGenre: article.extractedGenre,
        extractedSourceMaterial: article.extractedSourceMaterial,
        extractedStatus: article.extractedStatus,
        extractedLogline: article.extractedLogline,
        extractedBuyer: article.extractedBuyer,
        extractedStudio: article.extractedStudio,
        extractedCompanies: article.extractedCompanies,
        extractedPeople: article.extractedPeople,
        extractedCountry: article.extractedCountry,
        extractedIsAcquisition: article.extractedIsAcquisition,
        extractedIsCoProduction: article.extractedIsCoProduction,
        extractedIsInternational: article.extractedIsInternational,
        extractedAnnouncementDate: article.extractedAnnouncementDate,
        extractedPremiereDate: article.extractedPremiereDate,
        extractedRelationships: article.extractedRelationships,
        extractedFieldsNeedingReview: article.extractedFieldsNeedingReview,
        extractedDeduplicationNotes: article.extractedDeduplicationNotes,
        extractedStructuredDataJson: article.extractedStructuredDataJson,
        aiExtractionError: article.aiExtractionError
      })),
      errorMessage: undefined
    };
  } catch (error) {
    if (!canUseMockPreview()) {
      return {
        dataSource: "database" as const,
        articles: [] as ReviewArticle[],
        projects: [] as Array<{ id: string; title: string }>,
        currentShows: [] as Array<{ id: string; title: string }>,
        errorMessage: mockPreviewDisabledReason() ?? (error instanceof Error ? error.message : "Unknown database error.")
      };
    }

    const previewState = await readMockPreviewState().catch(() => null);
    return {
      dataSource: "mock" as const,
      articles: previewState?.reviewArticles ?? mockReviewArticles,
      projects: mockProjectOptions,
      currentShows: mockShowOptions,
      errorMessage: error instanceof Error ? error.message : "Unknown database error."
    };
  }
}

export default async function ReviewQueuePage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const query = (params.q ?? "").trim().toLowerCase();
  const statusFilter = params.status ?? "All";
  const { articles, dataSource, projects, currentShows, errorMessage } = await getReviewData();
  const auth = await getCurrentUserContext();
  const savedViews = await getSavedViewsForPage("articles").catch(() => []);
  const canEdit = auth.canEditContent || auth.adminUnlocked;
  const canAdminOps = auth.canManageIngestion || auth.adminUnlocked;

  const filteredArticles = articles.filter((article) => {
    const matchesStatus = statusFilter === "All" || article.extractionStatus === statusFilter;
    const haystack = [
      article.headline,
      article.publication,
      article.suspectedCategory,
      article.extractedProjectTitle,
      article.extractedBuyer,
      article.extractedStudio,
      article.extractedCompanies,
      article.extractedPeople
    ]
      .join(" ")
      .toLowerCase();
    const matchesQuery = !query || haystack.includes(query);
    return matchesStatus && matchesQuery;
  });

  const selectedArticle =
    filteredArticles.find((article) => article.id === params.articleId) ??
    filteredArticles[0] ??
    null;
  const selectedArticleHistory =
    dataSource === "database" && selectedArticle
      ? await prisma.auditLog.findMany({
          where: { entityType: "Article", entityId: selectedArticle.id },
          orderBy: { createdAt: "desc" },
          take: 8
        }).catch(() => [])
      : selectedArticle
        ? mockAuditLogs.filter((log) => log.entityType === "Article" && log.entityId === selectedArticle.id)
        : [];
  const selectedArticleNotes =
    dataSource === "database" && selectedArticle
      ? await getTeamNotes("Article", selectedArticle.id).catch(() => [])
      : [];

  const queueCount = articles.filter((article) => article.extractionStatus === "Needs Review" || article.extractionStatus === "New").length;
  const approvedCount = articles.filter((article) => article.extractionStatus === "Approved").length;
  const duplicateCount = articles.filter((article) => article.extractionStatus === "Duplicate").length;

  return (
    <div className="space-y-6">
      <section className="rounded-lg border bg-white p-6 shadow-panel">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-primary">Human Review</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight">Article Review Queue</h1>
            <p className="mt-3 max-w-3xl text-muted-foreground">
              Review incoming trade items, inspect draft structured fields, and decide whether each article should become a tracked project or show.
            </p>
          </div>
          <Badge className={dataSource === "database" ? "bg-emerald-50 text-emerald-700 ring-emerald-200" : "bg-amber-50 text-amber-800 ring-amber-200"}>
            Data Source: {dataSource === "database" ? "Database" : "Mock Preview Data"}
          </Badge>
        </div>
        {errorMessage ? (
          <div className="mt-4 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
            {dataSource === "mock" ? `Preview data is active because the database queue could not be read: ${errorMessage}` : errorMessage}
          </div>
        ) : null}
        {!canEdit ? (
          <div className="mt-4 rounded-md border border-sky-200 bg-sky-50 px-3 py-2 text-sm text-sky-900">
            Your current role is read-only. Editors can work the review queue, and admins can also run body-fetch and ingestion-adjacent controls.
          </div>
        ) : null}
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        <Card className="shadow-panel">
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Needs Attention</CardTitle></CardHeader>
          <CardContent><div className="text-3xl font-semibold">{queueCount}</div></CardContent>
        </Card>
        <Card className="shadow-panel">
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Approved</CardTitle></CardHeader>
          <CardContent><div className="text-3xl font-semibold">{approvedCount}</div></CardContent>
        </Card>
        <Card className="shadow-panel">
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Duplicates</CardTitle></CardHeader>
          <CardContent><div className="text-3xl font-semibold">{duplicateCount}</div></CardContent>
        </Card>
      </section>

      <SavedViewRouterPanel
        pageType="articles"
        savedViews={savedViews}
        returnPath="/review"
        currentState={{ filtersJson: { q: params.q ?? "", status: statusFilter } }}
        canCreateTeamView={auth.canEditContent || auth.adminUnlocked}
        currentUserEmail={auth.user?.email ?? null}
        canManageAll={auth.canManageUsers || auth.adminUnlocked}
        canWrite={dataSource === "database"}
      />

      <Card className="shadow-panel">
        <CardHeader>
          <CardTitle>Queue Filters</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <form className="flex flex-col gap-3 lg:flex-row lg:items-center">
            <Input name="q" placeholder="Search headline, project, buyer, company, or talent" defaultValue={params.q ?? ""} className="lg:max-w-lg" />
            <Select name="status" defaultValue={statusFilter} className="lg:w-56">
              {statusOptions.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </Select>
            <Button type="submit">Apply Filters</Button>
          </form>
          <div className="flex flex-wrap gap-2">
            <form action={fetchBodiesForNeedsReview}>
              <Button type="submit" variant="secondary" disabled={!canAdminOps}>
                <FileText className="h-4 w-4" /> Fetch Bodies for Needs Review
              </Button>
            </form>
            <Button type="submit" form="review-bulk-body-fetch" variant="secondary" disabled={!canAdminOps || !filteredArticles.length}>
              <FileText className="h-4 w-4" /> Fetch Bodies for Checked Rows
            </Button>
            <Button type="submit" form="review-bulk-body-fetch" formAction={runAiExtractionForSelectedAction} disabled={!canEdit || !filteredArticles.length}>
              <FileSearch className="h-4 w-4" /> Run AI Extraction for Selected
            </Button>
          </div>
          <div className="flex flex-wrap gap-2">
            {statusOptions.map((status) => {
              const href = status === "All"
                ? `/review${params.q ? `?q=${encodeURIComponent(params.q)}` : ""}`
                : `/review?status=${encodeURIComponent(status)}${params.q ? `&q=${encodeURIComponent(params.q)}` : ""}`;
              return (
                <Link
                  key={status}
                  href={href}
                  className={cn(
                    "inline-flex h-9 items-center rounded-md px-3 text-sm font-medium transition",
                    statusFilter === status ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
                  )}
                >
                  {status}
                </Link>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <Card className="shadow-panel">
          <CardHeader>
            <CardTitle>Queued Articles</CardTitle>
          </CardHeader>
          <CardContent>
            {filteredArticles.length ? (
              <div className="overflow-x-auto rounded-lg border">
                <form id="review-bulk-body-fetch" action={fetchSelectedBodiesAction} />
                <Table>
                  <thead className="bg-slate-50">
                    <tr>
                      <Th className="w-10">
                        <span className="sr-only">Select</span>
                      </Th>
                      <Th>Headline</Th>
                      <Th>Status</Th>
                      <Th>Publication</Th>
                      <Th>Published</Th>
                      <Th>Excerpt</Th>
                      <Th>Body Fetch</Th>
                      <Th>Category</Th>
                      <Th>Linked Record</Th>
                      <Th>Confidence</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredArticles.map((article) => {
                      const rowHref = `/review?articleId=${article.id}${statusFilter !== "All" ? `&status=${encodeURIComponent(statusFilter)}` : ""}${params.q ? `&q=${encodeURIComponent(params.q)}` : ""}`;
                      return (
                        <tr key={article.id} className={cn(selectedArticle?.id === article.id && "bg-slate-50")}>
                          <Td>
                            <input type="checkbox" name="articleIds" value={article.id} form="review-bulk-body-fetch" />
                          </Td>
                          <Td>
                            <Link href={rowHref} className="font-medium text-slate-900 hover:text-primary">
                              {article.headline}
                            </Link>
                          </Td>
                          <Td>
                            <Badge className={extractionTone(article.extractionStatus)}>{article.extractionStatus}</Badge>
                          </Td>
                          <Td>{article.publication ?? "Unknown"}</Td>
                          <Td>{formatDate(article.publishedDate)}</Td>
                          <Td>
                            <div className="max-w-xs text-sm text-muted-foreground">
                              {article.extractedExcerpt ?? article.summary ?? "No body excerpt yet."}
                            </div>
                          </Td>
                          <Td>
                            <div className="space-y-1">
                              <Badge className={bodyFetchTone(article.bodyFetchStatus)}>{humanize(article.bodyFetchStatus ?? "not_fetched")}</Badge>
                              <div className="text-xs text-muted-foreground">
                                Robots: {article.robotsAllowed == null ? "?" : article.robotsAllowed ? "Y" : "N"} · Paywall: {article.paywallLikely ? "Y" : "N"}
                              </div>
                            </div>
                          </Td>
                          <Td>{article.suspectedCategory ?? "Unclassified"}</Td>
                          <Td>{article.linkedProjectTitle ?? article.linkedShowTitle ?? "Unlinked"}</Td>
                          <Td>{percentConfidence(article.confidenceScore)}</Td>
                        </tr>
                      );
                    })}
                  </tbody>
                </Table>
              </div>
            ) : (
              <div className="rounded-lg border border-dashed bg-slate-50 p-8 text-center text-sm text-muted-foreground">
                No articles match the current filters. Adjust status or search terms to broaden the queue.
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="shadow-panel xl:sticky xl:top-6">
          <CardHeader className="flex flex-row items-start justify-between space-y-0">
            <div>
              <CardTitle>Article Detail Drawer</CardTitle>
              <p className="mt-1 text-sm text-muted-foreground">
                Inspect draft extraction fields and decide what should move forward into tracked records.
              </p>
            </div>
            {selectedArticle ? (
              <Link href="/review" className="text-sm text-muted-foreground hover:text-slate-900">
                Close
              </Link>
            ) : null}
          </CardHeader>
          <CardContent>
            {selectedArticle ? (
              <div className="space-y-6">
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge className={extractionTone(selectedArticle.extractionStatus)}>{selectedArticle.extractionStatus}</Badge>
                    <Badge className="bg-slate-100 text-slate-700 ring-slate-200">{selectedArticle.suspectedCategory ?? "Unclassified"}</Badge>
                    <Badge className="bg-slate-100 text-slate-700 ring-slate-200">Confidence {percentConfidence(selectedArticle.confidenceScore)}</Badge>
                    <Badge className={bodyFetchTone(selectedArticle.bodyFetchStatus)}>{humanize(selectedArticle.bodyFetchStatus ?? "not_fetched")}</Badge>
                    <Badge className={sourceReliabilityTone(selectedArticle.sourceReliability)}>{humanize(selectedArticle.sourceReliability ?? "low")} reliability</Badge>
                    {selectedArticle.extractionMode ? (
                      <Badge className="bg-slate-100 text-slate-700 ring-slate-200">Extraction {humanize(selectedArticle.extractionMode)}</Badge>
                    ) : null}
                  </div>
                  <h2 className="text-xl font-semibold tracking-tight">{selectedArticle.headline}</h2>
                  <div className="text-sm text-muted-foreground">
                    {selectedArticle.publication ?? "Unknown publication"} · {formatDate(selectedArticle.publishedDate)}
                  </div>
                  <a href={selectedArticle.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-sm text-primary hover:underline">
                    Open source article <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                </div>

                <div className="grid gap-3 md:grid-cols-2">
                  <div className="rounded-lg border bg-slate-50 p-4">
                    <div className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Article Summary</div>
                    <p className="mt-2 text-sm leading-6 text-slate-700">{selectedArticle.summary ?? "No summary yet."}</p>
                    <p className="mt-3 text-sm leading-6 text-slate-700">{selectedArticle.extractedExcerpt ?? "No extracted excerpt yet."}</p>
                  </div>
                  <div className="rounded-lg border bg-slate-50 p-4">
                    <div className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Body Fetch & Link Status</div>
                    <p className="mt-2 text-sm leading-6 text-slate-700">
                      {selectedArticle.linkedProjectTitle ?? selectedArticle.linkedShowTitle ?? "No project or current show linked yet."}
                    </p>
                    <p className="mt-3 text-sm leading-6 text-slate-700">
                      Robots allowed: {selectedArticle.robotsAllowed == null ? "Unknown" : selectedArticle.robotsAllowed ? "Yes" : "No"} · Paywall likely:{" "}
                      {selectedArticle.paywallLikely ? "Yes" : "No"}
                    </p>
                    {selectedArticle.bodyFetchError ? (
                      <p className="mt-3 text-sm leading-6 text-rose-700">{selectedArticle.bodyFetchError}</p>
                    ) : null}
                    {selectedArticle.aiExtractionError ? (
                      <p className="mt-3 text-sm leading-6 text-rose-700">{selectedArticle.aiExtractionError}</p>
                    ) : null}
                    {selectedArticle.extractedDeduplicationNotes ? (
                      <p className="mt-3 text-sm leading-6 text-amber-800">{selectedArticle.extractedDeduplicationNotes}</p>
                    ) : null}
                  </div>
                </div>

                <form action={fetchArticleBodyAction} className="rounded-lg border p-4">
                  <input type="hidden" name="articleId" value={selectedArticle.id} />
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <div className="text-sm font-medium">Article Body Fetch</div>
                      <p className="text-sm text-muted-foreground">
                        Respect robots rules, fetch politely, and store readable text only for internal review and extraction.
                      </p>
                    </div>
                    <Button type="submit" variant="secondary" disabled={!canAdminOps}>
                      <FileText className="h-4 w-4" /> Fetch Article Body
                    </Button>
                  </div>
                </form>

                <form action={runAiExtractionAction} className="rounded-lg border p-4 space-y-4">
                  <input type="hidden" name="articleId" value={selectedArticle.id} />
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <div className="text-sm font-medium">AI Extraction</div>
                      <p className="text-sm text-muted-foreground">
                        AI extraction prefers article body text first, then excerpt, summary, and only uses headline-only fallback as a last resort.
                      </p>
                    </div>
                    <Button type="submit" disabled={!canEdit}>
                      <FileSearch className="h-4 w-4" /> Run AI Extraction
                    </Button>
                  </div>
                  <label className="flex items-center gap-2 text-sm text-muted-foreground">
                    <input type="checkbox" name="confirmOverwrite" />
                    Replace existing extracted fields
                  </label>
                </form>

                <div className="grid gap-3 md:grid-cols-2">
                  <div className="rounded-lg border p-4">
                    <div className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Extracted Project / Show Fields</div>
                    <dl className="mt-3 space-y-2 text-sm">
                      <div className="flex justify-between gap-4"><dt className="text-muted-foreground">Title</dt><dd className="text-right">{selectedArticle.extractedProjectTitle ?? "None"}</dd></div>
                      <div className="flex justify-between gap-4"><dt className="text-muted-foreground">Format</dt><dd className="text-right">{selectedArticle.extractedFormat ?? "None"}</dd></div>
                      <div className="flex justify-between gap-4"><dt className="text-muted-foreground">Genre</dt><dd className="text-right">{selectedArticle.extractedGenre ?? "None"}</dd></div>
                      <div className="flex justify-between gap-4"><dt className="text-muted-foreground">Source Material</dt><dd className="text-right">{selectedArticle.extractedSourceMaterial ?? "None"}</dd></div>
                      <div className="flex justify-between gap-4"><dt className="text-muted-foreground">Status</dt><dd className="text-right">{humanize(selectedArticle.extractedStatus)}</dd></div>
                      <div className="flex justify-between gap-4"><dt className="text-muted-foreground">Buyer</dt><dd className="text-right">{selectedArticle.extractedBuyer ?? "None"}</dd></div>
                      <div className="flex justify-between gap-4"><dt className="text-muted-foreground">Studio</dt><dd className="text-right">{selectedArticle.extractedStudio ?? "None"}</dd></div>
                      <div className="flex justify-between gap-4"><dt className="text-muted-foreground">Country</dt><dd className="text-right">{selectedArticle.extractedCountry ?? "None"}</dd></div>
                      <div className="flex justify-between gap-4"><dt className="text-muted-foreground">Acquisition</dt><dd className="text-right">{selectedArticle.extractedIsAcquisition ? "Yes" : "No"}</dd></div>
                      <div className="flex justify-between gap-4"><dt className="text-muted-foreground">Co-Production</dt><dd className="text-right">{selectedArticle.extractedIsCoProduction ? "Yes" : "No"}</dd></div>
                      <div className="flex justify-between gap-4"><dt className="text-muted-foreground">International</dt><dd className="text-right">{selectedArticle.extractedIsInternational ? "Yes" : "No"}</dd></div>
                    </dl>
                    <p className="mt-3 text-sm leading-6 text-slate-700">{selectedArticle.extractedLogline ?? "No extracted logline yet."}</p>
                  </div>
                  <div className="rounded-lg border p-4">
                    <div className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Entities & Relationships</div>
                    <div className="mt-3 space-y-3 text-sm">
                      <div>
                        <div className="text-muted-foreground">Stored Body Excerpt</div>
                        <p className="mt-1 leading-6 text-slate-700">{selectedArticle.extractedExcerpt ?? "No body excerpt stored."}</p>
                      </div>
                      <div>
                        <div className="text-muted-foreground">Extracted Buyers</div>
                        <div className="mt-1 flex flex-wrap gap-2">
                          {parseList(selectedArticle.extractedBuyer).length ? parseList(selectedArticle.extractedBuyer).map((item) => (
                            <Badge key={item} className="bg-sky-50 text-sky-700 ring-sky-200">{item}</Badge>
                          )) : <span>No buyers suggested.</span>}
                        </div>
                      </div>
                      <div>
                        <div className="text-muted-foreground">Extracted Companies</div>
                        <div className="mt-1 flex flex-wrap gap-2">
                          {parseList(selectedArticle.extractedCompanies).length ? parseList(selectedArticle.extractedCompanies).map((item) => (
                            <Badge key={item} className="bg-violet-50 text-violet-700 ring-violet-200">{item}</Badge>
                          )) : <span>No companies suggested.</span>}
                        </div>
                      </div>
                      <div>
                        <div className="text-muted-foreground">Extracted People</div>
                        <div className="mt-1 flex flex-wrap gap-2">
                          {parseList(selectedArticle.extractedPeople).length ? parseList(selectedArticle.extractedPeople).map((item) => (
                            <Badge key={item} className="bg-emerald-50 text-emerald-700 ring-emerald-200">{item}</Badge>
                          )) : <span>No people suggested.</span>}
                        </div>
                      </div>
                      <div>
                        <div className="text-muted-foreground">Suggested Relationships</div>
                        <p className="mt-1 leading-6 text-slate-700">{selectedArticle.extractedRelationships ?? "No relationship suggestions yet."}</p>
                      </div>
                      <div>
                        <div className="text-muted-foreground">Fields Needing Review</div>
                        <p className="mt-1 leading-6 text-slate-700">{selectedArticle.extractedFieldsNeedingReview ?? "No flagged fields."}</p>
                      </div>
                      <div>
                        <div className="text-muted-foreground">Stored AI Extraction JSON</div>
                        <pre className="mt-1 max-h-44 overflow-auto rounded-md bg-slate-50 p-3 text-xs leading-5 text-slate-700">
                          {selectedArticle.extractedStructuredDataJson ? JSON.stringify(selectedArticle.extractedStructuredDataJson, null, 2) : "No AI extraction snapshot stored yet."}
                        </pre>
                      </div>
                      {selectedArticle.extractedFieldsNeedingReview?.toLowerCase().includes("headline-only extraction") ? (
                        <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                          Low confidence: headline-only extraction.
                        </div>
                      ) : null}
                    </div>
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-3">
                  {[
                    { label: "Approve", value: "Approved", icon: Check },
                    { label: "Reject", value: "Rejected", icon: X },
                    { label: "Mark Duplicate", value: "Duplicate", icon: CopyMinus }
                  ].map((action) => (
                    <form key={action.value} action={updateArticleStatus}>
                      <input type="hidden" name="articleId" value={selectedArticle.id} />
                      <input type="hidden" name="extractionStatus" value={action.value} />
                      <Button type="submit" variant={action.value === "Approve" ? "primary" : "secondary"} className="w-full" disabled={!canEdit}>
                        <action.icon className="h-4 w-4" /> {action.label}
                      </Button>
                    </form>
                  ))}
                </div>

                <form action={approveAndCreateRecordsAction}>
                  <input type="hidden" name="articleId" value={selectedArticle.id} />
                  <Button type="submit" className="w-full" disabled={!canEdit}>
                    <Check className="h-4 w-4" /> Approve and Create Records
                  </Button>
                </form>

                <form action={saveExtractedFields} className="space-y-4 rounded-lg border p-4">
                  <input type="hidden" name="articleId" value={selectedArticle.id} />
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <FilePenLine className="h-4 w-4 text-primary" />
                    Edit Extracted Fields
                  </div>
                  <div className="grid gap-3 md:grid-cols-2">
                    <Input name="suspectedCategory" defaultValue={selectedArticle.suspectedCategory ?? ""} placeholder="Suspected category" />
                    <Input name="confidenceScore" type="number" step="0.01" min="0" max="1" defaultValue={selectedArticle.confidenceScore ?? ""} placeholder="Confidence score" />
                    <Input name="extractedProjectTitle" defaultValue={selectedArticle.extractedProjectTitle ?? ""} placeholder="Project / show title" />
                    <Input name="extractedFormat" defaultValue={selectedArticle.extractedFormat ?? ""} placeholder="Format" />
                    <Input name="extractedGenre" defaultValue={selectedArticle.extractedGenre ?? ""} placeholder="Genre" />
                    <Input name="extractedSourceMaterial" defaultValue={selectedArticle.extractedSourceMaterial ?? ""} placeholder="Source material / IP" />
                    <Input name="extractedStatus" defaultValue={selectedArticle.extractedStatus ?? ""} placeholder="Status" />
                    <Input name="extractedBuyer" defaultValue={selectedArticle.extractedBuyer ?? ""} placeholder="Buyer / network / platform" />
                    <Input name="extractedStudio" defaultValue={selectedArticle.extractedStudio ?? ""} placeholder="Studio" />
                    <Input name="extractedCountry" defaultValue={selectedArticle.extractedCountry ?? ""} placeholder="Country" />
                    <Input name="extractedCompanies" defaultValue={selectedArticle.extractedCompanies ?? ""} placeholder="Companies (comma-separated)" className="md:col-span-2" />
                    <Input name="extractedPeople" defaultValue={selectedArticle.extractedPeople ?? ""} placeholder="People (comma-separated)" className="md:col-span-2" />
                    <Input name="extractedAnnouncementDate" type="date" defaultValue={selectedArticle.extractedAnnouncementDate ? new Date(selectedArticle.extractedAnnouncementDate).toISOString().slice(0, 10) : ""} />
                    <Input name="extractedPremiereDate" type="date" defaultValue={selectedArticle.extractedPremiereDate ? new Date(selectedArticle.extractedPremiereDate).toISOString().slice(0, 10) : ""} />
                    <label className="flex items-center gap-2 text-sm text-muted-foreground"><input type="checkbox" name="extractedIsAcquisition" defaultChecked={Boolean(selectedArticle.extractedIsAcquisition)} /> Acquisition</label>
                    <label className="flex items-center gap-2 text-sm text-muted-foreground"><input type="checkbox" name="extractedIsCoProduction" defaultChecked={Boolean(selectedArticle.extractedIsCoProduction)} /> Co-Production</label>
                    <label className="flex items-center gap-2 text-sm text-muted-foreground"><input type="checkbox" name="extractedIsInternational" defaultChecked={Boolean(selectedArticle.extractedIsInternational)} /> International</label>
                  </div>
                  <textarea
                    name="summary"
                    rows={3}
                    defaultValue={selectedArticle.summary ?? ""}
                    placeholder="Article summary"
                    className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                  />
                  <textarea
                    name="extractedLogline"
                    rows={3}
                    defaultValue={selectedArticle.extractedLogline ?? ""}
                    placeholder="Extracted logline / summary"
                    className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                  />
                  <textarea
                    name="extractedRelationships"
                    rows={3}
                    defaultValue={selectedArticle.extractedRelationships ?? ""}
                    placeholder="Suggested relationships"
                    className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                  />
                  <textarea
                    name="extractedFieldsNeedingReview"
                    rows={2}
                    defaultValue={selectedArticle.extractedFieldsNeedingReview ?? ""}
                    placeholder="Fields needing review"
                    className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                  />
                  <textarea
                    name="extractedDeduplicationNotes"
                    rows={2}
                    defaultValue={selectedArticle.extractedDeduplicationNotes ?? ""}
                    placeholder="Deduplication notes"
                    className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                  />
                  <Button type="submit" variant="secondary" disabled={!canEdit}>
                    <ShieldAlert className="h-4 w-4" /> Edit Extracted Fields
                  </Button>
                </form>

                <div className="space-y-3 rounded-lg border p-4">
                  <div className="text-sm font-medium">Create / Link Records</div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <form action={createProjectFromArticle}>
                      <input type="hidden" name="articleId" value={selectedArticle.id} />
                      <Button type="submit" className="w-full" disabled={!canEdit}>
                        <PlusCircle className="h-4 w-4" /> Create Project
                      </Button>
                    </form>
                    <form action={createCurrentShowFromArticle}>
                      <input type="hidden" name="articleId" value={selectedArticle.id} />
                      <Button type="submit" variant="secondary" className="w-full" disabled={!canEdit}>
                        <FileText className="h-4 w-4" /> Create Current Show
                      </Button>
                    </form>
                  </div>
                  <form action={linkArticleToProject} className="grid gap-3 md:grid-cols-[1fr_auto]">
                    <input type="hidden" name="articleId" value={selectedArticle.id} />
                    <Select name="projectId" defaultValue={selectedArticle.linkedProjectId ?? ""} disabled={!projects.length}>
                      <option value="">Link to existing project</option>
                      {projects.map((project) => (
                        <option key={project.id} value={project.id}>
                          {project.title}
                        </option>
                      ))}
                    </Select>
                    <Button type="submit" variant="ghost" disabled={!projects.length || !canEdit}>
                      <Link2 className="h-4 w-4" /> Link to Existing Project
                    </Button>
                  </form>
                  <form action={linkArticleToShow} className="grid gap-3 md:grid-cols-[1fr_auto]">
                    <input type="hidden" name="articleId" value={selectedArticle.id} />
                    <Select name="showId" defaultValue={selectedArticle.linkedShowId ?? ""} disabled={!currentShows.length}>
                      <option value="">Link to existing show</option>
                      {currentShows.map((show) => (
                        <option key={show.id} value={show.id}>
                          {show.title}
                        </option>
                      ))}
                    </Select>
                    <Button type="submit" variant="ghost" disabled={!currentShows.length || !canEdit}>
                      <Link2 className="h-4 w-4" /> Link to Existing Show
                    </Button>
                  </form>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <form action={createOrLinkBuyer}>
                      <input type="hidden" name="articleId" value={selectedArticle.id} />
                      <Button type="submit" variant="secondary" className="w-full" disabled={!canEdit}>
                        <PlusCircle className="h-4 w-4" /> Create/Link Buyer
                      </Button>
                    </form>
                    <form action={createOrLinkCompanies}>
                      <input type="hidden" name="articleId" value={selectedArticle.id} />
                      <Button type="submit" variant="secondary" className="w-full" disabled={!canEdit}>
                        <PlusCircle className="h-4 w-4" /> Create/Link Companies
                      </Button>
                    </form>
                    <form action={createOrLinkPeople}>
                      <input type="hidden" name="articleId" value={selectedArticle.id} />
                      <Button type="submit" variant="secondary" className="w-full" disabled={!canEdit}>
                        <PlusCircle className="h-4 w-4" /> Create/Link People
                      </Button>
                    </form>
                    <form action={createRelationships}>
                      <input type="hidden" name="articleId" value={selectedArticle.id} />
                      <Button type="submit" variant="secondary" className="w-full" disabled={!canEdit}>
                        <Link2 className="h-4 w-4" /> Create Relationships
                      </Button>
                    </form>
                  </div>
                </div>

                <ChangeHistoryPanel
                  title="Article Change History"
                  logs={selectedArticleHistory}
                  emptyText="No article-level change history has been recorded yet."
                />
                <TeamNotesPanel
                  entityType="Article"
                  entityId={selectedArticle.id}
                  notes={selectedArticleNotes}
                  returnPath={`/review?articleId=${selectedArticle.id}${statusFilter !== "All" ? `&status=${encodeURIComponent(statusFilter)}` : ""}${params.q ? `&q=${encodeURIComponent(params.q)}` : ""}`}
                  currentUserEmail={auth.user?.email ?? null}
                  canManageAll={auth.canManageUsers || auth.adminUnlocked}
                  canWrite={dataSource === "database"}
                />
              </div>
            ) : (
              <div className="rounded-lg border border-dashed bg-slate-50 p-8 text-center text-sm text-muted-foreground">
                Select an article from the queue to open the detail drawer.
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
