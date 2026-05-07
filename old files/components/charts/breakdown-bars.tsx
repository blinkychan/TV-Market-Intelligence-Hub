export function BreakdownBars({ items }: { items: { label: string; count: number }[] }) {
  const total = items.reduce((sum, item) => sum + item.count, 0);

  if (!items.length) {
    return <div className="rounded-md border border-dashed bg-slate-50 p-4 text-sm text-muted-foreground">No activity logged.</div>;
  }

  return (
    <div className="space-y-3">
      {items.map((item) => {
        const width = total ? Math.max(8, Math.round((item.count / total) * 100)) : 0;
        return (
          <div key={item.label}>
            <div className="mb-1 flex items-center justify-between gap-3 text-sm">
              <span className="truncate">{item.label}</span>
              <span className="font-semibold">{item.count}</span>
            </div>
            <div className="h-2 rounded-full bg-muted">
              <div className="h-2 rounded-full bg-primary" style={{ width: `${width}%` }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}
