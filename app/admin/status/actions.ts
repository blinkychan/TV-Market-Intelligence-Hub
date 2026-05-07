"use server";

import { revalidatePath } from "next/cache";
import { UserRole } from "@prisma/client";
import { requireAdminCapabilityAccess } from "@/lib/team-auth";
import { prisma } from "@/lib/prisma";

function normalizeRole(value: FormDataEntryValue | null) {
  const role = String(value ?? "").trim();
  if (role === UserRole.admin || role === UserRole.editor || role === UserRole.viewer) {
    return role;
  }

  return UserRole.viewer;
}

export async function saveUserProfileAction(formData: FormData) {
  await requireAdminCapabilityAccess();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const role = normalizeRole(formData.get("role"));

  if (!email) return;

  await prisma.userProfile.upsert({
    where: { email },
    update: { role },
    create: { email, role }
  }).catch(() => {});

  revalidatePath("/admin/status");
}

