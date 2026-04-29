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

type ExtractionBasis = "body" | "excerpt" | "summary" | "headline";
type ExtractionMode = "mock" | "placeholder" | "ai";

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
  genre: string | null;
  format: string | null;
  sourceMaterial: string | null;
  logline: string | null;
  buyer: string | null;
  studio: string | null;
  productionCompanies: string[];
  people: string[];
  country: string | null;
  isAcquisition: boolean;
  isCoProduction: boolean;
  isInternational: boolean;
  announcementDate: Date | null;
  premiereDate: Date | null;
  confidenceScore: number | null;
  fieldsNeedingReview: string[];
  suggestedRelationships: string | null;
  dedupeCandidate: boolean;
  dedupeReason: string | null;
  sourceReliability: "high" | "medium" | "low";
  extractionBasis: ExtractionBasis;
  warning: string | null;
  mode: ExtractionMode;
};

type ExtractionInput = {
  basis: ExtractionBasis;
  sourceText: string;
  headlineOnly: boolean;
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
  if (text.includes("acquisition") || text.includes("adaptation") || text.includes("rights")) return "acquisition" as const;
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

function inferBuyer(text: string) {
  const knownBuyers = ["Netflix", "HBO", "ABC", "FX", "Peacock", "Apple TV+", "BBC", "Fremantle", "CBC"];
  return knownBuyers.find((buyer) => text.includes(buyer)) ?? null;
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
      candidate.url === article.url ||
      candidate.headline.toLowerCase() === article.headline.toLowerCase()
  );
}

function isPreviewArticle(article: ArticleLike) {
  if (article.id.startsWith("mock-")) return true;

  const url = article.url ?? "";
  return url.includes("preview.example.com") || url.includes("mock-feed.example.com");
}

function parseList(value?: string | null) {
  return (value ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function selectExtractionInput(article: ArticleLike): ExtractionInput {
  const bodyText = article.extractedText?.trim() || "";
  const excerptText = article.extractedExcerpt?.trim() || "";
  const summaryText = article.summary?.trim() || "";
  const basis: ExtractionBasis = bodyText ? "body" : excerptText ? "excerpt" : summaryText ? "summary" : "headline";
  return {
    basis,
    sourceText: bodyText || excerptText || summaryText || article.headline,
    headlineOnly: basis === "headline"
  };
}

function clampConfidence(value: number | null, basis: ExtractionBasis) {
  if (value == null) {
    return basis === "headline" ? 0.32 : basis === "summary" ? 0.62 : basis === "excerpt" ? 0.74 : 0.86;
  }

  const bounded = Math.max(0, Math.min(1, value));
  if (basis === "headline") return Math.min(bounded, 0.35);
  if (basis === "summary") return Math.min(bounded, 0.7);
  if (basis === "excerpt") return Math.min(bounded, 0.82);
  return bounded;
}

function mergeHeadlineWarning(fieldsNeedingReview: string[], basis: ExtractionBasis) {
  const next = [...fieldsNeedingReview];
  if (basis === "headline" && !next.includes("Headline-only extraction")) {
    next.unshift("Headline-only extraction");
  }
  if (basis !== "body" && !next.includes("needs source confirmation")) {
    next.push("needs source confirmation");
  }
  return next;
}

function deriveFlags(category: StructuredTVExtraction["category"], input: {
  isAcquisition?: boolean | null;
  isCoProduction?: boolean | null;
  isInternational?: boolean | null;
}) {
  return {
    isAcquisition: input.isAcquisition ?? (category === "acquisition"),
    isCoProduction: input.isCoProduction ?? (category === "co_production"),
    isInternational: input.isInternational ?? (category === "international" || category === "co_production")
  };
}

export async function extractStructuredTVData(
  article: ArticleLike,
  mode: "mock" | "placeholder" = "placeholder"
): Promise<StructuredTVExtraction> {
  const sourceReliability = inferSourceReliability(article.publication, article.url);
  const extractionInput = selectExtractionInput(article);

  if (mode === "mock") {
    const mock = mockLookup(article);
    if (mock) {
      const category = (() => {
        const value = (mock.suspectedCategory ?? "").toLowerCase();
        if (value.includes("current")) return "current_show";
        if (value.includes("acquisition")) return "acquisition";
        if (value.includes("co-production")) return "co_production";
        if (value.includes("international")) return "international";
        if (value.includes("talent")) return "casting";
        if (value.includes("renewal")) return "renewal";
        if (value.includes("cancellation")) return "cancellation";
        return "development";
      })();
      const flags = deriveFlags(category, {
        isAcquisition: mock.extractedIsAcquisition ?? null,
        isCoProduction: mock.extractedIsCoProduction ?? null,
        isInternational: mock.extractedIsInternational ?? null
      });

      return {
        title: mock.extractedProjectTitle,
        category,
        status: mock.extractedStatus,
        genre: mock.extractedGenre ?? null,
        format: mock.extractedFormat,
        sourceMaterial: mock.extractedSourceMaterial ?? null,
        logline: mock.extractedLogline,
        buyer: mock.extractedBuyer,
        studio: mock.extractedStudio,
        productionCompanies: parseList(mock.extractedCompanies),
        people: parseList(mock.extractedPeople),
        country: mock.extractedCountry,
        isAcquisition: flags.isAcquisition,
        isCoProduction: flags.isCoProduction,
        isInternational: flags.isInternational,
        announcementDate: normalizeDate(mock.extractedAnnouncementDate),
        premiereDate: normalizeDate(mock.extractedPremiereDate),
        confidenceScore: clampConfidence(mock.confidenceScore, extractionInput.basis),
        fieldsNeedingReview: mergeHeadlineWarning(parseList(mock.extractedFieldsNeedingReview), extractionInput.basis),
        suggestedRelationships: mock.extractedRelationships,
        dedupeCandidate: mock.extractionStatus === "Duplicate" || Boolean(mock.extractedDeduplicationNotes),
        dedupeReason: mock.extractedDeduplicationNotes ?? null,
        sourceReliability: inferSourceReliability(mock.publication, mock.url),
        extractionBasis: extractionInput.basis,
        warning: extractionInput.headlineOnly ? "Headline-only extraction" : null,
        mode: "mock"
      };
    }
  }

  const category = inferCategory(article.headline, extractionInput.sourceText);
  const buyer = inferBuyer(extractionInput.sourceText);
  const title = inferTitle(article.headline);
  const confidenceBase = extractionInput.basis === "body" ? 0.84 : extractionInput.basis === "excerpt" ? 0.74 : extractionInput.basis === "summary" ? 0.68 : 0.32;
  const confidenceScore = category === "current_show" ? confidenceBase + 0.04 : confidenceBase;
  const fieldsNeedingReview = mergeHeadlineWarning([], extractionInput.basis);

  if (!buyer) fieldsNeedingReview.push("buyer");
  if (!article.extractedText && !article.extractedExcerpt) fieldsNeedingReview.push("logline");
  if (category === "current_show") fieldsNeedingReview.push("premiere date");
  if (!article.extractedText) fieldsNeedingReview.push("body text unavailable");

  const flags = deriveFlags(category, {});

  return {
    title,
    category,
    status: inferStatus(category, article.headline),
    genre: null,
    format: category === "current_show" ? "Current series" : "Development project",
    sourceMaterial: null,
    logline: article.extractedText || article.extractedExcerpt || article.summary || null,
    buyer,
    studio: null,
    productionCompanies: [],
    people: [],
    country: null,
    isAcquisition: flags.isAcquisition,
    isCoProduction: flags.isCoProduction,
    isInternational: flags.isInternational,
    announcementDate: normalizeDate(article.publishedDate),
    premiereDate: null,
    confidenceScore,
    fieldsNeedingReview,
    suggestedRelationships: buyer ? `${buyer} attached to ${title}` : null,
    dedupeCandidate: false,
    dedupeReason: null,
    sourceReliability,
    extractionBasis: extractionInput.basis,
    warning: extractionInput.headlineOnly ? "Headline-only extraction" : null,
    mode: "placeholder"
  };
}

function baseSystemPrompt() {
  return [
    "You extract structured TV market intelligence from article text.",
    "Return valid JSON only.",
    "Do not invent facts that are not supported by the article text.",
    "Use null, false, or empty arrays when information is missing.",
    "Keep confidence low when the article text is incomplete or headline-only.",
    "Fields needing review should be short human-readable strings."
  ].join(" ");
}

function buildAiPrompt(article: ArticleLike, extractionInput: ExtractionInput) {
  return JSON.stringify(
    {
      task: "Extract structured TV market data for human review.",
      instructions: {
        categoryOptions: ["development", "current_show", "acquisition", "co_production", "international", "casting", "renewal", "cancellation"],
        useHeadlineOnlyWarning: extractionInput.headlineOnly,
        doNotInvent: true
      },
      article: {
        headline: article.headline,
        publication: article.publication ?? null,
        publishedDate: article.publishedDate ? new Date(article.publishedDate).toISOString() : null,
        url: article.url ?? null,
        extractionBasis: extractionInput.basis,
        text: extractionInput.sourceText
      },
      responseShape: {
        title: "string | null",
        category: "development | current_show | acquisition | co_production | international | casting | renewal | cancellation",
        status: "string | null",
        genre: "string | null",
        format: "string | null",
        sourceMaterial: "string | null",
        logline: "string | null",
        buyer: "string | null",
        studio: "string | null",
        productionCompanies: ["string"],
        people: ["string"],
        country: "string | null",
        isAcquisition: "boolean",
        isCoProduction: "boolean",
        isInternational: "boolean",
        announcementDate: "ISO date string | null",
        premiereDate: "ISO date string | null",
        confidenceScore: "number 0-1",
        fieldsNeedingReview: ["string"],
        suggestedRelationships: "string | null"
      }
    },
    null,
    2
  );
}

function parseJsonContent(content: string) {
  try {
    return JSON.parse(content) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function asString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function asStringArray(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.map((item) => asString(item)).filter((item): item is string => Boolean(item));
}

function asBoolean(value: unknown) {
  return typeof value === "boolean" ? value : null;
}

function asNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function normalizeAiPayload(payload: Record<string, unknown>, article: ArticleLike, extractionInput: ExtractionInput): StructuredTVExtraction {
  const category = (() => {
    const value = asString(payload.category)?.toLowerCase();
    if (
      value === "development" ||
      value === "current_show" ||
      value === "acquisition" ||
      value === "co_production" ||
      value === "international" ||
      value === "casting" ||
      value === "renewal" ||
      value === "cancellation"
    ) {
      return value;
    }

    return inferCategory(article.headline, extractionInput.sourceText);
  })();

  const flags = deriveFlags(category, {
    isAcquisition: asBoolean(payload.isAcquisition),
    isCoProduction: asBoolean(payload.isCoProduction),
    isInternational: asBoolean(payload.isInternational)
  });

  return {
    title: asString(payload.title) ?? inferTitle(article.headline),
    category,
    status: asString(payload.status) ?? inferStatus(category, article.headline),
    genre: asString(payload.genre),
    format: asString(payload.format),
    sourceMaterial: asString(payload.sourceMaterial),
    logline: asString(payload.logline),
    buyer: asString(payload.buyer),
    studio: asString(payload.studio),
    productionCompanies: asStringArray(payload.productionCompanies),
    people: asStringArray(payload.people),
    country: asString(payload.country),
    isAcquisition: flags.isAcquisition,
    isCoProduction: flags.isCoProduction,
    isInternational: flags.isInternational,
    announcementDate: normalizeDate(asString(payload.announcementDate) ?? article.publishedDate ?? null),
    premiereDate: normalizeDate(asString(payload.premiereDate)),
    confidenceScore: clampConfidence(asNumber(payload.confidenceScore), extractionInput.basis),
    fieldsNeedingReview: mergeHeadlineWarning(asStringArray(payload.fieldsNeedingReview), extractionInput.basis),
    suggestedRelationships: asString(payload.suggestedRelationships),
    dedupeCandidate: false,
    dedupeReason: null,
    sourceReliability: inferSourceReliability(article.publication, article.url),
    extractionBasis: extractionInput.basis,
    warning: extractionInput.headlineOnly ? "Headline-only extraction" : null,
    mode: "ai"
  };
}

export async function extractStructuredTVDataWithAI(article: ArticleLike): Promise<StructuredTVExtraction> {
  const mock = mockLookup(article);
  if (mock) {
    return extractStructuredTVData(article, "mock");
  }

  const extractionInput = selectExtractionInput(article);
  const apiKey = process.env.OPENAI_API_KEY?.trim();

  if (!apiKey && isPreviewArticle(article)) {
    const fallback = await extractStructuredTVData(article, "placeholder");
    const fieldsNeedingReview = [...fallback.fieldsNeedingReview];
    if (!fieldsNeedingReview.includes("Mock AI extraction preview")) {
      fieldsNeedingReview.unshift("Mock AI extraction preview");
    }

    return {
      ...fallback,
      fieldsNeedingReview,
      mode: "mock"
    };
  }

  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is missing. Add it locally or in Vercel before running AI extraction.");
  }

  const model = process.env.OPENAI_MODEL?.trim() || "gpt-4o-mini";
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model,
      temperature: 0.1,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: baseSystemPrompt() },
        { role: "user", content: buildAiPrompt(article, extractionInput) }
      ]
    })
  });

  if (!response.ok) {
    const message = await response.text().catch(() => "");
    throw new Error(`OpenAI extraction failed (${response.status}): ${message || "Unknown API error."}`);
  }

  const payload = (await response.json()) as {
    choices?: Array<{
      message?: {
        content?: string | null;
      };
    }>;
  };
  const content = payload.choices?.[0]?.message?.content ?? "";
  const parsed = parseJsonContent(content);

  if (!parsed) {
    throw new Error("OpenAI extraction returned invalid JSON.");
  }

  return normalizeAiPayload(parsed, article, extractionInput);
}
