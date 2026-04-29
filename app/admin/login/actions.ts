"use server";

import { redirect } from "next/navigation";
import { clearAdminSession, setAdminSession } from "@/lib/admin-auth";

export async function loginWithAdminPassword(formData: FormData) {
  const submittedPassword = String(formData.get("password") ?? "");
  const nextPath = String(formData.get("next") ?? "/admin/status");
  const expectedPassword = process.env.ADMIN_PASSWORD?.trim();

  if (!expectedPassword || submittedPassword !== expectedPassword) {
    redirect(`/admin/login?next=${encodeURIComponent(nextPath)}&error=invalid`);
  }

  await setAdminSession();
  redirect(nextPath.startsWith("/") ? nextPath : "/admin/status");
}

export async function logoutAdmin() {
  await clearAdminSession();
  redirect("/admin/login");
}
