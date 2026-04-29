"use server";

import { revalidatePath } from "next/cache";
import { recordAuditLog } from "@/lib/audit";
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

  for (const note of payload.includedTeamNotes) {
    await recordAuditLog({
      entityType: "TeamNote",
      entityId: note.id,
      action: "referenced",
      newValueJson: {
        weeklyReportDate: reportDate,
        weeklyReportTitle: payload.title,
        entityType: note.entityType,
        entityId: note.entityId
      },
      reason: "Team note included in weekly report.",
      source: "weekly_report"
    });
  }

  revalidatePath("/weekly-reports");
}
