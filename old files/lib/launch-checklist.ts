import { promises as fs } from "node:fs";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { Prisma } from "@prisma/client";
import { scoreArticleRelevance } from "@/lib/source-relevance";
import { SOURCE_CONNECTORS } from "@/lib/source-connectors";
import { extractReadableText } from "@/lib/article-body";
import { emailDeliveryConfigured, renderEmailHtml } from "@/lib/email";
import { extractStructuredTVDataWithAI } from "@/lib/extraction";
import { prisma } from "@/lib/prisma";
import { canUseMockPreview, isProductionEnvironment } from "@/lib/runtime-mode";
import { getCurrentUserContext, hasSupabaseTeamAuthConfigured } from "@/lib/team-auth";
import { generateWeeklyReportPayload, getDefaultFriday } from "@/lib/weekly-report";

export type LaunchChecklistStatus = "pass" | "fail" | "warning";

export type LaunchChecklistItem = {
  id: string;
  label: string;
  status: LaunchChecklistStatus;
  explanation: string;
  href: string;
  lastCheckedAt: Date;
};

export type LaunchChecklistReport = {
  checkedAt: Date;
  items: LaunchChecklistItem[];
  productionWarnings: string[];
  summary: {
    pass: number;
    warning: number;
    fail: number;
  };
};

type VercelCronConfig = {
  path: string;
  schedule: string;
};

type SourceCoverageSummary = {
  total: number;
  enabled: number;
};

function makeItem(
  checkedAt: Date,
  item: Omit<LaunchChecklistItem, "lastCheckedAt">
): LaunchChecklistItem {
  return {
    ...item,
    lastCheckedAt: checkedAt
  };
}

function configured(name: string) {
  return Boolean(process.env[name]?.trim());
}

function summarizeCounts(items: LaunchChecklistItem[]) {
  return items.reduce(
    (accumulator, item) => {
      accumulator[item.status] += 1;
      return accumulator;
    },
    { pass: 0, warning: 0, fail: 0 }
  );
}

function withTimeout<T>(promise: Promise<T>, ms: number, message: string) {
  let timer: NodeJS.Timeout | null = null;

  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(message)), ms);
  });

  return Promise.race([promise, timeout]).finally(() => {
    if (timer) clearTimeout(timer);
  }) as Promise<T>;
}

async function readVercelCronConfig() {
  try {
    const file = await fs.readFile(join(process.cwd(), "vercel.json"), "utf8");
    const parsed = JSON.parse(file) as { crons?: VercelCronConfig[] };
    return parsed.crons ?? [];
  } catch {
    return [];
  }
}

function toJsonValue(value: unknown): Prisma.InputJsonValue | Prisma.NullableJsonNullValueInput | undefined {
  if (value === undefined) return undefined;
  if (value === null) return Prisma.JsonNull;
  return value as Prisma.InputJsonValue;
}

async function runDatabaseWriteProbe() {
  const id = randomUUID();

  await prisma.jobRun.create({
    data: {
      id,
      jobType: "report_generation",
      status: "canceled",
      startedAt: new Date(),
      completedAt: new Date(),
      createdByUserId: null,
      createdByEmail: "launch-checklist@system.local",
      inputJson: toJsonValue({ mode: "write_probe" }),
      resultJson: toJsonValue({ ok: true }),
      errorMessage: null,
      lockKey: `launch-checklist-write-probe:${id}`
    }
  });

  await prisma.jobRun.delete({ where: { id } });
}

function getRequiredEnvironmentChecks() {
  return [
    "DATABASE_URL",
    "DIRECT_URL",
    "NEXT_PUBLIC_APP_URL",
    "NEXT_PUBLIC_SUPABASE_URL",
    "NEXT_PUBLIC_SUPABASE_ANON_KEY"
  ] as const;
}

function getOptionalEnvironmentChecks() {
  return ["OPENAI_API_KEY", "RESEND_API_KEY", "REPORT_FROM_EMAIL", "CRON_SECRET"] as const;
}

export async function getLaunchChecklistReport(): Promise<LaunchChecklistReport> {
  const checkedAt = new Date();
  const items: LaunchChecklistItem[] = [];
  const productionWarnings: string[] = [];
  const auth = await getCurrentUserContext().catch(() => null);
  const production = isProductionEnvironment();
  const authConfigured = hasSupabaseTeamAuthConfigured();
  const requiredEnvironment = getRequiredEnvironmentChecks();
  const optionalEnvironment = getOptionalEnvironmentChecks();
  const missingRequiredEnv = requiredEnvironment.filter((name) => !configured(name));
  const missingOptionalEnv = optionalEnvironment.filter((name) => !configured(name));

  items.push(
    makeItem(checkedAt, {
      id: "environment",
      label: "Environment variables configured",
      status: missingRequiredEnv.length ? "fail" : missingOptionalEnv.length ? "warning" : "pass",
      explanation: missingRequiredEnv.length
        ? `Missing required settings: ${missingRequiredEnv.join(", ")}.`
        : missingOptionalEnv.length
          ? `Core settings are present. Optional services still missing: ${missingOptionalEnv.join(", ")}.`
          : "Required app, database, auth, AI, email, and cron settings are configured.",
      href: "/admin/status"
    })
  );

  if (production && !authConfigured) {
    productionWarnings.push("Production warning: team authentication is disabled. The hosted app should not be shared until Supabase Auth is configured.");
  }
  if (production && !configured("OPENAI_API_KEY")) {
    productionWarnings.push("Production warning: OPENAI_API_KEY is missing, so real AI extraction will stay unavailable.");
  }
  if (production && !configured("RESEND_API_KEY")) {
    productionWarnings.push("Production warning: RESEND_API_KEY is missing, so email delivery will stay in preview mode.");
  }

  let databaseConnected = false;
  let articleCount = 0;
  let projectCount = 0;
  let currentShowCount = 0;
  let adminCount = 0;
  let sourceCoverageSummary: SourceCoverageSummary = { total: 0, enabled: 0 };
  let auditCount = 0;
  let queuedBackfillJobs = 0;
  let enabledSourceNames: string[] = [];
  let duplicateCount = 0;

  try {
    await prisma.$queryRaw`SELECT 1`;
    await runDatabaseWriteProbe();
    databaseConnected = true;

    const [
      nextArticleCount,
      nextProjectCount,
      nextCurrentShowCount,
      nextAdminCount,
      nextSourceCoverage,
      nextAuditCount,
      nextQueuedBackfillJobs,
      nextDuplicateCount
    ] = await Promise.all([
      prisma.article.count(),
      prisma.project.count(),
      prisma.currentShow.count(),
      prisma.userProfile.count({ where: { role: "admin" } }),
      prisma.sourceCoverage.findMany({
        select: { sourceName: true, enabled: true }
      }),
      prisma.auditLog.count(),
      prisma.backfillJob.count({ where: { status: { in: ["queued", "running", "paused"] } } }),
      prisma.article.count({ where: { duplicateStatus: { not: "not_duplicate" } } })
        .then((count) => count)
    ]);

    articleCount = nextArticleCount;
    projectCount = nextProjectCount;
    currentShowCount = nextCurrentShowCount;
    adminCount = nextAdminCount;
    sourceCoverageSummary = {
      total: nextSourceCoverage.length,
      enabled: nextSourceCoverage.filter((source) => source.enabled).length
    };
    enabledSourceNames = nextSourceCoverage.filter((source) => source.enabled).map((source) => source.sourceName);
    auditCount = nextAuditCount;
    queuedBackfillJobs = nextQueuedBackfillJobs;
    duplicateCount = nextDuplicateCount;

    items.push(
      makeItem(checkedAt, {
        id: "database",
        label: "Database connection works",
        status: "pass",
        explanation: "Read and write probes both succeeded against the connected database.",
        href: "/admin/status"
      })
    );
  } catch (error) {
    items.push(
      makeItem(checkedAt, {
        id: "database",
        label: "Database connection works",
        status: "fail",
        explanation: error instanceof Error ? error.message : "Database connection or write test failed.",
        href: "/admin/status"
      })
    );
  }

  if (production && databaseConnected && articleCount + projectCount + currentShowCount === 0) {
    productionWarnings.push("Production warning: the database is connected but still empty. Seed starter data or import initial records before launch.");
  }

  items.push(
    makeItem(checkedAt, {
      id: "auth",
      label: "Auth enabled",
      status: authConfigured ? "pass" : production ? "fail" : "warning",
      explanation: authConfigured
        ? "Supabase team authentication is configured."
        : canUseMockPreview()
          ? "Supabase Auth is not configured, so the app is relying on demo/admin fallback access in preview mode."
          : "Supabase Auth is not configured.",
      href: "/login"
    }),
    makeItem(checkedAt, {
      id: "admin-user",
      label: "Admin user exists",
      status: !databaseConnected ? "warning" : adminCount > 0 ? "pass" : "fail",
      explanation: !databaseConnected
        ? "Could not confirm admin users because the database is unavailable."
        : adminCount > 0
          ? `${adminCount} admin profile${adminCount === 1 ? "" : "s"} found.`
          : "No admin team role is currently assigned.",
      href: "/admin/status"
    }),
    makeItem(checkedAt, {
      id: "permission-test",
      label: "Permission test",
      status: auth?.canManageUsers ? "pass" : auth?.isAuthenticated ? "warning" : "fail",
      explanation: auth?.canManageUsers
        ? `Current session is approved for admin controls via ${auth.sessionSource.replaceAll("_", " ")}.`
        : auth?.isAuthenticated
          ? "Signed in, but this session does not have full admin capability access."
          : "No approved admin session is active.",
      href: "/admin/status"
    }),
    makeItem(checkedAt, {
      id: "seed-data",
      label: "Seed/demo data status",
      status: !databaseConnected
        ? canUseMockPreview()
          ? "warning"
          : "fail"
        : articleCount + projectCount + currentShowCount === 0
          ? "warning"
          : "pass",
      explanation: !databaseConnected
        ? canUseMockPreview()
          ? "Database is unavailable, but preview mode can still exercise the UI with mock/demo data."
          : "Database is unavailable and mock preview is disabled in production."
        : articleCount + projectCount + currentShowCount === 0
          ? "The database is empty. Starter seed data or first imports still need to be loaded."
          : `${projectCount} projects, ${currentShowCount} current shows, and ${articleCount} articles are available for QA.`,
      href: "/admin/status"
    })
  );

  const requiredSources = ["Deadline", "Variety", "The Hollywood Reporter", "TheWrap", "TVLine"];
  const sourceConfigMissing = requiredSources.filter(
    (sourceName) => !SOURCE_CONNECTORS.some((connector) => connector.name === sourceName)
  );
  const enabledConnectorCount = SOURCE_CONNECTORS.filter((connector) => connector.enabled).length;

  items.push(
    makeItem(checkedAt, {
      id: "source-config",
      label: "Source coverage status",
      status: sourceConfigMissing.length
        ? "fail"
        : sourceCoverageSummary.total === 0 && databaseConnected
          ? "warning"
          : "pass",
      explanation: sourceConfigMissing.length
        ? `Missing required source connector definitions: ${sourceConfigMissing.join(", ")}.`
        : databaseConnected
          ? `${sourceCoverageSummary.enabled} of ${sourceCoverageSummary.total} tracked sources are enabled. Active sources: ${enabledSourceNames.slice(0, 5).join(", ") || "none yet"}.`
          : `${enabledConnectorCount} source connectors are defined in code and ready to sync once the database is available.`,
      href: "/sources/coverage"
    })
  );

  const relevantRelevance = scoreArticleRelevance({
    headline: "Netflix lands mystery thriller series from major creator",
    summary: "The package lands at Netflix with studio backing and pilot momentum.",
    publication: "Deadline",
    url: "https://deadline.com/example"
  });
  const noisyRelevance = scoreArticleRelevance({
    headline: "Awards red carpet recap: every look from last night",
    summary: "Style coverage from the latest awards show.",
    publication: "Variety",
    url: "https://variety.com/example"
  });

  items.push(
    makeItem(checkedAt, {
      id: "ingestion",
      label: "Ingestion endpoint reachable",
      status:
        relevantRelevance.decision === "review_queue" && noisyRelevance.decision === "excluded"
          ? "pass"
          : "warning",
      explanation:
        relevantRelevance.decision === "review_queue" && noisyRelevance.decision === "excluded"
          ? "Dry-run relevance scoring kept the high-signal TV item and excluded noisy entertainment coverage."
          : "Dry-run relevance scoring completed, but the include/exclude thresholds need tuning before launch.",
      href: "/sources"
    })
  );

  try {
    const bodyPreview = await extractReadableText("<article><h1>Preview</h1><p>Sample body extraction check for launch readiness.</p></article>");
    items.push(
      makeItem(checkedAt, {
        id: "body-extraction",
        label: "Body extraction endpoint reachable",
        status: bodyPreview.extractedText ? "pass" : "warning",
        explanation: bodyPreview.extractedText
          ? "Readable body extraction succeeded on a safe HTML sample."
          : "Body extraction runtime loaded, but the readability parser did not return usable text from the dry-run sample.",
        href: "/review"
      })
    );
  } catch (error) {
    items.push(
      makeItem(checkedAt, {
        id: "body-extraction",
        label: "Body extraction endpoint reachable",
        status: "fail",
        explanation: error instanceof Error ? error.message : "Body extraction dry-run failed.",
        href: "/review"
      })
    );
  }

  items.push(
    makeItem(checkedAt, {
      id: "backfill",
      label: "Backfill queue status",
      status: !databaseConnected ? "warning" : queuedBackfillJobs > 0 ? "pass" : "warning",
      explanation: !databaseConnected
        ? "Could not inspect the backfill queue because the database is unavailable."
        : queuedBackfillJobs > 0
          ? `${queuedBackfillJobs} queued or active backfill job${queuedBackfillJobs === 1 ? "" : "s"} ready for controlled runs.`
          : "No queued backfill jobs are currently waiting. That is fine, but historical coverage will stay limited until jobs are created.",
      href: "/sources/backfill"
    })
  );

  try {
    const aiKeyConfigured = configured("OPENAI_API_KEY");

    if (!aiKeyConfigured) {
      items.push(
        makeItem(checkedAt, {
          id: "ai-extraction",
          label: "AI extraction status",
          status: "warning",
          explanation: "OPENAI_API_KEY is missing, so real AI extraction remains unavailable. Mock and heuristic review paths still work.",
          href: "/review"
        })
      );
    } else {
      const aiExtraction = await withTimeout(
        extractStructuredTVDataWithAI({
          id: "launch-ai-check",
          headline: "Netflix orders mystery drama Harbor Lights to series",
          publication: "Deadline",
          url: "https://example.com/launch-ai-check",
          summary: "Netflix orders the mystery drama Harbor Lights to series with A24 Television.",
          extractedText:
            "Netflix has ordered mystery drama Harbor Lights to series from A24 Television. Maya Rivers created the project and Noor Hassan is attached to write. The show follows a coastal medical examiner investigating port corruption."
        }),
        20_000,
        "AI extraction dry-run timed out."
      );

      items.push(
        makeItem(checkedAt, {
          id: "ai-extraction",
          label: "AI extraction status",
          status: aiExtraction.title && aiExtraction.category ? "pass" : "warning",
          explanation: aiExtraction.title && aiExtraction.category
            ? `AI extraction dry-run returned ${aiExtraction.category.replaceAll("_", " ")} with ${aiExtraction.confidenceLevel} confidence.`
            : "AI extraction responded, but the dry-run payload was incomplete and should be reviewed before launch.",
          href: "/review"
        })
      );
    }
  } catch (error) {
    items.push(
      makeItem(checkedAt, {
        id: "ai-extraction",
        label: "AI extraction status",
        status: production ? "fail" : "warning",
        explanation: error instanceof Error ? error.message : "AI extraction dry-run failed.",
        href: "/review"
      })
    );
  }

  try {
    const payload = await generateWeeklyReportPayload(getDefaultFriday(new Date()).toISOString(), true);
    items.push(
      makeItem(checkedAt, {
        id: "weekly-report",
        label: "Weekly report generation status",
        status: payload.markdown.trim() ? "pass" : "warning",
        explanation: payload.markdown.trim()
          ? "Safe mock weekly report generation succeeded."
          : "Weekly report generation completed, but the mock payload came back empty.",
        href: "/weekly-reports"
      })
    );
  } catch (error) {
    items.push(
      makeItem(checkedAt, {
        id: "weekly-report",
        label: "Weekly report generation status",
        status: "fail",
        explanation: error instanceof Error ? error.message : "Weekly report generation check failed.",
        href: "/weekly-reports"
      })
    );
  }

  try {
    const html = renderEmailHtml({
      title: "Launch Checklist Dry Run",
      intro: "This is a safe preview check for scheduled team email readiness.",
      bodyMarkdown: "- Weekly report digests\n- Watchlist alerts\n- Link back to the app",
      appUrl: process.env.NEXT_PUBLIC_APP_URL ?? null
    });

    items.push(
      makeItem(checkedAt, {
        id: "email",
        label: "Email provider status",
        status: emailDeliveryConfigured() ? "pass" : "warning",
        explanation: emailDeliveryConfigured()
          ? `Dry-run email rendering succeeded and Resend delivery is configured. Preview size: ${html.length} characters.`
          : `Dry-run email rendering succeeded, but delivery keys are missing so emails will stay in preview mode. Preview size: ${html.length} characters.`,
        href: "/settings/notifications"
      })
    );
  } catch (error) {
    items.push(
      makeItem(checkedAt, {
        id: "email",
        label: "Email provider status",
        status: "fail",
        explanation: error instanceof Error ? error.message : "Email dry-run rendering failed.",
        href: "/settings/notifications"
      })
    );
  }

  const cronEntries = await readVercelCronConfig();
  const requiredCronPaths = ["/api/cron/backfill-next", "/api/cron/send-weekly-report"];
  const optionalCronPaths = ["/api/cron/send-alert-digest"];
  const missingRequiredCronPaths = requiredCronPaths.filter(
    (path) => !cronEntries.some((entry) => entry.path === path)
  );
  const missingOptionalCronPaths = optionalCronPaths.filter(
    (path) => !cronEntries.some((entry) => entry.path === path)
  );
  const cronSecretConfigured = configured("CRON_SECRET");

  if (production && (!cronSecretConfigured || missingRequiredCronPaths.length > 0)) {
    productionWarnings.push("Production warning: cron protection or required cron schedules are missing, so automated backfill/report jobs are not fully ready.");
  }
  if (production && configured("ADMIN_PASSWORD") && !authConfigured) {
    productionWarnings.push("Production warning: ADMIN_PASSWORD is still acting as the only real protection path. Finish team auth before launch.");
  }

  items.push(
    makeItem(checkedAt, {
      id: "cron",
      label: "Cron configuration status",
      status: missingRequiredCronPaths.length
        ? "fail"
        : !cronSecretConfigured || missingOptionalCronPaths.length
          ? "warning"
          : "pass",
      explanation: missingRequiredCronPaths.length
        ? `Required cron schedules are missing for: ${missingRequiredCronPaths.join(", ")}.`
        : !cronSecretConfigured
          ? "Cron schedules are present, but CRON_SECRET is missing."
          : missingOptionalCronPaths.length
            ? `Required schedules are present. Optional cron still missing for: ${missingOptionalCronPaths.join(", ")}.`
            : "Required cron schedules and CRON_SECRET are configured.",
      href: "/admin/status"
    })
  );

  items.push(
    makeItem(checkedAt, {
      id: "audit",
      label: "Audit logging status",
      status: !databaseConnected ? "warning" : auditCount > 0 ? "pass" : "warning",
      explanation: !databaseConnected
        ? "Could not confirm audit logging because the database is unavailable."
        : auditCount > 0
          ? `${auditCount} audit log entr${auditCount === 1 ? "y" : "ies"} already recorded.`
          : "Audit logging table is reachable, but no entries exist yet.",
      href: "/admin/audit-log"
    }),
    makeItem(checkedAt, {
      id: "rate-limiting",
      label: "Rate limiting status",
      status: databaseConnected ? "pass" : "warning",
      explanation: databaseConnected
        ? "Job-run storage and lock records are available for operational rate limits and duplicate-run prevention."
        : "Rate limiting logic exists, but database-backed job controls could not be verified in this run.",
      href: "/admin/jobs"
    }),
    makeItem(checkedAt, {
      id: "duplicate-detection",
      label: "Duplicate detection status",
      status: databaseConnected ? "pass" : "warning",
      explanation: databaseConnected
        ? duplicateCount > 0
          ? `${duplicateCount} record${duplicateCount === 1 ? "" : "s"} already flagged for duplicate review.`
          : "Duplicate review tooling is active, but there are no flagged duplicates at the moment."
        : "Duplicate review tooling is present, but database flags could not be checked in this run.",
      href: "/duplicates"
    })
  );

  return {
    checkedAt,
    items,
    productionWarnings,
    summary: summarizeCounts(items)
  };
}
