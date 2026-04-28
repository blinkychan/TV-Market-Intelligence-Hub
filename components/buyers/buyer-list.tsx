import Link from "next/link";
import { Building2, Radio, TrendingUp } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { BuyerListItem } from "@/components/buyers/types";
import { humanize } from "@/lib/utils";

export function BuyerList({ buyers, dataSource, errorMessage }: { buyers: BuyerListItem[]; dataSource: "database" | "mock"; errorMessage?: string }) {
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-white p-4 shadow-panel">
        <div>
          <div className="font-semibold">{buyers.length} buyers tracked</div>
          <p className="text-sm text-muted-foreground">Development, current shows, acquisitions, and international activity by buyer.</p>
        </div>
        <Badge className={dataSource === "database" ? "bg-emerald-50 text-emerald-700 ring-emerald-200" : "bg-amber-50 text-amber-800 ring-amber-200"}>
          Data Source: {dataSource === "database" ? "Database" : "Mock Preview Data"}
        </Badge>
      </div>
      {errorMessage ? (
        <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          Database unavailable, showing mock preview data. Detail: {errorMessage}
        </div>
      ) : null}
      <Card className="shadow-panel">
        <CardHeader>
          <CardTitle>Buyer Heat Map</CardTitle>
          <p className="text-sm text-muted-foreground">Darker cells indicate more activity in that category.</p>
        </CardHeader>
        <CardContent>
          {buyers.length ? (
            <div className="overflow-x-auto">
              <div className="min-w-[760px]">
                <div className="grid grid-cols-[12rem_repeat(5,1fr)] gap-2 text-xs font-semibold uppercase text-muted-foreground">
                  <div>Buyer</div>
                  <div>Projects</div>
                  <div>Current</div>
                  <div>Acq</div>
                  <div>Intl / Co-Pro</div>
                  <div>Stale</div>
                </div>
                <div className="mt-2 space-y-2">
                  {buyers.map((buyer) => (
                    <div key={buyer.id} className="grid grid-cols-[12rem_repeat(5,1fr)] gap-2">
                      <Link className="truncate rounded-md border bg-white px-3 py-2 text-sm font-medium text-primary hover:underline" href={`/buyers/${buyer.id}`}>
                        {buyer.name}
                      </Link>
                      <HeatCell value={buyer.projectCount} max={Math.max(...buyers.map((item) => item.projectCount), 1)} />
                      <HeatCell value={buyer.currentShowCount} max={Math.max(...buyers.map((item) => item.currentShowCount), 1)} />
                      <HeatCell value={buyer.acquisitionCount} max={Math.max(...buyers.map((item) => item.acquisitionCount), 1)} />
                      <HeatCell value={buyer.internationalCount} max={Math.max(...buyers.map((item) => item.internationalCount), 1)} />
                      <HeatCell value={buyer.staleCount} max={Math.max(...buyers.map((item) => item.staleCount), 1)} />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="rounded-md border border-dashed bg-slate-50 p-5 text-center text-sm text-muted-foreground">No buyer activity to visualize.</div>
          )}
        </CardContent>
      </Card>
      {buyers.length ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {buyers.map((buyer) => (
            <Link key={buyer.id} href={`/buyers/${buyer.id}`}>
              <Card className="h-full transition hover:shadow-panel">
                <CardHeader>
                  <div className="flex items-center justify-between gap-3">
                    <CardTitle>{buyer.name}</CardTitle>
                    <Building2 className="h-5 w-5 text-primary" />
                  </div>
                  <p className="text-sm text-muted-foreground">{humanize(buyer.type)} · {buyer.parentCompany ?? "Independent"}</p>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <Metric icon={<TrendingUp className="h-4 w-4" />} label="Projects" value={buyer.projectCount} />
                    <Metric icon={<Radio className="h-4 w-4" />} label="Shows" value={buyer.currentShowCount} />
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Badge className="bg-orange-50 text-orange-700 ring-orange-200">{buyer.acquisitionCount} Acq</Badge>
                    <Badge className="bg-sky-50 text-sky-700 ring-sky-200">{buyer.internationalCount} Intl / Co-Pro</Badge>
                    <Badge className="bg-amber-50 text-amber-800 ring-amber-200">{buyer.staleCount} Stale</Badge>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      ) : (
        <div className="rounded-lg border border-dashed bg-slate-50 p-8 text-center text-sm text-muted-foreground">
          No buyers available yet.
        </div>
      )}
    </div>
  );
}

function Metric({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return (
    <div className="rounded-md border bg-slate-50 p-3">
      <div className="flex items-center gap-2 text-xs font-medium uppercase text-muted-foreground">{icon}{label}</div>
      <div className="mt-1 text-2xl font-semibold">{value}</div>
    </div>
  );
}

function HeatCell({ value, max }: { value: number; max: number }) {
  const intensity = max ? value / max : 0;
  const background =
    intensity >= 0.75 ? "bg-primary text-white" : intensity >= 0.45 ? "bg-teal-100 text-teal-900" : intensity > 0 ? "bg-sky-50 text-sky-900" : "bg-slate-50 text-slate-500";
  return <div className={`rounded-md border px-3 py-2 text-center text-sm font-semibold ${background}`}>{value}</div>;
}
