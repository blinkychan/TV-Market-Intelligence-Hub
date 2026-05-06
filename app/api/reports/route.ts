import PDFDocument from "pdfkit";
import { NextRequest } from "next/server";
import { toCsv } from "@/lib/csv";
import { withControlledJob } from "@/lib/job-control";
import { prisma } from "@/lib/prisma";
import { reportQuerySchema } from "@/lib/request-validation";
import { requireApprovedTeamAccess } from "@/lib/team-auth";
import { generateWeeklyReportPayload } from "@/lib/weekly-report";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function filename(title: string, extension: string) {
  return `${title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}.${extension}`;
}

async function renderPdf(markdown: string) {
  const doc = new PDFDocument({ margin: 48, size: "LETTER" });
  const chunks: Buffer[] = [];

  doc.on("data", (chunk: Buffer) => chunks.push(chunk));
  doc.font("Helvetica").fontSize(11).text(markdown.replace(/\*\*/g, ""), { lineGap: 4 });
  doc.end();

  await new Promise<void>((resolve) => doc.on("end", resolve));
  return Buffer.concat(chunks);
}

function renderCsv(markdown: string) {
  const rows: Array<Record<string, unknown>> = [];
  let currentSection = "Overview";

  markdown.split("\n").forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed) return;
    if (trimmed.startsWith("## ")) {
      currentSection = trimmed.replace(/^##\s+/, "");
      return;
    }
    if (trimmed.startsWith("# ")) return;
    rows.push({
      section: currentSection,
      item: trimmed.replace(/^\-\s*/, "").replace(/\*\*/g, "")
    });
  });

  return toCsv(["section", "item"], rows);
}

export async function GET(request: NextRequest) {
  await requireApprovedTeamAccess();
  const parsed = reportQuerySchema.safeParse({
    id: request.nextUrl.searchParams.get("id") ?? undefined,
    format: request.nextUrl.searchParams.get("format") ?? "md",
    reportDate: request.nextUrl.searchParams.get("reportDate") ?? undefined,
    source: request.nextUrl.searchParams.get("source") ?? undefined
  });

  if (!parsed.success) {
    return new Response("Invalid report request.", { status: 400 });
  }

  const { id, format = "md", reportDate, source } = parsed.data;

  if (reportDate) {
    const parsedDate = new Date(reportDate);
    if (Number.isNaN(parsedDate.getTime())) {
      return new Response("Invalid report date.", { status: 400 });
    }
    const dayDelta = Math.abs((parsedDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    if (dayDelta > 400) {
      return new Response("Requested report date is outside the supported export window.", { status: 400 });
    }
  }

  let title: string;
  let markdown: string;
  if (id) {
    const report = await prisma.weeklyReport.findUnique({ where: { id } });
    if (!report) return new Response("Report not found", { status: 404 });
    title = report.title;
    markdown = report.generatedMarkdown;
  } else if (reportDate) {
    const payload = await withControlledJob({
      jobType: "report_generation",
      inputJson: { reportDate, source: source ?? null, format },
      lockKey: `report:${reportDate}:${source ?? "auto"}:${format}`,
      dedupeMinutes: 2,
      handler: async () => generateWeeklyReportPayload(reportDate, source === "mock")
    });
    title = payload.title;
    markdown = payload.markdown;
  } else {
    return new Response("Missing report id or reportDate", { status: 400 });
  }

  if (format === "pdf") {
    const body = await renderPdf(markdown);
    return new Response(new Uint8Array(body), {
      headers: {
        "content-type": "application/pdf",
        "content-disposition": `attachment; filename="${filename(title, "pdf")}"`
      }
    });
  }

  if (format === "csv") {
    return new Response(renderCsv(markdown), {
      headers: {
        "content-type": "text/csv; charset=utf-8",
        "content-disposition": `attachment; filename="${filename(title, "csv")}"`
      }
    });
  }

  return new Response(markdown, {
    headers: {
      "content-type": "text/markdown; charset=utf-8",
      "content-disposition": `attachment; filename="${filename(title, "md")}"`
    }
  });
}
