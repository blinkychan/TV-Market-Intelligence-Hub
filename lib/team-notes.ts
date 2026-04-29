import { prisma } from "@/lib/prisma";

export type TeamNoteRecord = {
  id: string;
  entityType: string;
  entityId: string;
  note: string;
  tags: string | null;
  includeInNextWeeklyReport: boolean;
  createdByUserId: string | null;
  createdByEmail: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export async function getTeamNotes(entityType: string, entityId: string) {
  return prisma.teamNote.findMany({
    where: { entityType, entityId },
    orderBy: { updatedAt: "desc" }
  }).catch(() => []);
}
