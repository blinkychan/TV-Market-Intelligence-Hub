import { Database, Upload } from "lucide-react";
import { CsvImportManager } from "@/components/shared/csv-import-manager";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { getCurrentUserContext } from "@/lib/team-auth";

export const dynamic = "force-dynamic";

export default async function CsvImportPage() {
  const auth = await getCurrentUserContext();
  const canImport = auth.canEditContent || auth.adminUnlocked;

  return (
    <div className="space-y-6">
      <section className="rounded-lg border bg-white p-6 shadow-panel">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-primary">Manual Backfill</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight">CSV Import</h1>
            <p className="mt-3 max-w-3xl text-muted-foreground">
              Bring in projects, current shows, buyers, companies, people, and articles from spreadsheets without waiting on automated ingestion.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge className={canImport ? "bg-emerald-50 text-emerald-700 ring-emerald-200" : "bg-slate-100 text-slate-700 ring-slate-200"}>
              {canImport ? "Import access enabled" : "Export-only role"}
            </Badge>
            <ButtonLink href="/sources" variant="secondary">
              <Database className="h-4 w-4" /> Back to Sources
            </ButtonLink>
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        <div className="rounded-lg border bg-white p-5 shadow-panel">
          <div className="inline-flex h-10 w-10 items-center justify-center rounded-md bg-primary/10 text-primary">
            <Upload className="h-5 w-5" />
          </div>
          <h2 className="mt-4 text-lg font-semibold">Preview before commit</h2>
          <p className="mt-2 text-sm text-muted-foreground">Every import runs through field mapping, validation, duplicate checks, and a count preview before anything is written.</p>
        </div>
        <div className="rounded-lg border bg-white p-5 shadow-panel">
          <div className="inline-flex h-10 w-10 items-center justify-center rounded-md bg-primary/10 text-primary">
            <Database className="h-5 w-5" />
          </div>
          <h2 className="mt-4 text-lg font-semibold">Audit-safe writes</h2>
          <p className="mt-2 text-sm text-muted-foreground">Imports create audit entries automatically and skip likely duplicates rather than overwriting existing records.</p>
        </div>
        <div className="rounded-lg border bg-white p-5 shadow-panel">
          <div className="inline-flex h-10 w-10 items-center justify-center rounded-md bg-primary/10 text-primary">
            <Upload className="h-5 w-5" />
          </div>
          <h2 className="mt-4 text-lg font-semibold">Made for manual backfill</h2>
          <p className="mt-2 text-sm text-muted-foreground">This flow is tuned for small, reviewable batches so the team can backfill safely without needing scraping infrastructure.</p>
        </div>
      </section>

      <CsvImportManager canImport={canImport} />
    </div>
  );
}
