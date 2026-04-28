import { cn, humanize } from "@/lib/utils";
import { statusTone } from "@/lib/constants";

export function Badge({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <span className={cn("inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ring-1", className)}>
      {children}
    </span>
  );
}

export function StatusBadge({ status }: { status?: string | null }) {
  return <Badge className={statusTone[status ?? "unknown"] ?? statusTone.unknown}>{humanize(status)}</Badge>;
}
