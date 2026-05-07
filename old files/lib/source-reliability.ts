export type SourceReliability = "high" | "medium" | "low";

const HIGH_RELIABILITY_PATTERNS = [
  "deadline",
  "variety",
  "hollywood reporter",
  "thewrap",
  "tvline",
  "press",
  "abc",
  "nbcuniversal",
  "bbc"
];

const MEDIUM_RELIABILITY_PATTERNS = ["aggregator", "screenrant", "tvseriesfinale", "deadline brief", "recap"];

export function inferSourceReliability(publication?: string | null, url?: string | null): SourceReliability {
  const text = `${publication ?? ""} ${url ?? ""}`.toLowerCase();
  if (HIGH_RELIABILITY_PATTERNS.some((pattern) => text.includes(pattern))) return "high";
  if (MEDIUM_RELIABILITY_PATTERNS.some((pattern) => text.includes(pattern))) return "medium";
  return "low";
}

export function sourceReliabilityTone(value?: string | null) {
  if (value === "high") return "bg-emerald-50 text-emerald-700 ring-emerald-200";
  if (value === "medium") return "bg-amber-50 text-amber-800 ring-amber-200";
  return "bg-slate-100 text-slate-700 ring-slate-200";
}
