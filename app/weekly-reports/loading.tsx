export default function WeeklyReportsLoading() {
  return (
    <div className="space-y-5">
      <section className="rounded-lg border bg-white p-6 shadow-panel">
        <div className="h-4 w-40 animate-pulse rounded bg-slate-200" />
        <div className="mt-3 h-8 w-64 animate-pulse rounded bg-slate-200" />
        <div className="mt-4 h-4 max-w-2xl animate-pulse rounded bg-slate-200" />
      </section>
      <div className="h-24 animate-pulse rounded-lg border bg-white shadow-panel" />
      <div className="grid gap-6 xl:grid-cols-[1.3fr_0.7fr]">
        <div className="h-[40rem] animate-pulse rounded-lg border bg-white shadow-panel" />
        <div className="h-[40rem] animate-pulse rounded-lg border bg-white shadow-panel" />
      </div>
    </div>
  );
}
