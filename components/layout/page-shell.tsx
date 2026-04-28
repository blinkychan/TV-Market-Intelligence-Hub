import { ArrowRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type PageShellProps = {
  eyebrow: string;
  title: string;
  description: string;
  sections: string[];
};

export function PageShell({ eyebrow, title, description, sections }: PageShellProps) {
  return (
    <div className="space-y-6">
      <section className="rounded-lg border bg-white p-6 shadow-panel">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-primary">{eyebrow}</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">{title}</h1>
        <p className="mt-3 max-w-3xl text-muted-foreground">{description}</p>
      </section>
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {sections.map((section) => (
          <Card key={section}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0">
              <CardTitle>{section}</CardTitle>
              <ArrowRight className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              Placeholder surface reserved for the next implementation pass.
            </CardContent>
          </Card>
        ))}
      </section>
    </div>
  );
}
