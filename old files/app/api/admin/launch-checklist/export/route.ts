import { NextResponse } from "next/server";
import { getLaunchChecklistReport } from "@/lib/launch-checklist";
import { requireAdminCapabilityAccess } from "@/lib/team-auth";

export const dynamic = "force-dynamic";

function csvEscape(value: unknown) {
  const text = String(value ?? "");
  if (text.includes(",") || text.includes("\"") || text.includes("\n")) {
    return `"${text.replaceAll("\"", "\"\"")}"`;
  }
  return text;
}

export async function GET() {
  await requireAdminCapabilityAccess();
  const report = await getLaunchChecklistReport();

  const header = ["checkedAt", "label", "status", "explanation", "href"];
  const rows = report.items.map((item) =>
    [item.lastCheckedAt.toISOString(), item.label, item.status, item.explanation, item.href].map(csvEscape).join(",")
  );

  const warnings = report.productionWarnings.map((warning) =>
    [report.checkedAt.toISOString(), "Production warning", "warning", warning, "/admin/launch-checklist"].map(csvEscape).join(",")
  );

  return new NextResponse([header.join(","), ...rows, ...warnings].join("\n"), {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": 'attachment; filename="launch-checklist.csv"'
    }
  });
}

