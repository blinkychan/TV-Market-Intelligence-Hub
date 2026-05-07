export default function CurrentTvLoading() {
  return (
    <div className="space-y-5">
      <section className="rounded-lg border bg-white p-6 shadow-panel">
        <div className="h-4 w-40 animate-pulse rounded bg-slate-200" />
        <div className="mt-3 h-8 w-80 animate-pulse rounded bg-slate-200" />
        <div className="mt-4 h-4 max-w-2xl animate-pulse rounded bg-slate-200" />
      </section>
      <div className="rounded-lg border bg-white p-4 shadow-panel">
        <div className="grid gap-3 md:grid-cols-4">
          {Array.from({ length: 8 }).map((_, index) => (
            <div key={index} className="h-9 animate-pulse rounded bg-slate-200" />
          ))}
        </div>
      </div>
      <div className="rounded-lg border bg-white p-4 shadow-panel">
        <div className="space-y-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <div key={index} className="h-12 animate-pulse rounded bg-slate-100" />
          ))}
        </div>
      </div>
    </div>
  );
}
