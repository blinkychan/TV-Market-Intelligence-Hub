import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { ChangeHistoryPanel } from "@/components/audit/change-history";
import { TeamNotesPanel } from "@/components/shared/team-notes-panel";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/badge";
import { getAuditHistory } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import { getCurrentUserContext } from "@/lib/team-auth";
import { getTeamNotes } from "@/lib/team-notes";
import { formatDate, humanize } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function ProjectDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const project = await prisma.project.findUnique({
    where: { id },
    include: {
      buyer: true,
      studio: true,
      productionCompanies: true,
      people: true,
      relationships: { include: { buyer: true, company: true, person: true }, orderBy: { date: "desc" } }
    }
  });

  if (!project) notFound();
  const history = await getAuditHistory("Project", project.id).catch(() => []);
  const notes = await getTeamNotes("Project", project.id).catch(() => []);
  const auth = await getCurrentUserContext();

  return (
    <div className="space-y-6">
      <Link href="/development" className="inline-flex items-center gap-2 text-sm font-medium text-primary hover:underline">
        <ArrowLeft className="h-4 w-4" /> Back to Development Tracker
      </Link>

      <section className="rounded-lg border bg-white p-6 shadow-panel">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-3xl font-semibold tracking-tight">{project.title}</h1>
          <StatusBadge status={project.status} />
        </div>
        <p className="mt-3 max-w-4xl text-muted-foreground">{project.logline ?? "No logline yet."}</p>
        {project.sourceUrl ? (
          <a className="mt-4 inline-flex items-center gap-2 text-sm font-medium text-primary hover:underline" href={project.sourceUrl} target="_blank" rel="noreferrer">
            Source article <ExternalLink className="h-4 w-4" />
          </a>
        ) : null}
      </section>

      <section className="grid gap-6 lg:grid-cols-[2fr_1fr]">
        <Card>
          <CardHeader><CardTitle>Project Details</CardTitle></CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            {[
              ["Type", humanize(project.type)],
              ["Status", humanize(project.status)],
              ["Buyer", project.buyer?.name ?? project.networkOrPlatform ?? "Unknown"],
              ["Studio", project.studio?.name ?? "Unknown"],
              ["Genre", project.genre ?? "Unknown"],
              ["Format", project.format ?? "Unknown"],
              ["Country", project.countryOfOrigin ?? "Unknown"],
              ["Announcement Date", formatDate(project.announcementDate)],
              ["Last Update", formatDate(project.lastUpdateDate)],
              ["Source", project.sourcePublication ?? "Unknown"]
            ].map(([label, value]) => (
              <div key={label}>
                <div className="text-xs font-semibold uppercase text-muted-foreground">{label}</div>
                <div className="mt-1 font-medium">{value}</div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Market Flags</CardTitle></CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex justify-between"><span>Acquisition</span><strong>{project.isAcquisition ? "Yes" : "No"}</strong></div>
            <div className="flex justify-between"><span>Co-production</span><strong>{project.isCoProduction ? "Yes" : "No"}</strong></div>
            <div className="flex justify-between"><span>International</span><strong>{project.isInternational ? "Yes" : "No"}</strong></div>
            <div className="flex justify-between"><span>Needs review</span><strong>{project.needsReview ? "Yes" : "No"}</strong></div>
            <div className="flex justify-between"><span>Confidence</span><strong>{Math.round(project.confidenceScore * 100)}%</strong></div>
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-6 md:grid-cols-3">
        <Card>
          <CardHeader><CardTitle>Production Companies</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            {project.productionCompanies.length ? project.productionCompanies.map((company) => <div key={company.id}>{company.name}</div>) : "None logged"}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>People</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            {project.people.length ? project.people.map((person) => <div key={person.id}>{person.name} · {humanize(person.role)}</div>) : "None logged"}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Relationships</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            {project.relationships.length
              ? project.relationships.map((relationship) => (
                  <div key={relationship.id} className="rounded-md border p-2">
                    <div className="font-medium">{humanize(relationship.relationshipType)}</div>
                    <div className="text-muted-foreground">{formatDate(relationship.date)}</div>
                  </div>
                ))
              : "None logged"}
          </CardContent>
        </Card>
      </section>

      <ChangeHistoryPanel logs={history} emptyText="No project-level changes have been recorded yet." />
      <TeamNotesPanel
        entityType="Project"
        entityId={project.id}
        notes={notes}
        returnPath={`/projects/${project.id}`}
        currentUserEmail={auth.user?.email ?? null}
        canManageAll={auth.canManageUsers || auth.adminUnlocked}
        canWrite
      />
    </div>
  );
}
