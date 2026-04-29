import Link from "next/link";
import { Shield } from "lucide-react";
import { loginWithAdminPassword } from "./actions";
import { hasAdminPasswordConfigured, isAdminSessionValid } from "@/lib/admin-auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{ next?: string; error?: string }>;

export default async function AdminLoginPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const nextPath = params.next && params.next.startsWith("/") ? params.next : "/admin/status";
  const hasPassword = hasAdminPasswordConfigured();
  const alreadyAuthed = await isAdminSessionValid();

  return (
    <div className="mx-auto flex min-h-[70vh] max-w-xl items-center">
      <Card className="w-full shadow-panel">
        <CardHeader className="space-y-3">
          <div className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-slate-100 text-slate-700">
            <Shield className="h-5 w-5" />
          </div>
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-primary">Admin Access</p>
            <CardTitle className="mt-2 text-2xl">Production controls</CardTitle>
          </div>
          <p className="text-sm text-muted-foreground">
            Use the shared admin password to unlock status checks, ingestion controls, backfill controls, and protected review actions.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          {!hasPassword ? (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
              <code>ADMIN_PASSWORD</code> is not configured yet. Add it to your local or Vercel environment settings before using hosted admin controls.
            </div>
          ) : null}

          {params.error === "invalid" ? (
            <div className="rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm text-rose-900">
              That password did not match. Double-check the shared admin secret and try again.
            </div>
          ) : null}

          {alreadyAuthed ? (
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
              You already have an active admin session. Continue to the status page.
            </div>
          ) : null}

          <form action={loginWithAdminPassword} className="space-y-3">
            <input type="hidden" name="next" value={nextPath} />
            <Input name="password" type="password" placeholder="Shared admin password" disabled={!hasPassword} />
            <Button type="submit" className="w-full" disabled={!hasPassword}>
              Unlock admin controls
            </Button>
          </form>

          <div className="flex items-center justify-between text-sm">
            <Link href="/" className="text-primary hover:underline">
              Back to dashboard
            </Link>
            <Link href={nextPath} className="text-muted-foreground hover:text-foreground">
              Go to requested page
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
