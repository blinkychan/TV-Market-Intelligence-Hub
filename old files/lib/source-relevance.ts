import { getSourceConnector, type SourceConnector } from "@/lib/source-connectors";
import { inferSourceReliability } from "@/lib/source-reliability";

export type ArticleClassification =
  | "development_sale"
  | "pilot_order"
  | "series_order"
  | "acquisition"
  | "co_production"
  | "international"
  | "renewal"
  | "cancellation"
  | "casting"
  | "premiere_date"
  | "current_tv"
  | "unrelated"
  | "unknown";

export type RelevanceDecision = "review_queue" | "possible_match" | "excluded";
export type RelevanceBand = "high" | "medium" | "low";

export type SourceArticleInput = {
  headline: string;
  summary?: string | null;
  excerpt?: string | null;
  bodyText?: string | null;
  publication?: string | null;
  url?: string | null;
};

export type RelevanceResult = {
  score: number;
  band: RelevanceBand;
  decision: RelevanceDecision;
  classification: ArticleClassification;
  reasons: string[];
  primaryReason: string;
};

const DEVELOPMENT_KEYWORDS = ["series", "development", "lands at", "sells to", "script sale", "package", "buyer", "studio", "showrunner"];
const CURRENT_TV_KEYWORDS = ["premiere", "premiere date", "returning", "finale", "season finale", "special", "episode", "airs"];
const HIGH_IMPACT_KEYWORDS = ["pilot order", "series order", "straight-to-series", "ordered", "picked up", "renewed", "canceled"];

function normalizeText(input: SourceArticleInput) {
  return [input.headline, input.summary, input.excerpt, input.bodyText].filter(Boolean).join(" ").toLowerCase();
}

function keywordHits(text: string, keywords: string[]) {
  return keywords.filter((keyword) => text.includes(keyword.toLowerCase()));
}

function classifyArticle(text: string): ArticleClassification {
  if (text.includes("pilot order") || (text.includes("pilot") && text.includes("ordered"))) return "pilot_order";
  if (text.includes("series order") || text.includes("straight-to-series") || text.includes("picked up")) return "series_order";
  if (text.includes("acquire") || text.includes("rights") || text.includes("remake")) return "acquisition";
  if (text.includes("co-production") || text.includes("coproduction")) return "co_production";
  if (text.includes("international")) return "international";
  if (text.includes("renewed") || text.includes("renewal")) return "renewal";
  if (text.includes("canceled") || text.includes("cancellation")) return "cancellation";
  if (text.includes("cast") || text.includes("joins") || text.includes("attached to star")) return "casting";
  if (text.includes("premiere date") || text.includes("sets premiere")) return "premiere_date";
  if (text.includes("premiere") || text.includes("returning") || text.includes("finale") || text.includes("special")) return "current_tv";
  if (text.includes("lands at") || text.includes("sells to") || text.includes("development") || text.includes("script sale")) return "development_sale";
  if (text.includes("box office") || text.includes("film review") || text.includes("music") || text.includes("red carpet")) return "unrelated";
  return "unknown";
}

export function scoreArticleRelevance(article: SourceArticleInput, connectorOverride?: Partial<SourceConnector> | null): RelevanceResult {
  const baseConnector = getSourceConnector(article.publication ?? "");
  const connector = connectorOverride
    ? ({
        name: article.publication ?? baseConnector?.name ?? "Unknown Source",
        sourceType: baseConnector?.sourceType ?? "rss",
        baseUrl: article.url ?? baseConnector?.baseUrl ?? "",
        rssUrls: baseConnector?.rssUrls ?? [],
        enabled: baseConnector?.enabled ?? true,
        reliabilityScore: baseConnector?.reliabilityScore ?? 0.6,
        allowedCategories: baseConnector?.allowedCategories ?? [],
        blockedKeywords: baseConnector?.blockedKeywords ?? [],
        preferredKeywords: baseConnector?.preferredKeywords ?? [],
        notes: baseConnector?.notes ?? "",
        ...connectorOverride
      } as SourceConnector)
    : baseConnector;

  const sourceReliability = connector?.reliabilityScore ?? (inferSourceReliability(article.publication, article.url) === "high" ? 0.9 : inferSourceReliability(article.publication, article.url) === "medium" ? 0.65 : 0.4);
  const text = normalizeText(article);
  const classification = classifyArticle(text);
  const preferred = keywordHits(text, connector?.preferredKeywords ?? []);
  const blocked = keywordHits(text, connector?.blockedKeywords ?? []);
  const development = keywordHits(text, DEVELOPMENT_KEYWORDS);
  const currentTv = keywordHits(text, CURRENT_TV_KEYWORDS);
  const impact = keywordHits(text, HIGH_IMPACT_KEYWORDS);

  let score = sourceReliability * 0.35;
  const reasons: string[] = [];

  if (preferred.length) {
    score += Math.min(0.28, preferred.length * 0.06);
    reasons.push(`Preferred keywords matched: ${preferred.slice(0, 4).join(", ")}`);
  }
  if (development.length) {
    score += Math.min(0.18, development.length * 0.04);
    reasons.push(`Development signals matched: ${development.slice(0, 4).join(", ")}`);
  }
  if (currentTv.length) {
    score += Math.min(0.16, currentTv.length * 0.04);
    reasons.push(`Current TV signals matched: ${currentTv.slice(0, 4).join(", ")}`);
  }
  if (impact.length) {
    score += Math.min(0.12, impact.length * 0.04);
    reasons.push(`High-impact keywords matched: ${impact.slice(0, 3).join(", ")}`);
  }
  if (article.bodyText?.trim()) {
    score += 0.08;
    reasons.push("Article body text available.");
  } else if (article.excerpt?.trim() || article.summary?.trim()) {
    score += 0.03;
    reasons.push("Excerpt/summary available.");
  } else {
    reasons.push("Headline-only relevance check.");
  }
  if (blocked.length) {
    score -= Math.min(0.45, blocked.length * 0.16);
    reasons.push(`Blocked keywords matched: ${blocked.slice(0, 4).join(", ")}`);
  }
  if (classification === "unrelated") {
    score -= 0.35;
    reasons.push("Classified as unrelated entertainment coverage.");
  } else if (classification === "unknown") {
    score -= 0.08;
    reasons.push("No clear TV development or premiere classification.");
  } else {
    reasons.push(`Classified as ${classification.replaceAll("_", " ")}.`);
  }

  score = Math.max(0, Math.min(1, score));

  const band: RelevanceBand = score >= 0.72 ? "high" : score >= 0.48 ? "medium" : "low";
  const decision: RelevanceDecision = band === "high" ? "review_queue" : band === "medium" ? "possible_match" : "excluded";
  const primaryReason =
    blocked[0]
      ? `Blocked by keyword: ${blocked[0]}`
      : decision === "review_queue"
        ? "High-confidence TV market relevance"
        : decision === "possible_match"
          ? "Ambiguous but potentially relevant"
          : "Low-signal or unrelated entertainment coverage";

  return {
    score,
    band,
    decision,
    classification,
    reasons,
    primaryReason
  };
}
