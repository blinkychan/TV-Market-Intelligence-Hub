import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { UserRole } from "@prisma/client";
import { isAdminSessionValid } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";
import { canUseMockPreview } from "@/lib/runtime-mode";

const TEAM_ACCESS_COOKIE = "tvmih_access_token";
const TEAM_REFRESH_COOKIE = "tvmih_refresh_token";

type SupabaseAuthUser = {
  id: string;
  email?: string | null;
};

export type TeamRole = UserRole;

export type CurrentUserContext = {
  authConfigured: boolean;
  sessionSource: "supabase" | "admin_password" | "demo" | "none";
  isAuthenticated: boolean;
  isApproved: boolean;
  adminUnlocked: boolean;
  user: { id: string | null; email: string; role: TeamRole | null } | null;
  canEditContent: boolean;
  canManageIngestion: boolean;
  canManageUsers: boolean;
  accessDeniedReason: string | null;
};

function hasRequiredRole(role: TeamRole | null | undefined, minimumRole: TeamRole) {
  const rank: Record<TeamRole, number> = {
    viewer: 1,
    editor: 2,
    admin: 3
  };

  if (!role) return false;
  return rank[role] >= rank[minimumRole];
}

export function hasSupabaseTeamAuthConfigured() {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim());
}

function getSupabaseConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();

  if (!url || !anonKey) {
    return null;
  }

  return { url, anonKey };
}

async function setTeamSession(accessToken: string, refreshToken: string) {
  const cookieStore = await cookies();
  const secure = process.env.NODE_ENV === "production";

  cookieStore.set(TEAM_ACCESS_COOKIE, accessToken, {
    httpOnly: true,
    sameSite: "lax",
    secure,
    path: "/",
    maxAge: 60 * 60
  });

  cookieStore.set(TEAM_REFRESH_COOKIE, refreshToken, {
    httpOnly: true,
    sameSite: "lax",
    secure,
    path: "/",
    maxAge: 60 * 60 * 24 * 30
  });
}

export async function clearTeamSession() {
  const cookieStore = await cookies();
  const secure = process.env.NODE_ENV === "production";

  cookieStore.set(TEAM_ACCESS_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    secure,
    path: "/",
    maxAge: 0
  });

  cookieStore.set(TEAM_REFRESH_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    secure,
    path: "/",
    maxAge: 0
  });
}

async function fetchSupabaseUser(accessToken: string) {
  const config = getSupabaseConfig();
  if (!config) return null;

  const response = await fetch(`${config.url}/auth/v1/user`, {
    method: "GET",
    headers: {
      apikey: config.anonKey,
      authorization: `Bearer ${accessToken}`
    },
    cache: "no-store"
  }).catch(() => null);

  if (!response?.ok) {
    return null;
  }

  return (await response.json()) as SupabaseAuthUser;
}

async function refreshSupabaseSession(refreshToken: string) {
  const config = getSupabaseConfig();
  if (!config) return null;

  const response = await fetch(`${config.url}/auth/v1/token?grant_type=refresh_token`, {
    method: "POST",
    headers: {
      apikey: config.anonKey,
      "content-type": "application/json"
    },
    body: JSON.stringify({ refresh_token: refreshToken }),
    cache: "no-store"
  }).catch(() => null);

  if (!response?.ok) {
    return null;
  }

  const payload = (await response.json()) as {
    access_token?: string;
    refresh_token?: string;
    user?: SupabaseAuthUser;
  };

  if (!payload.access_token || !payload.refresh_token) {
    return null;
  }

  await setTeamSession(payload.access_token, payload.refresh_token);
  return payload.user ?? (await fetchSupabaseUser(payload.access_token));
}

export async function signInWithSupabasePassword(email: string, password: string) {
  const config = getSupabaseConfig();
  if (!config) {
    throw new Error("Supabase Auth is not configured. Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY first.");
  }

  const response = await fetch(`${config.url}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: {
      apikey: config.anonKey,
      "content-type": "application/json"
    },
    body: JSON.stringify({ email, password }),
    cache: "no-store"
  }).catch(() => null);

  if (!response) {
    throw new Error("Could not reach Supabase Auth. Check your Supabase URL and network access.");
  }

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as { msg?: string; error_description?: string } | null;
    throw new Error(payload?.msg ?? payload?.error_description ?? "Email/password sign-in failed.");
  }

  const payload = (await response.json()) as {
    access_token?: string;
    refresh_token?: string;
    user?: SupabaseAuthUser;
  };

  if (!payload.access_token || !payload.refresh_token || !payload.user?.email) {
    throw new Error("Supabase Auth returned an incomplete session.");
  }

  await setTeamSession(payload.access_token, payload.refresh_token);
  return payload.user;
}

async function getSupabaseSessionUser() {
  const cookieStore = await cookies();
  const accessToken = cookieStore.get(TEAM_ACCESS_COOKIE)?.value;
  const refreshToken = cookieStore.get(TEAM_REFRESH_COOKIE)?.value;

  if (accessToken) {
    const user = await fetchSupabaseUser(accessToken);
    if (user?.email) return user;
  }

  if (refreshToken) {
    const refreshed = await refreshSupabaseSession(refreshToken);
    if (refreshed?.email) return refreshed;
  }

  return null;
}

export async function getCurrentUserContext(): Promise<CurrentUserContext> {
  const authConfigured = hasSupabaseTeamAuthConfigured();
  const adminUnlocked = await isAdminSessionValid().catch(() => false);

  if (!authConfigured) {
    if (adminUnlocked) {
      return {
        authConfigured,
        sessionSource: "admin_password",
        isAuthenticated: true,
        isApproved: true,
        adminUnlocked,
        user: { id: null, email: "Admin password session", role: "admin" },
        canEditContent: true,
        canManageIngestion: true,
        canManageUsers: true,
        accessDeniedReason: null
      };
    }

    if (canUseMockPreview()) {
      return {
        authConfigured,
        sessionSource: "demo",
        isAuthenticated: true,
        isApproved: true,
        adminUnlocked: false,
        user: { id: null, email: "Preview mode", role: "admin" },
        canEditContent: true,
        canManageIngestion: true,
        canManageUsers: true,
        accessDeniedReason: null
      };
    }

    return {
      authConfigured,
      sessionSource: "none",
      isAuthenticated: false,
      isApproved: false,
      adminUnlocked: false,
      user: null,
      canEditContent: false,
      canManageIngestion: false,
      canManageUsers: false,
      accessDeniedReason: "Supabase Auth is not configured."
    };
  }

  const supabaseUser = await getSupabaseSessionUser();

  if (!supabaseUser?.email) {
    if (adminUnlocked) {
      return {
        authConfigured,
        sessionSource: "admin_password",
        isAuthenticated: true,
        isApproved: true,
        adminUnlocked,
        user: { id: null, email: "Admin password session", role: "admin" },
        canEditContent: true,
        canManageIngestion: true,
        canManageUsers: true,
        accessDeniedReason: null
      };
    }

    return {
      authConfigured,
      sessionSource: "none",
      isAuthenticated: false,
      isApproved: false,
      adminUnlocked,
      user: null,
      canEditContent: false,
      canManageIngestion: false,
      canManageUsers: false,
      accessDeniedReason: "No active team session."
    };
  }

  const profile = await prisma.userProfile.findUnique({ where: { email: supabaseUser.email } }).catch(() => null);

  if (!profile) {
    return {
      authConfigured,
      sessionSource: "supabase",
      isAuthenticated: true,
      isApproved: false,
      adminUnlocked,
      user: { id: supabaseUser.id, email: supabaseUser.email, role: null },
      canEditContent: false,
      canManageIngestion: false,
      canManageUsers: false,
      accessDeniedReason: "Your account is valid, but no approved team role has been assigned yet."
    };
  }

  return {
    authConfigured,
    sessionSource: "supabase",
    isAuthenticated: true,
    isApproved: true,
    adminUnlocked,
    user: { id: supabaseUser.id, email: profile.email, role: profile.role },
    canEditContent: hasRequiredRole(profile.role, "editor"),
    canManageIngestion: profile.role === "admin" || adminUnlocked,
    canManageUsers: profile.role === "admin" || adminUnlocked,
    accessDeniedReason: null
  };
}

export async function requireEditorActionAccess() {
  const context = await getCurrentUserContext();

  if (context.adminUnlocked) return context;
  if (!context.isAuthenticated) redirect("/login");
  if (!context.isApproved || !context.canEditContent) redirect("/access-denied");

  return context;
}

export async function requireAdminCapabilityAccess() {
  const context = await getCurrentUserContext();

  if (context.adminUnlocked) return context;
  if (!context.isAuthenticated) redirect("/login");
  if (!context.isApproved || !context.canManageUsers) redirect("/access-denied");

  return context;
}

export async function requireViewerPageAccess(nextPath = "/") {
  const context = await getCurrentUserContext();

  if (!context.isAuthenticated) {
    redirect(`/login?next=${encodeURIComponent(nextPath)}`);
  }

  return context;
}

export async function requireApprovedTeamAccess() {
  const context = await getCurrentUserContext();

  if (context.adminUnlocked) return context;
  if (!context.isAuthenticated) redirect("/login");
  if (!context.isApproved) redirect("/access-denied");

  return context;
}
