import { prisma } from "@/lib/prisma";

export type EmailPreferenceRecord = {
  id: string;
  userId: string | null;
  email: string;
  receiveWeeklyReport: boolean;
  receiveHighSeverityAlerts: boolean;
  receiveWatchlistAlerts: boolean;
  weeklyReportDay: string;
  weeklyReportTime: string;
  createdAt: Date;
  updatedAt: Date;
};

export async function getEmailPreferenceForEmail(email: string) {
  return prisma.emailPreference.findUnique({
    where: { email }
  }).catch(() => null);
}

export async function upsertEmailPreference(args: {
  userId?: string | null;
  email: string;
  receiveWeeklyReport: boolean;
  receiveHighSeverityAlerts: boolean;
  receiveWatchlistAlerts: boolean;
  weeklyReportDay: string;
  weeklyReportTime: string;
}) {
  return prisma.emailPreference.upsert({
    where: { email: args.email },
    update: {
      userId: args.userId ?? null,
      receiveWeeklyReport: args.receiveWeeklyReport,
      receiveHighSeverityAlerts: args.receiveHighSeverityAlerts,
      receiveWatchlistAlerts: args.receiveWatchlistAlerts,
      weeklyReportDay: args.weeklyReportDay,
      weeklyReportTime: args.weeklyReportTime
    },
    create: {
      userId: args.userId ?? null,
      email: args.email,
      receiveWeeklyReport: args.receiveWeeklyReport,
      receiveHighSeverityAlerts: args.receiveHighSeverityAlerts,
      receiveWatchlistAlerts: args.receiveWatchlistAlerts,
      weeklyReportDay: args.weeklyReportDay,
      weeklyReportTime: args.weeklyReportTime
    }
  });
}

export async function getWeeklyReportRecipients(day: string) {
  return prisma.emailPreference.findMany({
    where: {
      receiveWeeklyReport: true,
      weeklyReportDay: day.toLowerCase()
    },
    orderBy: [{ email: "asc" }]
  }).catch(() => []);
}

export async function getAlertDigestRecipients() {
  return prisma.emailPreference.findMany({
    where: {
      OR: [{ receiveHighSeverityAlerts: true }, { receiveWatchlistAlerts: true }]
    },
    orderBy: [{ email: "asc" }]
  }).catch(() => []);
}
