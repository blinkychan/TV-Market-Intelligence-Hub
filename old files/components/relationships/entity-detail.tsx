import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { ChangeHistoryPanel } from "@/components/audit/change-history";
import { BreakdownBars } from "@/components/charts/breakdown-bars";
import { TeamNotesPanel } from "@/components/shared/team-notes-panel";
import { Badge, StatusBadge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { CompanyDetailData, PersonDetailData, RelationshipProject } from "@/components/relationships/types";
import { formatDate, humanize } from "@/lib/utils";

function countBy(values: string[]) {
  const map = new Map<string, number>();
  values.forEach((value) => map.set(value, (map.get(value) ?? 0) + 1));
  return Array.from(map.entries()).map(([label, count]) => ({ label, count })).sort((a, b) => b.count - a.count);
}

export function CompanyDetail({
  company,
  dataSource,
  errorMessage,
  currentUserEmail,
  canManageAllNotes,
  canWriteNotes
}: {
  company: CompanyDetailData;
  dataSource: "database" | "mock";
  errorMessage?: string;
  currentUserEmail: string | null;
  canManageAllNotes: boolean;
  canWriteNotes: boolean;
}) {
  const buyers = Array.from(new Set(company.projects.map((project) => project.buyer).filter(Boolean) as string[]));
  const people = Array.from(new Set(company.projects.flatMap((project) => project.people.map((person) => person.name))));
  const acqCoPro = company.projects.filter((project) => project.isAcquisition || project.isCoProduction).length;

  return (
    <EntityFrame backHref="/companies" eyebrow="Company Profile" title={company.name} subtitle={humanize(company.type)} dataSource={dataSource} errorMessage={errorMessage}>
      <SummaryCards items={[["Projects", company.projects.length], ["Buyers", buyers.length], ["People", people.length], ["Acq / Co-Pro", acqCoPro]]} />
      <section className="grid gap-6 xl:grid-cols-3">
        <Card className="shadow-panel"><CardHeader><CardTitle>Genre Breakdown</CardTitle></CardHeader><CardContent><BreakdownBars items={countBy(company.projects.map((project) => project.genre ?? "Unknown"))} /></CardContent></Card>
        <Card className="shadow-panel"><CardHeader><CardTitle>Status Breakdown</CardTitle></CardHeader><CardContent><BreakdownBars items={countBy(company.projects.map((project) => humanize(project.status)))} /></CardContent></Card>
        <Card className="shadow-panel"><CardHeader><CardTitle>Buyers They Work With</CardTitle></CardHeader><CardContent className="text-sm">{buyers.join(", ") || "None logged"}</CardContent></Card>
      </section>
      <ProjectTimeline projects={company.projects} />
      <ChangeHistoryPanel title="Company Change History" logs={company.changeHistory ?? []} emptyText="No company-level history has been logged yet." />
      <TeamNotesPanel
        entityType="Company"
        entityId={company.id}
        notes={company.teamNotes ?? []}
        returnPath={`/companies/${company.id}`}
        currentUserEmail={currentUserEmail}
        canManageAll={canManageAllNotes}
        canWrite={canWriteNotes}
      />
    </EntityFrame>
  );
}

export function PersonDetail({
  person,
  dataSource,
  errorMessage,
  currentUserEmail,
  canManageAllNotes,
  canWriteNotes
}: {
  person: PersonDetailData;
  dataSource: "database" | "mock";
  errorMessage?: string;
  currentUserEmail: string | null;
  canManageAllNotes: boolean;
  canWriteNotes: boolean;
}) {
  const buyers = Array.from(new Set(person.projects.map((project) => project.buyer).filter(Boolean) as string[]));
  const companies = Array.from(new Set(person.projects.flatMap((project) => [project.studio, ...project.productionCompanies.map((company) => company.name)]).filter(Boolean) as string[]));

  return (
    <EntityFrame backHref="/companies" eyebrow="Talent Profile" title={person.name} subtitle={`${humanize(person.role)} · ${[person.company, person.reps].filter(Boolean).join(" / ") || "No company or reps logged"}`} dataSource={dataSource} errorMessage={errorMessage}>
      <SummaryCards items={[["Projects", person.projects.length], ["Buyers", buyers.length], ["Companies", companies.length], ["Roles", 1]]} />
      <section className="grid gap-6 xl:grid-cols-3">
        <Card className="shadow-panel"><CardHeader><CardTitle>Role Breakdown</CardTitle></CardHeader><CardContent><BreakdownBars items={[{ label: humanize(person.role), count: person.projects.length }]} /></CardContent></Card>
        <Card className="shadow-panel"><CardHeader><CardTitle>Buyers They Work With</CardTitle></CardHeader><CardContent className="text-sm">{buyers.join(", ") || "None logged"}</CardContent></Card>
        <Card className="shadow-panel"><CardHeader><CardTitle>Companies / Studios</CardTitle></CardHeader><CardContent className="text-sm">{companies.join(", ") || "None logged"}</CardContent></Card>
      </section>
      <ProjectTimeline projects={person.projects} />
      <ChangeHistoryPanel title="Person Change History" logs={person.changeHistory ?? []} emptyText="No people/talent history has been logged yet." />
      <TeamNotesPanel
        entityType="Person"
        entityId={person.id}
        notes={person.teamNotes ?? []}
        returnPath={`/talent/${person.id}`}
        currentUserEmail={currentUserEmail}
        canManageAll={canManageAllNotes}
        canWrite={canWriteNotes}
      />
    </EntityFrame>
  );
}

function EntityFrame({ backHref, eyebrow, title, subtitle, dataSource, errorMessage, children }: { backHref: string; eyebrow: string; title: string; subtitle: string; dataSource: "database" | "mock"; errorMessage?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-6">
      <Link href={backHref} className="inline-flex items-center gap-2 text-sm font-medium text-primary hover:underline"><ArrowLeft className="h-4 w-4" /> Back to Companies & Talent</Link>
      <section className="rounded-lg border bg-white p-6 shadow-panel">
        <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-start">
          <div><p className="text-sm font-semibold uppercase tracking-[0.2em] text-primary">{eyebrow}</p><h1 className="mt-2 text-3xl font-semibold tracking-tight">{title}</h1><p className="mt-2 text-muted-foreground">{subtitle}</p></div>
          <Badge className={dataSource === "database" ? "bg-emerald-50 text-emerald-700 ring-emerald-200" : "bg-amber-50 text-amber-800 ring-amber-200"}>Data Source: {dataSource === "database" ? "Database" : "Mock Preview Data"}</Badge>
        </div>
        {errorMessage ? <div className="mt-4 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">Database unavailable, showing mock preview data. Detail: {errorMessage}</div> : null}
      </section>
      {children}
    </div>
  );
}

function SummaryCards({ items }: { items: [string, number][] }) {
  return <section className="grid gap-4 md:grid-cols-4">{items.map(([label, value]) => <Card key={label} className="shadow-panel"><CardHeader><CardTitle className="text-sm text-muted-foreground">{label}</CardTitle></CardHeader><CardContent><div className="text-3xl font-semibold">{value}</div></CardContent></Card>)}</section>;
}

function ProjectTimeline({ projects }: { projects: RelationshipProject[] }) {
  const sorted = projects.slice().sort((a, b) => new Date(b.announcementDate ?? 0).getTime() - new Date(a.announcementDate ?? 0).getTime());
  return (
    <Card className="shadow-panel">
      <CardHeader><CardTitle>Timeline of Activity</CardTitle></CardHeader>
      <CardContent className="space-y-3">
        {sorted.length ? sorted.map((project) => (
          <div key={project.id} className="rounded-md border p-4">
            <div className="flex flex-wrap items-center gap-2">
              {project.id.startsWith("mock-") ? (
                <span className="font-semibold">{project.title}</span>
              ) : (
                <Link className="font-semibold text-primary hover:underline" href={`/projects/${project.id}`}>{project.title}</Link>
              )}
              <StatusBadge status={project.status} />
              {project.isAcquisition ? <Badge className="bg-orange-50 text-orange-700 ring-orange-200">Acq</Badge> : null}
              {project.isCoProduction ? <Badge className="bg-sky-50 text-sky-700 ring-sky-200">Co-Pro</Badge> : null}
            </div>
            <div className="mt-2 text-sm text-muted-foreground">{formatDate(project.announcementDate)} · {project.buyer ?? "Unknown buyer"} · {project.genre ?? "Genre TBD"}</div>
          </div>
        )) : <div className="rounded-md border border-dashed bg-slate-50 p-5 text-center text-sm text-muted-foreground">No project activity logged.</div>}
      </CardContent>
    </Card>
  );
}
