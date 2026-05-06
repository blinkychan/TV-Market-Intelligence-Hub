import { randomUUID } from "node:crypto";
import { Prisma } from "@prisma/client";
import { subMinutes } from "date-fns";
import { readMockPreviewState, saveMockJobRuns, type MockJobRun } from "@/lib/mock-preview-store";
import { prisma } from "@/lib/prisma";
import { canUseMockPreview } from "@/lib/runtime-mode";

export type ControlledJobType =
  | "rss_ingestion"
  | "body_extraction"
  | "ai_extraction"
  | "backfill"
  | "csv_import"
  | "email_send"
  | "report_generation";

export type JobRunStatusValue = "queued" | "running" | "completed" | "failed" | "canceled";

type RateLimitRule = {
  windowMinutes: number;
  maxRuns: number;
};

const RATE_LIMIT_RULES: Record<ControlledJobType, RateLimitRule> = {
  rss_ingestion: { windowMinutes: 10, maxRuns: 2 },
  body_extraction: { windowMinutes: 5, maxRuns: 10 },
  ai_extraction: { windowMinutes: 10, maxRuns: 12 },
  backfill: { windowMinutes: 30, maxRuns: 4 },
  csv_import: { windowMinutes: 10, maxRuns: 6 },
  email_send: { windowMinutes: 30, maxRuns: 8 },
  report_generation: { windowMinutes: 10, maxRuns: 8 }
};

function toJson(value: unknown): Prisma.InputJsonValue | Prisma.NullableJsonNullValueInput | undefined {
  if (value === undefined) return undefined;
  if (value === null) return Prisma.JsonNull;
  return value as Prisma.InputJsonValue;
}

function shouldUseMockJobStore() {
  return canUseMockPreview() && process.env.NODE_ENV !== "production";
}

function fromMockJob(job: MockJobRun) {
  return job;
}

export class JobControlError extends Error {
  code: "rate_limited" | "locked" | "duplicate" | "not_found" | "not_cancelable";

  constructor(code: JobControlError["code"], message: string) {
    super(message);
    this.code = code;
  }
}

export async function enforceRateLimit(args: {
  jobType: ControlledJobType;
  createdByEmail?: string | null;
  lockKey?: string | null;
}) {
  const rule = RATE_LIMIT_RULES[args.jobType];
  const since = subMinutes(new Date(), rule.windowMinutes);

  if (shouldUseMockJobStore()) {
    const state = await readMockPreviewState();
    const count = state.jobRuns.filter((job) => {
      if (job.jobType !== args.jobType) return false;
      if (args.createdByEmail && job.createdByEmail !== args.createdByEmail) return false;
      if (args.lockKey && job.lockKey !== args.lockKey) return false;
      return job.createdAt >= since;
    }).length;

    if (count >= rule.maxRuns) {
      throw new JobControlError("rate_limited", `Too many ${args.jobType.replaceAll("_", " ")} requests in a short window. Please wait and try again.`);
    }
    return;
  }

  const count = await prisma.jobRun.count({
    where: {
      jobType: args.jobType,
      createdAt: { gte: since },
      ...(args.createdByEmail ? { createdByEmail: args.createdByEmail } : {}),
      ...(args.lockKey ? { lockKey: args.lockKey } : {})
    }
  });

  if (count >= rule.maxRuns) {
    throw new JobControlError("rate_limited", `Too many ${args.jobType.replaceAll("_", " ")} requests in a short window. Please wait and try again.`);
  }
}

export async function startJobRun(args: {
  jobType: ControlledJobType;
  createdByUserId?: string | null;
  createdByEmail?: string | null;
  inputJson?: unknown;
  lockKey?: string | null;
  dedupeMinutes?: number;
}) {
  if (shouldUseMockJobStore()) {
    const state = await readMockPreviewState();
    if (args.lockKey) {
      const locked = state.jobRuns.find((job) => job.lockKey === args.lockKey && job.status === "running");
      if (locked) {
        throw new JobControlError("locked", `Another ${args.jobType.replaceAll("_", " ")} job is already running for this target.`);
      }
    }

    if (args.lockKey && args.dedupeMinutes) {
      const duplicateWindow = subMinutes(new Date(), args.dedupeMinutes);
      const duplicate = state.jobRuns.find(
        (job) =>
          job.lockKey === args.lockKey &&
          job.jobType === args.jobType &&
          job.status === "completed" &&
          job.createdAt >= duplicateWindow
      );
      if (duplicate) {
        throw new JobControlError("duplicate", `This ${args.jobType.replaceAll("_", " ")} job already completed recently.`);
      }
    }

    const now = new Date();
    const nextJob: MockJobRun = {
      id: randomUUID(),
      jobType: args.jobType,
      status: "running",
      startedAt: now,
      completedAt: null,
      createdByUserId: args.createdByUserId ?? null,
      createdByEmail: args.createdByEmail ?? null,
      inputJson: args.inputJson ?? null,
      resultJson: null,
      errorMessage: null,
      lockKey: args.lockKey ?? null,
      createdAt: now,
      updatedAt: now
    };

    await saveMockJobRuns([nextJob, ...state.jobRuns].slice(0, 200));
    return fromMockJob(nextJob);
  }

  if (args.lockKey) {
    const locked = await prisma.jobRun.findFirst({
      where: {
        lockKey: args.lockKey,
        status: "running"
      },
      select: { id: true }
    });
    if (locked) {
      throw new JobControlError("locked", `Another ${args.jobType.replaceAll("_", " ")} job is already running for this target.`);
    }
  }

  if (args.lockKey && args.dedupeMinutes) {
    const duplicateWindow = subMinutes(new Date(), args.dedupeMinutes);
    const duplicate = await prisma.jobRun.findFirst({
      where: {
        lockKey: args.lockKey,
        jobType: args.jobType,
        status: "completed",
        createdAt: { gte: duplicateWindow }
      },
      select: { id: true }
    });
    if (duplicate) {
      throw new JobControlError("duplicate", `This ${args.jobType.replaceAll("_", " ")} job already completed recently.`);
    }
  }

  return prisma.jobRun.create({
    data: {
      jobType: args.jobType,
      status: "running",
      startedAt: new Date(),
      createdByUserId: args.createdByUserId ?? null,
      createdByEmail: args.createdByEmail ?? null,
      inputJson: toJson(args.inputJson),
      lockKey: args.lockKey ?? null
    }
  });
}

export async function completeJobRun(jobRunId: string, resultJson?: unknown) {
  if (shouldUseMockJobStore()) {
    const state = await readMockPreviewState();
    const now = new Date();
    await saveMockJobRuns(
      state.jobRuns.map((job) =>
        job.id === jobRunId
          ? {
              ...job,
              status: "completed",
              completedAt: now,
              resultJson: resultJson ?? null,
              updatedAt: now
            }
          : job
      )
    );
    return;
  }

  return prisma.jobRun.update({
    where: { id: jobRunId },
    data: {
      status: "completed",
      completedAt: new Date(),
      resultJson: toJson(resultJson)
    }
  });
}

export async function failJobRun(jobRunId: string, errorMessage: string, resultJson?: unknown) {
  if (shouldUseMockJobStore()) {
    const state = await readMockPreviewState();
    const now = new Date();
    await saveMockJobRuns(
      state.jobRuns.map((job) =>
        job.id === jobRunId
          ? {
              ...job,
              status: "failed",
              completedAt: now,
              errorMessage,
              resultJson: resultJson ?? null,
              updatedAt: now
            }
          : job
      )
    );
    return;
  }

  return prisma.jobRun.update({
    where: { id: jobRunId },
    data: {
      status: "failed",
      completedAt: new Date(),
      errorMessage,
      resultJson: toJson(resultJson)
    }
  });
}

export async function cancelJobRun(jobRunId: string) {
  if (shouldUseMockJobStore()) {
    const state = await readMockPreviewState();
    const job = state.jobRuns.find((entry) => entry.id === jobRunId);
    if (!job) throw new JobControlError("not_found", "Job not found.");
    if (job.status !== "queued" && job.status !== "running") {
      throw new JobControlError("not_cancelable", "Only queued or running jobs can be canceled.");
    }

    const now = new Date();
    await saveMockJobRuns(
      state.jobRuns.map((entry) =>
        entry.id === jobRunId
          ? {
              ...entry,
              status: "canceled",
              completedAt: now,
              updatedAt: now
            }
          : entry
      )
    );
    return;
  }

  const job = await prisma.jobRun.findUnique({ where: { id: jobRunId } });
  if (!job) throw new JobControlError("not_found", "Job not found.");
  if (job.status !== "queued" && job.status !== "running") {
    throw new JobControlError("not_cancelable", "Only queued or running jobs can be canceled.");
  }

  return prisma.jobRun.update({
    where: { id: jobRunId },
    data: {
      status: "canceled",
      completedAt: new Date()
    }
  });
}

export async function getAdminJobRuns() {
  if (shouldUseMockJobStore()) {
    const state = await readMockPreviewState();
    return state.jobRuns
      .slice()
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, 100);
  }

  return prisma.jobRun.findMany({
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    take: 100
  }).catch(() => []);
}

export async function getJobRunById(id: string) {
  if (shouldUseMockJobStore()) {
    const state = await readMockPreviewState();
    return state.jobRuns.find((job) => job.id === id) ?? null;
  }

  return prisma.jobRun.findUnique({ where: { id } }).catch(() => null);
}

export async function ensureJobRunActive(jobRunId: string) {
  const job = await getJobRunById(jobRunId);
  if (!job) {
    throw new JobControlError("not_found", "Job not found.");
  }
  if (job.status === "canceled") {
    throw new JobControlError("not_cancelable", "This job was canceled before it finished.");
  }
  return job;
}

export async function withControlledJob<T>(args: {
  jobType: ControlledJobType;
  createdByUserId?: string | null;
  createdByEmail?: string | null;
  inputJson?: unknown;
  lockKey?: string | null;
  dedupeMinutes?: number;
  skipRateLimitInMock?: boolean;
  handler: (jobRun: { id: string }) => Promise<T>;
}) {
  if (!(canUseMockPreview() && args.skipRateLimitInMock)) {
    await enforceRateLimit({
      jobType: args.jobType,
      createdByEmail: args.createdByEmail,
      lockKey: args.lockKey
    });
  }

  const jobRun = await startJobRun({
    jobType: args.jobType,
    createdByUserId: args.createdByUserId,
    createdByEmail: args.createdByEmail,
    inputJson: args.inputJson,
    lockKey: args.lockKey,
    dedupeMinutes: args.dedupeMinutes
  });

  try {
    const result = await args.handler({ id: jobRun.id });
    await completeJobRun(jobRun.id, result);
    return result;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown job failure.";
    await failJobRun(jobRun.id, message);
    throw error;
  }
}

export function coerceJobStatus(value: string | null | undefined): JobRunStatusValue {
  if (value === "queued" || value === "running" || value === "completed" || value === "failed" || value === "canceled") {
    return value;
  }
  return "queued";
}
