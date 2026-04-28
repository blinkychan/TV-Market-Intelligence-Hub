import Link from "next/link";
import { ArrowUpRight, Building2, ClipboardList, FileText, Radio, UsersRound } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ButtonLink } from "@/components/ui/button";
import { mockBuyerDetails } from "@/lib/mock-buyers";
import { mockCurrentShows } from "@/lib/mock-current-tv";
import { mockRelationshipIndex } from "@/lib/mock-relationships";
import { mockReviewArticles } from "@/lib/mock-review";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

async function getDashboardCounts() {
  try {
    const [totalProjects, activeProjects, currentShows, buyers, companies, people, reviewItems] = await Promise.all([
      prisma.project.count(),
      prisma.project.count({ where: { status: { in: ["sold", "in_development", "pilot_order", "series_order"] } } }),
      prisma.currentShow.count(),
      prisma.buyer.count(),
      prisma.company.count(),
      prisma.person.count(),
      prisma.article.count({ where: { needsReview: true } })
    ]);

    return { totalProjects, activeProjects, currentShows, buyers, companies, people, reviewItems };
  } catch {
    const mockProjects = mockBuyerDetails.flatMap((buyer) => buyer.projects);
    return {
      totalProjects: mockProjects.length,
      activeProjects: mockProjects.filter((project) => ["sold", "in_development", "pilot_order", "series_order"].includes(project.status)).length,
      currentShows: mockCurrentShows.length,
      buyers: mockBuyerDetails.length,
      companies: mockRelationshipIndex.companies.length,
      people: mockRelationshipIndex.people.length,
      reviewItems: mockReviewArticles.filter((article) => article.extractionStatus === "Needs Review" || article.extractionStatus === "New").length
    };
  }
}

export default async function DashboardPage() {
  const { totalProjects, activeProjects, currentShows, buyers, companies, people, reviewItems } = await getDashboardCounts();

  const dashboardCards = [
    {
      label: "Total Development Projects",
      href: "/development",
      icon: ClipboardList,
      value: totalProjects,
      meta: "development projects",
      copy: "Track announced projects, statuses, buyers, studios, and attachments."
    },
    {
      label: "Active Development Projects",
      href: "/development",
      icon: ClipboardList,
      value: activeProjects,
      meta: "active pipeline items",
      copy: "Sold, in-development, pilot-order, and series-order projects."
    },
    {
      label: "Current Shows",
      href: "/current-tv",
      icon: Radio,
      value: currentShows,
      meta: "current shows",
      copy: "Follow airing shows, premieres, finales, and platform schedules."
    },
    {
      label: "Buyers",
      href: "/buyers",
      icon: Building2,
      value: buyers,
      meta: "buyers",
      copy: "Build buyer profiles and activity summaries."
    },
    {
      label: "Companies",
      href: "/companies",
      icon: UsersRound,
      value: companies,
      meta: "companies",
      copy: "Track studios, production companies, distributors, agencies, and management companies."
    },
    {
      label: "People",
      href: "/companies",
      icon: UsersRound,
      value: people,
      meta: "people",
      copy: "Track writers, creators, showrunners, producers, actors, executives, and directors."
    },
    {
      label: "Articles Needing Review",
      href: "/review",
      icon: FileText,
      value: reviewItems,
      meta: "items needing review",
      copy: "Reserve a human review workspace for source articles."
    }
  ];

  return (
    <div className="space-y-6">
      <section className="rounded-lg border bg-white p-6 shadow-panel">
        <div className="flex flex-col justify-between gap-5 lg:flex-row lg:items-end">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-primary">Entertainment Intelligence</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight">TV Market Intelligence Hub</h1>
            <p className="mt-3 max-w-3xl text-muted-foreground">
              A local-first dashboard foundation for TV development, current programming, buyer activity,
              relationships, review workflows, reporting, and source management.
            </p>
          </div>
          <ButtonLink href="/development">
            Open Tracker <ArrowUpRight className="h-4 w-4" />
          </ButtonLink>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {dashboardCards.map((item) => {
          const Icon = item.icon;
          return (
            <Link key={item.href} href={item.href}>
              <Card className="h-full transition hover:shadow-panel">
                <CardHeader className="flex flex-row items-center justify-between space-y-0">
                  <CardTitle>{item.label}</CardTitle>
                  <Icon className="h-5 w-5 text-primary" />
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-semibold tracking-tight">{item.value}</div>
                  <div className="mt-1 text-sm font-medium text-primary">{item.meta}</div>
                  <p className="mt-3 text-sm text-muted-foreground">{item.copy}</p>
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </section>
    </div>
  );
}
