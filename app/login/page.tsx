import Link from "next/link";
import { LockKeyhole } from "lucide-react";
import { loginWithTeamAuth } from "./actions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getCurrentUserContext, hasSupabaseTeamAuthConfigured } from "@/lib/team-auth";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{ next?: string; error?: string }>;

export default async function LoginPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const nextPath = params.next && params.next.startsWith("/") ? params.next : "/";
  const auth = await getCurrentUserContext();
  const supabaseConfigured = hasSupabaseTeamAuthConfigured();

  if (auth.isAuthenticated && auth.isApproved && auth.sessionSource !== "demo") {
    return (
      <div className="mx-auto flex min-h-[70vh] max-w-xl items-center">
        <Card className="w-full shadow-panel">
          <CardHeader>
            <CardTitle className="text-2xl">You’re already signed in</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Signed in as {auth.user?.email ?? "team member"} with {auth.user?.role ?? "viewer"} access.
            </p>
            <Link href={nextPath} className="inline-flex h-9 items-center rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground">
              Continue
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto flex min-h-[70vh] max-w-xl items-center">
      <Card className="w-full shadow-panel">
        <CardHeader className="space-y-3">
          <div className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-slate-100 text-slate-700">
            <LockKeyhole className="h-5 w-5" />
          </div>
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-primary">Team Access</p>
            <CardTitle className="mt-2 text-2xl">Sign in to TV Market Intelligence Hub</CardTitle>
          </div>
          <p className="text-sm text-muted-foreground">
            Use your Supabase Auth email and password. Team roles are assigned separately so the app can keep ingestion, review, and admin controls appropriately scoped.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          {!supabaseConfigured ? (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
              Supabase Auth is not configured yet. Add <code>NEXT_PUBLIC_SUPABASE_URL</code> and <code>NEXT_PUBLIC_SUPABASE_ANON_KEY</code> before using hosted team login.
            </div>
          ) : null}

          {params.error ? (
            <div className="rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm text-rose-900">
              {params.error === "missing" ? "Enter both email and password." : params.error}
            </div>
          ) : null}

          <form action={loginWithTeamAuth} className="space-y-3">
            <input type="hidden" name="next" value={nextPath} />
            <Input name="email" type="email" placeholder="you@company.com" disabled={!supabaseConfigured} />
            <Input name="password" type="password" placeholder="Password" disabled={!supabaseConfigured} />
            <Button type="submit" className="w-full" disabled={!supabaseConfigured}>
              Sign in
            </Button>
          </form>

          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Need the temporary operations unlock instead?</span>
            <Link href={`/admin/login?next=${encodeURIComponent(nextPath)}`} className="text-primary hover:underline">
              Admin password
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
