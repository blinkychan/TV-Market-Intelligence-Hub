export default function BackfillQueueLoading() {
  return (
    <div className="space-y-6">
      <div className="h-36 animate-pulse rounded-lg border bg-white shadow-panel" />
      <div className="grid gap-4 md:grid-cols-5">
        {Array.from({ length: 5 }).map((_, index) => (
          <div key={index} className="h-28 animate-pulse rounded-lg border bg-white shadow-panel" />
        ))}
      </div>
      <div className="grid gap-6 xl:grid-cols-2">
        <div className="h-80 animate-pulse rounded-lg border bg-white shadow-panel" />
        <div className="h-80 animate-pulse rounded-lg border bg-white shadow-panel" />
      </div>
    </div>
  );
}
