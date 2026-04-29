import { mockReviewArticles } from "@/lib/mock-review";
import { inferSourceReliability } from "@/lib/source-reliability";

type ArticleLike = {
  id: string;
  headline: string;
  summary?: string | null;
  extractedText?: string | null;
  extractedExcerpt?: string | null;
  publication?: string | null;
  url?: string | null;
  publishedDate?: Date | string | null;
};

export type StructuredTVExtraction = {
  title: string | null;
  category:
    | "development"
    | "current_show"
    | "acquisition"
    | "co_production"
    | "international"
    | "casting"
    | "renewal"
    | "cancellation";
  status: string | null;
  format: string | null;
  logline: string | null;
  buyer: string | null;
  studio: string | null;
  productionCompanies: string[];
  people: string[];
  country: string | null;
  announcementDate: Date | null;
  premiereDate: Date | null;
  confidenceScore: number | null;
  fieldsNeedingReview: string[];
  suggestedRelationships: string | null;
  dedupeCandidate: boolean;
  dedupeReason: string | null;
  sourceReliability: "high" | "medium" | "low";
  extractionBasis: "body" | "excerpt" | "summary" | "headline";
  warning: string | null;
  mode: "mock" | "placeholder";
};

function normalizeDate(value?: Date | string | null) {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function inferCategory(headline: string, summary: string) {
  const text = `${headline} ${summary}`.toLowerCase();
  if (text.includes("co-production")) return "co_production" as const;
  if (text.includes("international")) return "international" as const;
  if (text.includes("acquisition") || text.includes("adaptation")) return "acquisition" as const;
  if (text.includes("cast") || text.includes("joins")) return "casting" as const;
  if (text.includes("renew")) return "renewal" as const;
  if (text.includes("cancel")) return "cancellation" as const;
  if (text.includes("premiere")) return "current_show" as const;
  return "development" as const;
}

function inferStatus(category: StructuredTVExtraction["category"], headline: string) {
  const normalized = headline.toLowerCase();
  if (normalized.includes("pilot")) return "pilot_order";
  if (normalized.includes("picked up") || normalized.includes("series")) return "series_order";
  if (normalized.includes("renew")) return "renewed";
  if (normalized.includes("cancel")) return "canceled";
  if (category === "current_show") return "airing";
  if (normalized.includes("sale") || normalized.includes("lands at") || normalized.includes("sells to")) return "sold";
  return "in_development";
}

function inferBuyer(headline: string) {
  const knownBuyers = ["Netflix", "HBO", "ABC", "FX", "Peacock", "Apple TV+", "BBC", "Fremantle", "CBC"];
  return knownBuyers.find((buyer) => headline.includes(buyer)) ?? null;
}

function inferTitle(headline: string) {
  const matches = headline.match(/["']([^"']+)["']/);
  if (matches?.[1]) return matches[1];

  const titleCaseSegments = headline.match(/\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+){0,4})\b/g);
  return titleCaseSegments?.[0] ?? headline.split(" ").slice(0, 4).join(" ");
}

function mockLookup(article: ArticleLike) {
  return mockReviewArticles.find(
    (candidate) =>
      candidate.id === article.id ||
      candidate.url === (article as { url?: string }).url ||
      candidate.headline.toLowerCase() === article.headline.toLowerCase()
  );
}

export async function extractStructuredTVData(
  article: ArticleLike,
  mode: "mock" | "placeholder" = "placeholder"
): Promise<StructuredTVExtraction> {
  const sourceReliability = inferSourceReliability(article.publication, article.url);
  const bodyText = article.extractedText?.trim() || "";
  const excerptText = article.extractedExcerpt?.trim() || "";
  const summary = article.summary ?? "";
  const extractionBasis = bodyText ? "body" : excerptText ? "excerpt" : summary ? "summary" : "headline";
  const sourceText = bodyText || excerptText || summary || article.headline;

  if (mode === "mock") {
    const mock = mockLookup(article);
    if (mock) {
      return {
        title: mock.extractedProjectTitle,
        category: (() => {
          const value = (mock.suspectedCategory ?? "").toLowerCase();
          if (value.includes("current")) return "current_show";
          if (value.includes("acquisition")) return "acquisition";
          if (value.includes("co-production")) return "co_production";
          if (value.includes("international")) return "international";
          if (value.includes("talent")) return "casting";
          if (value.includes("renewal")) return "renewal";
          if (value.includes("cancellation")) return "cancellation";
          return "development";
        })(),
        status: mock.extractedStatus,
        format: mock.extractedFormat,
        logline: mock.extractedLogline,
        buyer: mock.extractedBuyer,
        studio: mock.extractedStudio,
        productionCompanies: (mock.extractedCompanies ?? "").split(",").map((item) => item.trim()).filter(Boolean),
        people: (mock.extractedPeople ?? "").split(",").map((item) => item.trim()).filter(Boolean),
        country: mock.extractedCountry,
        announcementDate: normalizeDate(mock.extractedAnnouncementDate),
        premiereDate: normalizeDate(mock.extractedPremiereDate),
        confidenceScore: mock.confidenceScore,
        fieldsNeedingReview: (mock.extractedFieldsNeedingReview ?? "").split(",").map((item) => item.trim()).filter(Boolean),
        suggestedRelationships: mock.extractedRelationships,
        dedupeCandidate: mock.extractionStatus === "Duplicate" || Boolean(mock.extractedDeduplicationNotes),
        dedupeReason: mock.extractedDeduplicationNotes ?? null,
        sourceReliability: inferSourceReliability(mock.publication, mock.url),
        extractionBasis:
          mock.extractedText ? "body" : mock.extractedExcerpt ? "excerpt" : mock.summary ? "summary" : "headline",
        warning: !mock.extractedText && !mock.extractedExcerpt && !mock.summary ? "Low confidence: headline-only extraction." : null,
        mode: "mock"
      };
    }
  }

  const category = inferCategory(article.headline, sourceText);
  const buyer = inferBuyer(sourceText);
  const title = inferTitle(article.headline);
  const confidenceBase = extractionBasis === "body" ? 0.84 : extractionBasis === "excerpt" ? 0.74 : extractionBasis === "summary" ? 0.68 : 0.42;
  const confidenceScore = category === "current_show" ? confidenceBase + 0.04 : confidenceBase;
  const fieldsNeedingReview = [];

  if (!buyer) fieldsNeedingReview.push("buyer");
  if (!bodyText && !excerptText && !summary) fieldsNeedingReview.push("Low confidence: headline-only extraction.");
  if (!bodyText && !excerptText) fieldsNeedingReview.push("logline");
  if (category === "current_show") fieldsNeedingReview.push("premiere date");
  if (!bodyText) fieldsNeedingReview.push("body text unavailable");

  return {
    title,
    category,
    status: inferStatus(category, article.headline),
    format: category === "current_show" ? "Current series" : "Development project",
    logline: (bodyText || excerptText || summary) || null,
    buyer,
    studio: null,
    productionCompanies: [],
    people: [],
    country: null,
    announcementDate: normalizeDate(article.publishedDate),
    premiereDate: null,
    confidenceScore,
    fieldsNeedingReview,
    suggestedRelationships: buyer ? `${buyer} attached to ${title}` : null,
    dedupeCandidate: false,
    dedupeReason: null,
    sourceReliability,
    extractionBasis,
    warning: extractionBasis === "headline" ? "Low confidence: headline-only extraction." : null,
    mode: "placeholder"
  };
}
