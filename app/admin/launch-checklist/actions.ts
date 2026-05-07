"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdminCapabilityAccess } from "@/lib/team-auth";

export async function runLaunchChecksAction() {
  await requireAdminCapabilityAccess();
  revalidatePath("/admin/launch-checklist");
  redirect(`/admin/launch-checklist?checked=${Date.now()}`);
}

