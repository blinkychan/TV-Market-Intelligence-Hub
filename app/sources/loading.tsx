import { Card, CardContent, CardHeader } from "@/components/ui/card";

export default function SourcesLoading() {
  return (
    <div className="space-y-6">
      <div className="h-36 animate-pulse rounded-lg border bg-white shadow-panel" />
      <div className="grid gap-4 md:grid-cols-3">
        {Array.from({ length: 3 }).map((_, index) => (
          <Card key={index} className="shadow-panel">
            <CardHeader>
              <div className="h-4 w-28 animate-pulse rounded bg-slate-200" />
            </CardHeader>
            <CardContent>
              <div className="h-9 w-20 animate-pulse rounded bg-slate-200" />
            </CardContent>
          </Card>
        ))}
      </div>
      <div className="grid gap-6 xl:grid-cols-2">
        {Array.from({ length: 2 }).map((_, index) => (
          <Card key={index} className="shadow-panel">
            <CardHeader>
              <div className="h-5 w-40 animate-pulse rounded bg-slate-200" />
            </CardHeader>
            <CardContent>
              <div className="h-64 animate-pulse rounded bg-slate-100" />
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
