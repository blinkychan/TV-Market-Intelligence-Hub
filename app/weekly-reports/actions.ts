"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { generateWeeklyReportPayload } from "@/lib/weekly-report";

export async function saveReport(formData: FormData) {
  const reportDate = String(formData.get("reportDate") ?? "");
  if (!reportDate) return;
  const payload = await generateWeeklyReportPayload(reportDate);
  if (payload.dataSource === "mock") return;
  await prisma.weeklyReport.create({
    data: {
      weekStart: payload.weekStart,
      weekEnd: payload.weekEnd,
      title: payload.title,
      generatedMarkdown: payload.markdown
    }
  }).catch(() => {});

  revalidatePath("/weekly-reports");
}
