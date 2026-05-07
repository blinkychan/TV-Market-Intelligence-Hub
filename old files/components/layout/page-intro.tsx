import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type PageIntroProps = {
  eyebrow: string;
  title: string;
  description: string;
  helperText?: string;
  dataSource?: "database" | "mock";
  errorMessage?: string | null;
  children?: React.ReactNode;
};

function sourceTone(dataSource: "database" | "mock") {
  return dataSource === "database"
    ? "bg-emerald-50 text-emerald-700 ring-emerald-200"
    : "bg-amber-50 text-amber-800 ring-amber-200";
}

export function PageIntro({
  eyebrow,
  title,
  description,
  helperText,
  dataSource,
  errorMessage,
  children
}: PageIntroProps) {
  return (
    <section className="rounded-lg border bg-white p-6 shadow-panel">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-primary">{eyebrow}</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">{title}</h1>
          <p className="mt-3 max-w-3xl text-muted-foreground">{description}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">{children}</div>
      </div>

      {helperText ? (
        <div className="mt-4 rounded-lg border bg-slate-50 px-4 py-3 text-sm text-slate-700">{helperText}</div>
      ) : null}

      {dataSource ? (
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <Badge className={sourceTone(dataSource)}>
            {dataSource === "database" ? "Live Database Mode" : "Demo Preview Mode"}
          </Badge>
          {dataSource === "mock" ? (
            <span className="text-sm text-muted-foreground">
              Demo data is visible so the workflow stays testable before a live connection is ready.
            </span>
          ) : (
            <span className="text-sm text-muted-foreground">
              You are looking at live records from the connected production database.
            </span>
          )}
        </div>
      ) : null}

      {errorMessage ? (
        <div
          className={cn(
            "mt-4 rounded-md px-3 py-2 text-sm",
            dataSource === "mock"
              ? "border border-amber-200 bg-amber-50 text-amber-900"
              : "border border-rose-200 bg-rose-50 text-rose-900"
          )}
        >
          {errorMessage}
        </div>
      ) : null}
    </section>
  );
}

