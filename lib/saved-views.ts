import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getCurrentUserContext } from "@/lib/team-auth";

export type SavedViewRecord = {
  id: string;
  name: string;
  description: string | null;
  pageType: string;
  filtersJson: Prisma.JsonValue | null;
  sortJson: Prisma.JsonValue | null;
  columnsJson: Prisma.JsonValue | null;
  visibility: "private" | "team";
  createdByUserId: string | null;
  createdByEmail: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export async function getSavedViewsForPage(pageType: string) {
  const auth = await getCurrentUserContext();
  const email = auth.user?.email ?? null;

  return prisma.savedView.findMany({
    where: {
      pageType,
      OR: [
        { visibility: "team" },
        ...(email ? [{ createdByEmail: email }] : [])
      ]
    },
    orderBy: [{ visibility: "desc" }, { updatedAt: "desc" }]
  }).catch(() => []);
}
