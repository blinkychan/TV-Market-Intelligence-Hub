import { createHash, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

const ADMIN_COOKIE_NAME = "tvmih_admin_session";

function hashAdminPassword(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function safeCompare(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);

  if (leftBuffer.length !== rightBuffer.length) {
    return false;
  }

  return timingSafeEqual(leftBuffer, rightBuffer);
}

export function hasAdminPasswordConfigured() {
  return Boolean(process.env.ADMIN_PASSWORD?.trim());
}

export async function isAdminSessionValid() {
  const expectedPassword = process.env.ADMIN_PASSWORD?.trim();
  if (!expectedPassword) return false;

  const cookieStore = await cookies();
  const currentToken = cookieStore.get(ADMIN_COOKIE_NAME)?.value;
  if (!currentToken) return false;

  return safeCompare(currentToken, hashAdminPassword(expectedPassword));
}

export async function setAdminSession() {
  const expectedPassword = process.env.ADMIN_PASSWORD?.trim();
  if (!expectedPassword) {
    throw new Error("ADMIN_PASSWORD is not configured.");
  }

  const cookieStore = await cookies();
  cookieStore.set(ADMIN_COOKIE_NAME, hashAdminPassword(expectedPassword), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 12
  });
}

export async function clearAdminSession() {
  const cookieStore = await cookies();
  cookieStore.set(ADMIN_COOKIE_NAME, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0
  });
}

export async function requireAdminPageAccess(nextPath = "/admin/status") {
  if (!(await isAdminSessionValid())) {
    redirect(`/admin/login?next=${encodeURIComponent(nextPath)}`);
  }
}

export async function requireAdminActionAccess() {
  if (!(await isAdminSessionValid())) {
    redirect("/admin/login");
  }
}
