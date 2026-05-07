import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getCurrentUserContext } from "@/lib/team-auth";

export const dynamic = "force-dynamic";

export default async function AccessDeniedPage() {
  const auth = await getCurrentUserContext();

  return (
    <div className="mx-auto flex min-h-[70vh] max-w-xl items-center">
      <Card className="w-full shadow-panel">
        <CardHeader className="space-y-3">
          <div className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-amber-100 text-amber-800">
            <AlertTriangle className="h-5 w-5" />
          </div>
          <CardTitle className="text-2xl">Access denied</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            {auth.accessDeniedReason ?? "Your account is signed in, but it does not currently have permission to use this area."}
          </p>
          <p className="text-sm text-muted-foreground">
            Signed in as {auth.user?.email ?? "unknown user"}.
          </p>
          <div className="flex items-center justify-between text-sm">
            <Link href="/login" className="text-primary hover:underline">
              Back to login
            </Link>
            <Link href="/admin/login" className="text-muted-foreground hover:text-foreground">
              Admin unlock
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

