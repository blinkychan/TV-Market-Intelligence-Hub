export default function BuyersLoading() {
  return (
    <div className="space-y-5">
      <section className="rounded-lg border bg-white p-6 shadow-panel">
        <div className="h-4 w-40 animate-pulse rounded bg-slate-200" />
        <div className="mt-3 h-8 w-52 animate-pulse rounded bg-slate-200" />
        <div className="mt-4 h-4 max-w-2xl animate-pulse rounded bg-slate-200" />
      </section>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 8 }).map((_, index) => (
          <div key={index} className="h-52 animate-pulse rounded-lg border bg-white shadow-panel" />
        ))}
      </div>
    </div>
  );
}
