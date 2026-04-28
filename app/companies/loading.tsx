export default function CompaniesLoading() {
  return (
    <div className="space-y-5">
      <section className="rounded-lg border bg-white p-6 shadow-panel">
        <div className="h-4 w-40 animate-pulse rounded bg-slate-200" />
        <div className="mt-3 h-8 w-72 animate-pulse rounded bg-slate-200" />
        <div className="mt-4 h-4 max-w-2xl animate-pulse rounded bg-slate-200" />
      </section>
      <div className="h-96 animate-pulse rounded-lg border bg-white shadow-panel" />
    </div>
  );
}
