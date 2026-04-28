import { notFound } from "next/navigation";
import { PersonDetail } from "@/components/relationships/entity-detail";
import { toRelationshipProject } from "@/lib/relationship-adapters";
import { mockPersonDetails } from "@/lib/mock-relationships";
import { prisma } from "@/lib/prisma";

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
        projects: person.projects.map(toRelationshipProject)
      },
      dataSource: "database" as const
    };
  } catch (error) {
    const mock = mockPersonDetails.find((item) => item.id === id) ?? mockPersonDetails[0] ?? null;
    return { person: mock, dataSource: "mock" as const, errorMessage: error instanceof Error ? error.message : "Unknown database error." };
  }
}

export default async function TalentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { person, dataSource, errorMessage } = await getPerson(id);
  if (!person) notFound();
  return <PersonDetail person={person} dataSource={dataSource} errorMessage={errorMessage} />;
}
