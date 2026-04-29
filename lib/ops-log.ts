type LogLevel = "info" | "warn" | "error";

type LogMeta = Record<string, unknown>;

function sanitizeMeta(meta?: LogMeta) {
  if (!meta) return undefined;

  return Object.fromEntries(
    Object.entries(meta).filter(([key]) => {
      const lowered = key.toLowerCase();
      return !lowered.includes("password") && !lowered.includes("secret") && !lowered.includes("token") && !lowered.includes("key");
    })
  );
}

export function logOperationalEvent(level: LogLevel, message: string, meta?: LogMeta) {
  const payload = sanitizeMeta(meta);
  const logger = level === "error" ? console.error : level === "warn" ? console.warn : console.info;
  logger(`[TVMIH] ${message}`, payload ?? {});
}
