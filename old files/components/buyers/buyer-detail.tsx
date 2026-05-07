"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { BreakdownBars } from "@/components/charts/breakdown-bars";
import { TeamNotesPanel } from "@/components/shared/team-notes-panel";
import { ChangeHistoryPanel } from "@/components/audit/change-history";
import { Badge, StatusBadge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select } from "@/components/ui/input";
import type { BuyerDetailData, BuyerProject } from "@/components/buyers/types";
import { formatDate, humanize } from "@/lib/utils";

function unique(values: Array<string | null>) {
  return Array.from(new Set(values.filter(Boolean) as string[])).sort();
}

function countBy(values: string[]) {
  const map = new Map<string, number>();
  values.forEach((value) => map.set(value, (map.get(value) ?? 0) + 1));
  return Array.from(map.entries()).map(([label, count]) => ({ label, count })).sort((a, b) => b.count - a.count);
}

function booleanFilter(value: boolean, filter: string) {
  if (filter === "yes") return value;
  if (filter === "no") return !value;
  return true;
}

export function BuyerDetail({
  buyer,
  dataSource,
  errorMessage,
  currentUserEmail,
  canManageAllNotes,
  canWriteNotes
}: {
  buyer: BuyerDetailData;
  dataSource: "database" | "mock";
  errorMessage?: string;
  currentUserEmail: string | null;
  canManageAllNotes: boolean;
  canWriteNotes: boolean;
}) {
  const [year, setYear] = useState("all");
  const [status, setStatus] = useState("all");
  const [genre, setGenre] = useState("all");
  const [studio, setStudio] = useState("all");
  const [company, setCompany] = useState("all");
  const [international, setInternational] = useState("all");
  const [acquisition, setAcquisition] = useState("all");
  const [coProduction, setCoProduction] = useState("all");

  const since2023 = buyer.projects.filter((project) => !project.announcementDate || new Date(project.announcementDate).getFullYear() >= 2023);
  const filteredProjects = useMemo(
    () =>
      since2023.filter((project) => {
        if (year !== "all" && new Date(project.announcementDate ?? "").getFullYear().toString() !== year) return false;
        if (status !== "all" && project.status !== status) return false;
        if (genre !== "all" && project.genre !== genre) return false;
        if (studio !== "all" && project.studio !== studio) return false;
        if (company !== "all" && !project.productionCompanies.includes(company)) return false;
        if (!booleanFilter(project.isInternational, international)) return false;
        if (!booleanFilter(project.isAcquisition, acquisition)) return false;
        if (!booleanFilter(project.isCoProduction, coProduction)) return false;
        return true;
      }),
    [since2023, year, status, genre, studio, company, international, acquisition, coProduction]
  );

  const studios = unique(since2023.map((project) => project.studio));
  const companies = Array.from(new Set(since2023.flatMap((project) => project.productionCompanies))).sort();
  const people = Array.from(new Set(since2023.flatMap((project) => project.people))).sort();
  const genres = unique(since2023.map((project) => project.genre));
  const statuses = unique(since2023.map((project) => project.status));
  const years = unique(since2023.map((project) => (project.announcementDate ? new Date(project.announcementDate).getFullYear().toString() : null))).sort(
    (a, b) => Number(b) - Number(a)
  );

  const acquisitions = filteredProjects.filter((project) => project.isAcquisition);
  const internationalProjects = filteredProjects.filter((project) => project.isInternational || project.isCoProduction);
  const staleProjects = filteredProjects.filter((project) => project.status === "stale");

  return (
    <div className="space-y-6">
      <Link href="/buyers" className="inline-flex items-center gap-2 text-sm font-medium text-primary hover:underline">
        <ArrowLeft className="h-4 w-4" /> Back to Buyers
      </Link>

      <section className="rounded-lg border bg-white p-6 shadow-panel">
        <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-start">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-primary">Buyer Profile</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight">{buyer.name}</h1>
            <p className="mt-2 text-muted-foreground">{humanize(buyer.type)} · {buyer.parentCompany ?? "Independent"}</p>
            <p className="mt-3 max-w-3xl text-sm text-muted-foreground">{buyer.notes ?? "No buyer notes yet."}</p>
          </div>
          <Badge className={dataSource === "database" ? "bg-emerald-50 text-emerald-700 ring-emerald-200" : "bg-amber-50 text-amber-800 ring-amber-200"}>
            Data Source: {dataSource === "database" ? "Database" : "Mock Preview Data"}
          </Badge>
        </div>
        {errorMessage ? (
          <div className="mt-4 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
            Database unavailable, showing mock preview data. Detail: {errorMessage}
          </div>
        ) : null}
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <SummaryCard label="Development Since 2023" value={since2023.length} />
        <SummaryCard label="Current Shows" value={buyer.currentShows.length} />
        <SummaryCard label="Acquisitions" value={acquisitions.length} />
        <SummaryCard label="Intl / Co-Pro" value={internationalProjects.length} />
        <SummaryCard label="Stale Projects" value={staleProjects.length} />
      </section>

      <Card className="shadow-panel">
        <CardHeader><CardTitle>Filters</CardTitle></CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-4 xl:grid-cols-8">
          <Select value={year} onChange={(event) => setYear(event.target.value)}><option value="all">All years</option>{years.map((item) => <option key={item} value={item}>{item}</option>)}</Select>
          <Select value={status} onChange={(event) => setStatus(event.target.value)}><option value="all">All statuses</option>{statuses.map((item) => <option key={item} value={item}>{humanize(item)}</option>)}</Select>
          <Select value={genre} onChange={(event) => setGenre(event.target.value)}><option value="all">All genres</option>{genres.map((item) => <option key={item} value={item}>{item}</option>)}</Select>
          <Select value={studio} onChange={(event) => setStudio(event.target.value)}><option value="all">All studios</option>{studios.map((item) => <option key={item} value={item}>{item}</option>)}</Select>
          <Select value={company} onChange={(event) => setCompany(event.target.value)}><option value="all">All prodcos</option>{companies.map((item) => <option key={item} value={item}>{item}</option>)}</Select>
          <Select value={international} onChange={(event) => setInternational(event.target.value)}><option value="all">International: All</option><option value="yes">International: Yes</option><option value="no">International: No</option></Select>
          <Select value={acquisition} onChange={(event) => setAcquisition(event.target.value)}><option value="all">Acquisition: All</option><option value="yes">Acquisition: Yes</option><option value="no">Acquisition: No</option></Select>
          <Select value={coProduction} onChange={(event) => setCoProduction(event.target.value)}><option value="all">Co-pro: All</option><option value="yes">Co-pro: Yes</option><option value="no">Co-pro: No</option></Select>
        </CardContent>
      </Card>

      <section className="grid gap-6 xl:grid-cols-3">
        <Card className="shadow-panel"><CardHeader><CardTitle>Genre Activity</CardTitle></CardHeader><CardContent><BreakdownBars items={countBy(filteredProjects.map((project) => project.genre ?? "Unknown"))} /></CardContent></Card>
        <Card className="shadow-panel"><CardHeader><CardTitle>Project Status</CardTitle></CardHeader><CardContent><BreakdownBars items={countBy(filteredProjects.map((project) => humanize(project.status)))} /></CardContent></Card>
        <Card className="shadow-panel"><CardHeader><CardTitle>Studio / Company Relationships</CardTitle></CardHeader><CardContent><BreakdownBars items={countBy([...filteredProjects.map((project) => project.studio ?? "Unknown studio"), ...filteredProjects.flatMap((project) => project.productionCompanies)])} /></CardContent></Card>
      </section>

      <section className="grid gap-6 xl:grid-cols-[2fr_1fr]">
        <Card className="shadow-panel">
          <CardHeader><CardTitle>Development Projects Since 2023</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {filteredProjects.length ? filteredProjects.map((project) => <ProjectCard key={project.id} project={project} />) : <EmptyState text="No projects match the current filters." />}
          </CardContent>
        </Card>
        <div className="space-y-6">
          <Card className="shadow-panel"><CardHeader><CardTitle>Current Shows</CardTitle></CardHeader><CardContent className="space-y-3">{buyer.currentShows.length ? buyer.currentShows.map((show) => <div key={show.id} className="rounded-md border p-3"><div className="font-medium">{show.title}</div><div className="text-sm text-muted-foreground">{show.status} · {formatDate(show.premiereDate)}</div></div>) : <EmptyState text="No current shows logged." />}</CardContent></Card>
          <Card className="shadow-panel"><CardHeader><CardTitle>Studios</CardTitle></CardHeader><CardContent className="text-sm">{studios.join(", ") || "None logged"}</CardContent></Card>
          <Card className="shadow-panel"><CardHeader><CardTitle>Production Companies</CardTitle></CardHeader><CardContent className="text-sm">{companies.join(", ") || "None logged"}</CardContent></Card>
          <Card className="shadow-panel"><CardHeader><CardTitle>People / Talent</CardTitle></CardHeader><CardContent className="text-sm">{people.join(", ") || "None logged"}</CardContent></Card>
        </div>
      </section>

      <ChangeHistoryPanel title="Buyer Change History" logs={buyer.changeHistory ?? []} emptyText="No buyer-level change history has been logged yet." />
      <TeamNotesPanel
        entityType="Buyer"
        entityId={buyer.id}
        notes={buyer.teamNotes ?? []}
        returnPath={`/buyers/${buyer.id}`}
        currentUserEmail={currentUserEmail}
        canManageAll={canManageAllNotes}
        canWrite={canWriteNotes}
      />
    </div>
  );
}

function SummaryCard({ label, value }: { label: string; value: number }) {
  return (
    <Card className="shadow-panel">
      <CardHeader><CardTitle className="text-sm text-muted-foreground">{label}</CardTitle></CardHeader>
      <CardContent><div className="text-3xl font-semibold">{value}</div></CardContent>
    </Card>
  );
}

function ProjectCard({ project }: { project: BuyerProject }) {
  return (
    <div className="rounded-md border p-4">
      <div className="flex flex-wrap items-center gap-2">
        <Link href={`/projects/${project.id}`} className="font-semibold text-primary hover:underline">{project.title}</Link>
        <StatusBadge status={project.status} />
        {project.isAcquisition ? <Badge className="bg-orange-50 text-orange-700 ring-orange-200">Acquisition</Badge> : null}
        {project.isInternational || project.isCoProduction ? <Badge className="bg-sky-50 text-sky-700 ring-sky-200">Intl / Co-Pro</Badge> : null}
      </div>
      <div className="mt-2 text-sm text-muted-foreground">{project.genre ?? "Genre TBD"} · {project.studio ?? "Studio TBD"} · {formatDate(project.announcementDate)}</div>
      <div className="mt-2 text-sm">Talent: {project.people.join(", ") || "None logged"}</div>
      {project.sourceUrl ? <a className="mt-2 inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline" href={project.sourceUrl} target="_blank" rel="noreferrer">Source <ExternalLink className="h-3.5 w-3.5" /></a> : null}
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return <div className="rounded-md border border-dashed bg-slate-50 p-5 text-center text-sm text-muted-foreground">{text}</div>;
}
