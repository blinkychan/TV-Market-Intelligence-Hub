import { notFound } from "next/navigation";
import { PersonDetail } from "@/components/relationships/entity-detail";
import { getAuditHistory } from "@/lib/audit";
import { mockAuditLogs } from "@/lib/mock-audit";
import { toRelationshipProject } from "@/lib/relationship-adapters";
import { mockPersonDetails } from "@/lib/mock-relationships";
import { prisma } from "@/lib/prisma";
import { getCurrentUserContext } from "@/lib/team-auth";
import { getTeamNotes } from "@/lib/team-notes";

export const dynamic = "force-dynamic";

async function getPerson(id: string) {
  try {
    const person = await prisma.person.findUnique({
      where: { id },
      include: { projects: { include: { buyer: true, studio: true, productionCompanies: true, people: true } } }
    });
    if (!person) {
      const mock = mockPersonDetails.find((item) => item.id === id);
      return mock ? { person: mock, dataSource: "mock" as const, errorMessage: "Person was not found in SQLite." } : { person: null, dataSource: "mock" as const };
    }
    return {
      person: {
        id: person.id,
        name: person.name,
        role: person.role,
        company: person.company,
        reps: person.reps,
        notes: person.notes,
        projects: person.projects.map(toRelationshipProject),
        changeHistory: await getAuditHistory("Person", person.id).catch(() => []),
        teamNotes: await getTeamNotes("Person", person.id).catch(() => [])
      },
      dataSource: "database" as const
    };
  } catch (error) {
    const mock = mockPersonDetails.find((item) => item.id === id) ?? mockPersonDetails[0] ?? null;
    return {
      person: mock ? { ...mock, changeHistory: mockAuditLogs.filter((log) => log.entityType === "Person" && log.entityId === mock.id) } : mock,
      dataSource: "mock" as const,
      errorMessage: error instanceof Error ? error.message : "Unknown database error."
    };
  }
}

export default async function TalentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { person, dataSource, errorMessage } = await getPerson(id);
  const auth = await getCurrentUserContext();
  if (!person) notFound();
  return (
    <PersonDetail
      person={person}
      dataSource={dataSource}
      errorMessage={errorMessage}
      currentUserEmail={auth.user?.email ?? null}
      canManageAllNotes={auth.canManageUsers || auth.adminUnlocked}
      canWriteNotes={dataSource === "database"}
    />
  );
}
