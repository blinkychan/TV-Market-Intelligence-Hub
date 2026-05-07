import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

const TEAM_ACCESS_COOKIE = "tvmih_access_token";
const TEAM_REFRESH_COOKIE = "tvmih_refresh_token";
const ADMIN_COOKIE_NAME = "tvmih_admin_session";

function isPublicPath(pathname: string) {
  return (
    pathname === "/login" ||
    pathname === "/access-denied" ||
    pathname === "/admin/login" ||
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon") ||
    pathname.startsWith("/api/cron/")
  );
}

function hasSupabaseAuthConfigured() {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim());
}

export function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-pathname", pathname);
  requestHeaders.set("x-search", search);

  if (isPublicPath(pathname)) {
    return NextResponse.next({ request: { headers: requestHeaders } });
  }

  const isProduction = process.env.NODE_ENV === "production" || process.env.VERCEL_ENV === "production";
  const authConfigured = hasSupabaseAuthConfigured();
  const hasTeamSession = Boolean(request.cookies.get(TEAM_ACCESS_COOKIE)?.value || request.cookies.get(TEAM_REFRESH_COOKIE)?.value);
  const hasAdminSession = Boolean(request.cookies.get(ADMIN_COOKIE_NAME)?.value);

  if (!authConfigured && !isProduction) {
    return NextResponse.next({ request: { headers: requestHeaders } });
  }

  if (hasTeamSession || hasAdminSession) {
    return NextResponse.next({ request: { headers: requestHeaders } });
  }

  const loginUrl = new URL("/login", request.url);
  loginUrl.searchParams.set("next", `${pathname}${search}`);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ["/((?!.*\\..*).*)"]
};
