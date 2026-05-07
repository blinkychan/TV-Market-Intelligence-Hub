"use server";

import { redirect } from "next/navigation";
import { clearTeamSession, signInWithSupabasePassword } from "@/lib/team-auth";

export async function loginWithTeamAuth(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const nextPath = String(formData.get("next") ?? "/");

  if (!email || !password) {
    redirect(`/login?next=${encodeURIComponent(nextPath)}&error=missing`);
  }

  try {
    await signInWithSupabasePassword(email, password);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Team login failed.";
    redirect(`/login?next=${encodeURIComponent(nextPath)}&error=${encodeURIComponent(message)}`);
  }

  redirect(nextPath.startsWith("/") ? nextPath : "/");
}

export async function logoutTeamSession() {
  await clearTeamSession();
  redirect("/login");
}

