import { Download, FileText, Save } from "lucide-react";
import { isFriday, parseISO } from "date-fns";
import { saveReport } from "./actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { prisma } from "@/lib/prisma";
import { formatDate } from "@/lib/utils";
import { generateWeeklyReportPayload, getDefaultFriday } from "@/lib/weekly-report";

export default async function WeeklyReportsPage({
  searchParams
}: {
  searchParams: Promise<{ reportDate?: string }>;
}) {
  const params = await searchParams;
  const defaultFriday = getDefaultFriday(new Date());
  const selectedDate = params.reportDate ?? defaultFriday.toISOString().slice(0, 10);
  const fridaySelected = isFriday(parseISO(selectedDate));

  const preview = await generateWeeklyReportPayload(selectedDate);
  const reports = await prisma.weeklyReport.findMany({ orderBy: { generatedAt: "desc" } }).catch(() => []);

  return (
    <div className="space-y-6">
      <section className="rounded-lg border bg-white p-6 shadow-panel">
        <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-start">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-primary">Reporting</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight">Weekly Reports</h1>
            <p className="mt-3 max-w-3xl text-muted-foreground">
              Generate a Friday report from tracked projects, current TV schedules, buyer activity, and review items.
            </p>
          </div>
          <Badge className={preview.dataSource === "database" ? "bg-emerald-50 text-emerald-700 ring-emerald-200" : "bg-amber-50 text-amber-800 ring-amber-200"}>
            Data Source: {preview.dataSource === "database" ? "Database" : "Mock Preview Data"}
          </Badge>
        </div>
      </section>

      <Card className="shadow-panel">
        <CardHeader><CardTitle>Select Friday Report Date</CardTitle></CardHeader>
        <CardContent className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <form className="flex flex-col gap-3 md:flex-row md:items-center">
            <Input type="date" name="reportDate" defaultValue={selectedDate} required className="md:w-72" />
            <Button type="submit"><FileText className="h-4 w-4" /> Preview Report</Button>
          </form>
          <div className="flex flex-wrap gap-2">
            <a className="inline-flex h-9 items-center justify-center gap-2 rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground transition hover:bg-primary/90" href={`/api/reports?reportDate=${selectedDate}&source=${preview.dataSource}&format=md`}>
              <Download className="h-4 w-4" /> Markdown
            </a>
            <a className="inline-flex h-9 items-center justify-center gap-2 rounded-md bg-secondary px-3 text-sm font-medium text-secondary-foreground transition hover:bg-secondary/80" href={`/api/reports?reportDate=${selectedDate}&source=${preview.dataSource}&format=pdf`}>
              <Download className="h-4 w-4" /> PDF
            </a>
            <form action={saveReport}>
              <input type="hidden" name="reportDate" value={selectedDate} />
              <Button type="submit" variant="ghost" disabled={preview.dataSource !== "database"}>
                <Save className="h-4 w-4" /> Save to WeeklyReport
              </Button>
            </form>
          </div>
        </CardContent>
        {!fridaySelected ? (
          <CardContent className="pt-0">
            <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
              The selected date is not a Friday. The report still renders, but the intended workflow is to choose a Friday week-ending date.
            </div>
          </CardContent>
        ) : null}
      </Card>

      <div className="grid gap-6 xl:grid-cols-[1.3fr_0.7fr]">
        <Card className="shadow-panel">
          <CardHeader>
            <CardTitle>Preview Pane</CardTitle>
            <p className="text-sm text-muted-foreground">
              {formatDate(preview.weekStart)} - {formatDate(preview.weekEnd)} · {preview.executiveSummary}
            </p>
          </CardHeader>
          <CardContent>
            <pre className="max-h-[42rem] overflow-auto rounded-lg bg-slate-950 p-4 text-xs leading-6 text-slate-100">
              {preview.markdown}
            </pre>
          </CardContent>
        </Card>

        <Card className="shadow-panel">
          <CardHeader><CardTitle>Saved Reports</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {reports.length ? reports.map((report) => (
              <div key={report.id} className="rounded-md border p-3">
                <div className="font-medium">{report.title}</div>
                <div className="mt-1 text-sm text-muted-foreground">{formatDate(report.weekStart)} - {formatDate(report.weekEnd)}</div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <a className="inline-flex h-8 items-center justify-center gap-2 rounded-md bg-primary px-3 text-xs font-medium text-primary-foreground" href={`/api/reports?id=${report.id}&format=md`}>
                    <Download className="h-3.5 w-3.5" /> Markdown
                  </a>
                  <a className="inline-flex h-8 items-center justify-center gap-2 rounded-md bg-secondary px-3 text-xs font-medium text-secondary-foreground" href={`/api/reports?id=${report.id}&format=pdf`}>
                    <Download className="h-3.5 w-3.5" /> PDF
                  </a>
                </div>
              </div>
            )) : (
              <div className="rounded-md border border-dashed bg-slate-50 p-5 text-center text-sm text-muted-foreground">
                No saved reports yet. Preview a Friday report and save it when database mode is available.
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
