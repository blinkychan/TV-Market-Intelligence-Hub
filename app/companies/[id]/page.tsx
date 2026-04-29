import { notFound } from "next/navigation";
import { CompanyDetail } from "@/components/relationships/entity-detail";
import { getAuditHistory } from "@/lib/audit";
import { mockAuditLogs } from "@/lib/mock-audit";
import { toRelationshipProject } from "@/lib/relationship-adapters";
import { mockCompanyDetails } from "@/lib/mock-relationships";
import { prisma } from "@/lib/prisma";
import { getCurrentUserContext } from "@/lib/team-auth";
import { getTeamNotes } from "@/lib/team-notes";

export const dynamic = "force-dynamic";

async function getCompany(id: string) {
  try {
    const company = await prisma.company.findUnique({
      where: { id },
      include: {
        studioProjects: { include: { buyer: true, studio: true, productionCompanies: true, people: true } },
        productionProjects: { include: { buyer: true, studio: true, productionCompanies: true, people: true } }
      }
    });
    if (!company) {
      const mock = mockCompanyDetails.find((item) => item.id === id);
      return mock ? { company: mock, dataSource: "mock" as const, errorMessage: "Company was not found in SQLite." } : { company: null, dataSource: "mock" as const };
    }
    const projectMap = new Map([...company.studioProjects, ...company.productionProjects].map((project) => [project.id, toRelationshipProject(project)]));
    return {
      company: {
        id: company.id,
        name: company.name,
        type: company.type,
        notes: company.notes,
        projects: Array.from(projectMap.values()),
        changeHistory: await getAuditHistory("Company", company.id).catch(() => []),
        teamNotes: await getTeamNotes("Company", company.id).catch(() => [])
      },
      dataSource: "database" as const
    };
  } catch (error) {
    const mock = mockCompanyDetails.find((item) => item.id === id) ?? mockCompanyDetails[0] ?? null;
    return {
      company: mock ? { ...mock, changeHistory: mockAuditLogs.filter((log) => log.entityType === "Company" && log.entityId === mock.id) } : mock,
      dataSource: "mock" as const,
      errorMessage: error instanceof Error ? error.message : "Unknown database error."
    };
  }
}

export default async function CompanyPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { company, dataSource, errorMessage } = await getCompany(id);
  const auth = await getCurrentUserContext();
  if (!company) notFound();
  return (
    <CompanyDetail
      company={company}
      dataSource={dataSource}
      errorMessage={errorMessage}
      currentUserEmail={auth.user?.email ?? null}
      canManageAllNotes={auth.canManageUsers || auth.adminUnlocked}
      canWriteNotes={dataSource === "database"}
    />
  );
}
