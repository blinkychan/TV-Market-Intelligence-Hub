import Link from "next/link";
import { Badge } from "@/components/ui/badge";

export function FirstRunGuide({ demoMode }: { demoMode: boolean }) {
  return (
    <section className="rounded-lg border bg-white p-6 shadow-panel">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-primary">Welcome</p>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight">How to get started</h2>
          <p className="mt-3 max-w-3xl text-muted-foreground">
            This app tracks development announcements, current TV schedules, buyer activity, and article review work so the team can move from incoming trade coverage to a clean weekly market picture.
          </p>
        </div>
        <Badge className={demoMode ? "bg-amber-50 text-amber-800 ring-amber-200" : "bg-emerald-50 text-emerald-700 ring-emerald-200"}>
          {demoMode ? "Demo Preview" : "Live Setup"}
        </Badge>
      </div>
      <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <GuideCard
          title="Start with review"
          description="Open the Review Queue to confirm incoming articles, fetch body text when allowed, and clean up uncertain extractions before they become tracked records."
          href="/review"
        />
        <GuideCard
          title="Use trackers daily"
          description="Development Tracker and Current TV Tracker are the working views for buyer movement, premiere calendars, stale projects, and confidence gaps."
          href="/development"
        />
        <GuideCard
          title="Build reports on Friday"
          description="Weekly Reports pulls together sales, orders, premieres, watchlist alerts, and review pressure into a clean executive-facing summary."
          href="/weekly-reports"
        />
        <GuideCard
          title={demoMode ? "Understand demo data" : "Check launch readiness"}
          description={
            demoMode
              ? "Demo data is meant for workflow testing. It helps the team learn the product without touching the live database."
              : "Admin pages show ingestion status, launch readiness, and background job health before a wider team rollout."
          }
          href={demoMode ? "/sources" : "/admin/launch-checklist"}
        />
      </div>
    </section>
  );
}

function GuideCard({
  title,
  description,
  href
}: {
  title: string;
  description: string;
  href: string;
}) {
  return (
    <Link href={href} className="rounded-lg border bg-slate-50 p-4 transition hover:border-primary/30 hover:bg-white hover:shadow-panel">
      <div className="font-medium text-slate-900">{title}</div>
      <div className="mt-2 text-sm leading-6 text-muted-foreground">{description}</div>
    </Link>
  );
}

