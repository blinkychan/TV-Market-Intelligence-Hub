import type { ConfidenceLevel } from "@prisma/client";

export type ConfidenceComputation = {
  score: number;
  level: ConfidenceLevel;
  reasons: string[];
};

export type ExtractionSource = "ai" | "heuristic" | "manual" | "headline_only";

export type ArticleConfidenceInput = {
  sourceReliability?: string | null;
  extractionSource?: string | null;
  bodyAvailable?: boolean | null;
  extractedText?: string | null;
  extractedExcerpt?: string | null;
  summary?: string | null;
  title?: string | null;
  buyer?: string | null;
  studio?: string | null;
  companies?: string | null;
  people?: string | null;
  status?: string | null;
  country?: string | null;
  sourceMaterial?: string | null;
  humanEdited?: boolean;
};

export type ProjectConfidenceInput = {
  sourceReliability?: string | null;
  bodyAvailable?: boolean | null;
  title?: string | null;
  buyer?: string | null;
  studio?: string | null;
  genre?: string | null;
  status?: string | null;
  country?: string | null;
  announcementDate?: Date | string | null;
  logline?: string | null;
  sourceUrl?: string | null;
  productionCompanies?: string[];
  people?: string[];
  needsReview?: boolean;
  humanEdited?: boolean;
};

export type CurrentShowConfidenceInput = {
  sourceReliability?: string | null;
  title?: string | null;
  networkOrPlatform?: string | null;
  premiereDate?: Date | string | null;
  finaleDate?: Date | string | null;
  studio?: string | null;
  productionCompanies?: string | null;
  genre?: string | null;
  country?: string | null;
  sourceUrl?: string | null;
  verifiedAt?: Date | string | null;
  needsVerification?: boolean | null;
  notes?: string | null;
  humanEdited?: boolean;
};

function clamp(value: number) {
  return Math.max(0, Math.min(1, value));
}

export function scoreToConfidenceLevel(score: number): ConfidenceLevel {
  if (score >= 0.8) return "high";
  if (score >= 0.55) return "medium";
  return "low";
}

export function confidenceTone(level?: string | null) {
  if (level === "high") return "bg-emerald-50 text-emerald-700 ring-emerald-200";
  if (level === "medium") return "bg-amber-50 text-amber-800 ring-amber-200";
  return "bg-rose-50 text-rose-700 ring-rose-200";
}

export function deriveArticleExtractionSource(args: {
  mode?: string | null;
  extractionBasis?: string | null;
  manual?: boolean;
}): ExtractionSource {
  if (args.manual) return "manual";
  if (args.extractionBasis === "headline") return "headline_only";
  if (args.mode === "ai") return "ai";
  return "heuristic";
}

export function getArticlePriorityScore(input: {
  confidenceLevel?: string | null;
  status?: string | null;
  category?: string | null;
}) {
  let score = 0;
  if (input.confidenceLevel === "low") score += 10;
  else if (input.confidenceLevel === "medium") score += 5;

  const normalizedStatus = (input.status ?? "").toLowerCase();
  const normalizedCategory = (input.category ?? "").toLowerCase();

  if (normalizedStatus === "series_order" || normalizedStatus === "pilot_order" || normalizedStatus === "sold") {
    score += 9;
  }

  if (
    normalizedCategory.includes("series") ||
    normalizedCategory.includes("pilot") ||
    normalizedCategory.includes("sale") ||
    normalizedCategory.includes("acquisition") ||
    normalizedCategory.includes("co-production") ||
    normalizedCategory.includes("co_production") ||
    normalizedCategory.includes("international")
  ) {
    score += 8;
  }

  if (normalizedCategory.includes("casting")) score += 2;
  return score;
}

function reliabilityWeight(reliability?: string | null) {
  if (reliability === "high") return 0.24;
  if (reliability === "medium") return 0.12;
  return 0;
}

function articleCompleteness(input: ArticleConfidenceInput) {
  let score = 0;
  const reasons: string[] = [];

  if (input.title) score += 0.08;
  else reasons.push("Missing key data: title");
  if (input.buyer) score += 0.08;
  else reasons.push("Missing key data: buyer / network / platform");
  if (input.studio) score += 0.05;
  else reasons.push("Missing key data: studio");
  if (input.status) score += 0.05;
  else reasons.push("Missing key data: status");
  if (input.country) score += 0.04;
  if (input.companies) score += 0.05;
  if (input.people) score += 0.05;
  if (input.sourceMaterial) score += 0.03;

  return { score, reasons };
}

export function calculateArticleConfidence(input: ArticleConfidenceInput): ConfidenceComputation {
  let score = 0.18;
  const reasons: string[] = [];

  score += reliabilityWeight(input.sourceReliability);
  if (input.sourceReliability === "high") reasons.push("Reliable source");
  if (input.sourceReliability === "low") reasons.push("Unverified source");

  if (input.extractedText?.trim()) {
    score += 0.24;
    reasons.push("Body text extracted");
  } else if (input.extractedExcerpt?.trim()) {
    score += 0.14;
    reasons.push("Partial body / excerpt available");
  } else if (input.summary?.trim()) {
    score += 0.08;
    reasons.push("Summary-only extraction");
  } else {
    reasons.push("Headline-only extraction");
  }

  if (input.extractionSource === "ai") score += 0.08;
  if (input.extractionSource === "manual") {
    score += 0.14;
    reasons.push("Human-edited extraction");
  }
  if (input.extractionSource === "headline_only") {
    score -= 0.18;
    reasons.push("Headline-only extraction");
  }

  const completeness = articleCompleteness(input);
  score += completeness.score;
  reasons.push(...completeness.reasons);

  if (input.bodyAvailable === false) score -= 0.08;
  if (input.humanEdited) {
    score += 0.08;
    reasons.push("Reviewed / edited by teammate");
  }

  if (input.extractionSource === "headline_only") {
    score = Math.min(score, 0.34);
  }

  const bounded = clamp(score);
  return {
    score: bounded,
    level: scoreToConfidenceLevel(bounded),
    reasons: Array.from(new Set(reasons))
  };
}

export function calculateProjectConfidence(input: ProjectConfidenceInput): ConfidenceComputation {
  let score = 0.28;
  const reasons: string[] = [];

  score += reliabilityWeight(input.sourceReliability);
  if (input.sourceReliability === "high") reasons.push("Reliable source");
  if (input.sourceReliability === "low") reasons.push("Unverified source");
  if (input.bodyAvailable) reasons.push("Derived from body-backed article");

  if (input.title) score += 0.06;
  if (input.buyer) score += 0.07;
  else reasons.push("Missing key data: buyer");
  if (input.studio) score += 0.06;
  else reasons.push("Missing key data: studio");
  if (input.genre) score += 0.05;
  if (input.status) score += 0.05;
  if (input.country) score += 0.04;
  if (input.announcementDate) score += 0.05;
  else reasons.push("Missing key data: announcement date");
  if (input.logline) score += 0.08;
  else reasons.push("Missing key data: logline");
  if (input.sourceUrl) score += 0.05;
  if (input.productionCompanies?.length) score += 0.04;
  if (input.people?.length) score += 0.04;
  if (input.humanEdited) {
    score += 0.08;
    reasons.push("Reviewed / edited by teammate");
  }
  if (input.needsReview) {
    score -= 0.12;
    reasons.push("Needs human review");
  }

  const bounded = clamp(score);
  return {
    score: bounded,
    level: scoreToConfidenceLevel(bounded),
    reasons: Array.from(new Set(reasons))
  };
}

export function calculateCurrentShowConfidence(input: CurrentShowConfidenceInput): ConfidenceComputation {
  let score = 0.26;
  const reasons: string[] = [];

  score += reliabilityWeight(input.sourceReliability);
  if (input.sourceReliability === "high") reasons.push("Reliable source");
  if (input.sourceReliability === "low") reasons.push("Unverified source");

  if (input.title) score += 0.05;
  if (input.networkOrPlatform) score += 0.08;
  else reasons.push("Missing key data: network / platform");
  if (input.premiereDate) score += 0.1;
  else reasons.push("Missing key data: premiere date");
  if (input.finaleDate) score += 0.03;
  if (input.studio) score += 0.05;
  if (input.productionCompanies) score += 0.04;
  if (input.genre) score += 0.04;
  if (input.country) score += 0.04;
  if (input.sourceUrl) score += 0.05;
  if (input.verifiedAt) {
    score += 0.16;
    reasons.push("Premiere date verified");
  }
  if (input.needsVerification) {
    score -= 0.18;
    reasons.push("Needs verification");
  }
  if (input.humanEdited) {
    score += 0.08;
    reasons.push("Reviewed / edited by teammate");
  }

  const bounded = clamp(score);
  return {
    score: bounded,
    level: scoreToConfidenceLevel(bounded),
    reasons: Array.from(new Set(reasons))
  };
}

export function calculateConfidence(
  kind: "article",
  input: ArticleConfidenceInput
): ConfidenceComputation;
export function calculateConfidence(
  kind: "project",
  input: ProjectConfidenceInput
): ConfidenceComputation;
export function calculateConfidence(
  kind: "current_show",
  input: CurrentShowConfidenceInput
): ConfidenceComputation;
export function calculateConfidence(
  kind: "article" | "project" | "current_show",
  input: ArticleConfidenceInput | ProjectConfidenceInput | CurrentShowConfidenceInput
) {
  if (kind === "article") return calculateArticleConfidence(input as ArticleConfidenceInput);
  if (kind === "project") return calculateProjectConfidence(input as ProjectConfidenceInput);
  return calculateCurrentShowConfidence(input as CurrentShowConfidenceInput);
}

export function joinConfidenceReasons(reasons: string[]) {
  return reasons.join(", ");
}

export function parseConfidenceReasons(reasons?: string | null) {
  return (reasons ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

export function isLowConfidenceHighImpact(input: {
  confidenceLevel?: string | null;
  status?: string | null;
  category?: string | null;
}) {
  const lowConfidence = input.confidenceLevel === "low";
  const status = input.status ?? "";
  const category = (input.category ?? "").toLowerCase();
  const highImpact =
    ["sold", "pilot_order", "series_order"].includes(status) ||
    category.includes("series") ||
    category.includes("pilot") ||
    category.includes("sale") ||
    category.includes("acquisition") ||
    category.includes("co-production") ||
    category.includes("international");
  return lowConfidence && highImpact;
}
