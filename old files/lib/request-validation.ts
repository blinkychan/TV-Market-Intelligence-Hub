import { z } from "zod";

export const urlSchema = z.string().url().max(2048);
export const csvFileNameSchema = z.string().trim().toLowerCase().regex(/\.csv$/i, "Only CSV files are supported.");

export const bulkPayloadSchema = z.object({
  entityType: z.enum(["Project", "CurrentShow", "Article"]),
  ids: z.array(z.string().min(1)).max(500),
  action: z.string().min(1).max(64),
  value: z.string().max(1000).nullable().optional(),
  confirm: z.boolean().optional(),
  dryRun: z.boolean().optional()
});

export const importPayloadSchema = z.object({
  entityType: z.enum(["projects", "current-shows", "buyers", "companies", "people", "articles"]),
  fileName: csvFileNameSchema.optional(),
  rows: z.array(z.record(z.string(), z.string().max(5000))).max(1000)
});

export const reportQuerySchema = z.object({
  id: z.string().optional(),
  format: z.enum(["md", "pdf", "csv"]).optional(),
  reportDate: z.string().optional(),
  source: z.enum(["mock", "database"]).optional()
});

export function limitTextSize(value: string | null | undefined, maxLength: number, label: string) {
  if ((value ?? "").length > maxLength) {
    throw new Error(`${label} is too large.`);
  }
}
