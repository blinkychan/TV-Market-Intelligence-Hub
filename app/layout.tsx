import type { Metadata } from "next";
import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import "./globals.css";
import { isAdminSessionValid } from "@/lib/admin-auth";
import { logoutTeamSession } from "@/app/login/actions";
import { FeedbackButton } from "@/components/layout/feedback-button";
import { UsageTracker } from "@/components/layout/usage-tracker";
import { navGroups } from "@/lib/constants";
import { getCurrentUserContext } from "@/lib/team-auth";
import { getUnreadAlertCount } from "@/lib/watchlists";
import { cn } from "@/lib/utils";
import { Bell, Search } from "lucide-react";

export const metadata: Metadata = {
  title: "TV Market Intelligence Hub",
  description: "Local-first entertainment industry intelligence dashboard"
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const pathname = (await headers()).get("x-pathname") ?? "/";
  const adminUnlocked = await isAdminSessionValid();
  const auth = await getCurrentUserContext();
  const unreadAlerts = auth.isAuthenticated ? await getUnreadAlertCount().catch(() => 0) : 0;
  const isPublicRoute = pathname === "/login" || pathname === "/admin/login" || pathname === "/access-denied";
  const canSeeAdminPages = auth.canManageUsers || auth.adminUnlocked;
  const visibleGroups = navGroups
    .map((group) => ({
      ...group,
      items: group.items.filter((item) => !item.adminOnly || canSeeAdminPages)
    }))
    .filter((group) => group.items.length);

  function isActiveNavItem(href: string) {
    if (href === "/") return pathname === "/";
    return pathname === href || pathname.startsWith(`${href}/`) || pathname.startsWith(`${href}?`);
  }

  if (!auth.isAuthenticated) {
    if (!isPublicRoute) {
      redirect(`/login?next=${encodeURIComponent(pathname)}`);
    }

    return (
      <html lang="en">
        <body>
          <div className="min-h-screen bg-background p-4 lg:p-8">{children}</div>
        </body>
      </html>
    );
  }

  if (!auth.isApproved && auth.sessionSource === "supabase") {
    return (
      <html lang="en">
        <body>
          <div className="min-h-screen bg-background">
            <main className="mx-auto flex min-h-screen max-w-3xl items-center p-4 lg:p-8">
              <div className="w-full rounded-lg border bg-white p-8 shadow-panel">
                <p className="text-sm font-semibold uppercase tracking-[0.18em] text-primary">Access Denied</p>
                <h1 className="mt-3 text-3xl font-semibold tracking-tight">Your team role is not set up yet</h1>
                <p className="mt-3 text-muted-foreground">
                  Signed in as {auth.user?.email ?? "unknown user"}. Ask an admin to add your email to the team access list and assign a role.
                </p>
                <div className="mt-6 flex flex-wrap gap-3">
                  <Link href="/access-denied" className="inline-flex h-9 items-center rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground">
                    Review access status
                  </Link>
                  <Link href="/admin/login" className="inline-flex h-9 items-center rounded-md bg-secondary px-3 text-sm font-medium text-secondary-foreground">
                    Admin unlock
                  </Link>
                  <form action={logoutTeamSession}>
                    <button type="submit" className="inline-flex h-9 items-center rounded-md px-3 text-sm font-medium hover:bg-muted">
                      Sign out
                    </button>
                  </form>
                </div>
              </div>
            </main>
          </div>
        </body>
      </html>
    );
  }

  return (
    <html lang="en">
      <body>
        <div className="min-h-screen bg-background">
          <aside className="fixed inset-y-0 left-0 z-20 hidden w-72 border-r bg-slate-950 text-white lg:block">
            <div className="flex h-20 items-center border-b border-white/10 px-6">
              <div>
                <div className="text-sm font-semibold uppercase tracking-[0.18em] text-teal-200">Local Intel</div>
                <div className="text-xl font-semibold">TV Market Hub</div>
              </div>
            </div>
            <nav className="space-y-6 px-3 py-5">
              {visibleGroups.map((group) => (
                <div key={group.label}>
                  <div className="px-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">{group.label}</div>
                  <div className="mt-2 space-y-1">
                    {group.items.map((item) => {
                      const Icon = item.icon;
                      const active = isActiveNavItem(item.href);
                      return (
                        <Link
                          key={item.href}
                          href={item.href}
                          aria-current={active ? "page" : undefined}
                          className={cn(
                            "flex items-center gap-3 rounded-md px-3 py-2.5 text-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950",
                            active
                              ? "bg-white text-slate-950 shadow-sm"
                              : "text-slate-200 hover:bg-white/10 hover:text-white"
                          )}
                        >
                          <Icon className="h-4 w-4" />
                          {item.label}
                        </Link>
                      );
                    })}
                  </div>
                </div>
              ))}
            </nav>
          </aside>
          <div className="lg:pl-72">
            <header className="sticky top-0 z-10 border-b bg-white/90 backdrop-blur">
              <div className="flex min-h-16 items-center justify-between gap-4 px-4 py-3 lg:px-8">
                <div className="lg:hidden">
                  <div className="font-semibold">TV Market Hub</div>
                  <div className="text-xs text-muted-foreground">Executive TV market workflow</div>
                </div>
                <div className="hidden min-w-0 flex-1 items-center gap-2 rounded-md border bg-white px-3 py-2 text-sm text-muted-foreground md:flex">
                  <Search className="h-4 w-4" />
                  Search projects, buyers, companies, people, sources
                </div>
                <div className="flex flex-wrap items-center justify-end gap-2 text-xs text-muted-foreground">
                  <Link
                    href="/alerts"
                    aria-label={unreadAlerts ? `Alerts, ${unreadAlerts} unread` : "Alerts"}
                    className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1 font-medium text-slate-700 ring-1 ring-slate-200"
                  >
                    <Bell className="h-3.5 w-3.5" />
                    Alerts
                    {unreadAlerts ? (
                      <span className="rounded-full bg-rose-100 px-1.5 py-0.5 text-[10px] font-semibold text-rose-700">
                        {unreadAlerts}
                      </span>
                    ) : null}
                  </Link>
                  {auth.user ? (
                    <span className="rounded-full bg-slate-100 px-3 py-1 font-medium text-slate-700 ring-1 ring-slate-200">
                      {auth.user.email}
                    </span>
                  ) : null}
                  {auth.user?.role ? (
                    <span className="rounded-full bg-amber-50 px-3 py-1 font-medium text-amber-800 ring-1 ring-amber-200">
                      {auth.user.role}
                    </span>
                  ) : null}
                  <span className="rounded-full bg-violet-50 px-3 py-1 font-medium text-violet-700 ring-1 ring-violet-200">
                    Beta
                  </span>
                  {auth.sessionSource === "demo" ? (
                    <span className="rounded-full bg-amber-50 px-3 py-1 font-medium text-amber-800 ring-1 ring-amber-200">
                      Demo preview data
                    </span>
                  ) : (
                    <span className="rounded-full bg-emerald-50 px-3 py-1 font-medium text-emerald-700 ring-1 ring-emerald-200">
                      Live database
                    </span>
                  )}
                  {adminUnlocked ? (
                    <span className="rounded-full bg-violet-50 px-3 py-1 font-medium text-violet-700 ring-1 ring-violet-200">
                      Admin unlocked
                    </span>
                  ) : null}
                  {auth.sessionSource === "supabase" ? (
                    <form action={logoutTeamSession}>
                      <button type="submit" className="rounded-full bg-slate-100 px-3 py-1 font-medium text-slate-700 ring-1 ring-slate-200">
                        Log out
                      </button>
                    </form>
                  ) : null}
                </div>
              </div>
              <div className="border-t bg-white px-4 py-2 lg:hidden">
                <nav className="-mx-1 flex gap-2 overflow-x-auto pb-1">
                  {visibleGroups.flatMap((group) => group.items).map((item) => {
                    const Icon = item.icon;
                    const active = isActiveNavItem(item.href);
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        aria-current={active ? "page" : undefined}
                        className={cn(
                          "inline-flex shrink-0 items-center gap-2 rounded-full border px-3 py-2 text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                          active
                            ? "border-primary bg-primary text-primary-foreground"
                            : "bg-white text-slate-700 hover:bg-slate-50"
                        )}
                      >
                        <Icon className="h-4 w-4" />
                        {item.label}
                      </Link>
                    );
                  })}
                </nav>
              </div>
            </header>
            <div className="border-b bg-amber-50 px-4 py-2 text-sm text-amber-900 lg:px-8">
              This is a beta internal tool. Please submit feedback directly in the app so we can keep tightening the workflow.
            </div>
            <main className="executive-grid min-h-[calc(100vh-4rem)] p-4 lg:p-8">{children}</main>
          </div>
          <UsageTracker />
          <FeedbackButton />
        </div>
      </body>
    </html>
  );
}
