import { NextResponse } from "next/server";
import { detectArticleMissingData, detectCurrentShowMissingData, detectProjectMissingData, refreshAllMissingDataFlags } from "@/lib/data-quality";
import { mockBuyerDetails } from "@/lib/mock-buyers";
import { mockCurrentShows } from "@/lib/mock-current-tv";
import { readMockPreviewState } from "@/lib/mock-preview-store";
import { prisma } from "@/lib/prisma";
import { canUseMockPreview } from "@/lib/runtime-mode";
import { getCurrentUserContext } from "@/lib/team-auth";

function toCsv(value: string) {
  return `"${value.replaceAll("\"", "\"\"")}"`;
}

export async function GET() {
  const auth = await getCurrentUserContext();
  if (!auth.isAuthenticated) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    await refreshAllMissingDataFlags();
    const flags = await prisma.missingDataFlag.findMany({
      where: { resolvedAt: null },
      orderBy: [{ severity: "desc" }, { createdAt: "desc" }]
    });
    const csv = [
      ["entityType", "entityId", "missingField", "severity", "reason", "createdAt"],
      ...flags.map((flag) => [
        flag.entityType,
        flag.entityId,
        flag.missingField,
        flag.severity,
        flag.reason,
        flag.createdAt.toISOString()
      ])
    ]
      .map((row) => row.map((cell) => toCsv(String(cell))).join(","))
      .join("\n");

    return new NextResponse(csv, {
      headers: {
        "content-type": "text/csv; charset=utf-8",
        "content-disposition": 'attachment; filename="missing-data-flags.csv"'
      }
    });
  } catch {
    if (!canUseMockPreview()) {
      return NextResponse.json({ error: "Missing data export unavailable." }, { status: 500 });
    }

    const preview = await readMockPreviewState().catch(() => null);
    const flags = [
      ...(preview?.reviewArticles ?? []).flatMap((article) => detectArticleMissingData(article)),
      ...mockBuyerDetails.flatMap((buyer) =>
        buyer.projects.flatMap((project) =>
          detectProjectMissingData({
            id: project.id,
            buyerId: buyer.id,
            networkOrPlatform: buyer.name,
            studioId: project.studio ? project.studio : null,
            sourceUrl: project.sourceUrl,
            confidenceLevel: project.status === "stale" ? "low" : "medium",
            productionCompanies: project.productionCompanies
          })
        )
      ),
      ...mockCurrentShows.flatMap((show) =>
        detectCurrentShowMissingData({
          id: show.id,
          premiereDate: show.premiereDate ? new Date(show.premiereDate) : null,
          sourceUrl: show.sourceUrl,
          confidenceLevel: show.confidenceLevel,
          productionCompanies: show.productionCompanies
        })
      )
    ];

    const csv = [
      ["entityType", "entityId", "missingField", "severity", "reason"],
      ...flags.map((flag) => [flag.entityType, flag.entityId, flag.missingField, flag.severity, flag.reason])
    ]
      .map((row) => row.map((cell) => toCsv(String(cell))).join(","))
      .join("\n");

    return new NextResponse(csv, {
      headers: {
        "content-type": "text/csv; charset=utf-8",
        "content-disposition": 'attachment; filename="missing-data-flags.csv"'
      }
    });
  }
}
