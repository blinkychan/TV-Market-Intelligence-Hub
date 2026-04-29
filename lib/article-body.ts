import { JSDOM } from "jsdom";
import { Readability } from "@mozilla/readability";
import robotsParser from "robots-parser";

export type BodyFetchStatus =
  | "not_fetched"
  | "success"
  | "robots_blocked"
  | "paywall_likely"
  | "timeout"
  | "fetch_error"
  | "extraction_error";

export type BodyFetchResult = {
  status: BodyFetchStatus;
  robotsAllowed: boolean | null;
  paywallLikely: boolean;
  rawHtml: string | null;
  extractedText: string | null;
  extractedExcerpt: string | null;
  extractionMethod: string | null;
  error: string | null;
  fetchedAt: Date | null;
};

const BODY_USER_AGENT = "TV Market Intelligence Hub/0.1 (article body extraction; metadata + internal review only)";
const FETCH_TIMEOUT_MS = 8000;

const MOCK_BODY_FIXTURES: Record<string, BodyFetchResult> = {
  "https://preview.example.com/harbor-lights": {
    status: "success",
    robotsAllowed: true,
    paywallLikely: false,
    rawHtml: "<article><h1>Harbor Lights</h1><p>Netflix landed coastal crime drama Harbor Lights from A24 Television and wiip. Maya Rivers created the project and Noor Hassan is attached to write. The package follows a medical examiner who uncovers a port corruption conspiracy.</p></article>",
    extractedText:
      "Netflix landed coastal crime drama Harbor Lights from A24 Television and wiip. Maya Rivers created the project and Noor Hassan is attached to write. The package follows a medical examiner who uncovers a port corruption conspiracy.",
    extractedExcerpt:
      "Netflix landed coastal crime drama Harbor Lights from A24 Television and wiip. Maya Rivers created the project and Noor Hassan is attached to write.",
    extractionMethod: "mock_readability",
    error: null,
    fetchedAt: new Date("2026-04-28T12:00:00.000Z")
  },
  "https://preview.example.com/northern-exchange": {
    status: "robots_blocked",
    robotsAllowed: false,
    paywallLikely: false,
    rawHtml: null,
    extractedText: null,
    extractedExcerpt: null,
    extractionMethod: null,
    error: "robots.txt disallows body fetch for this URL.",
    fetchedAt: new Date("2026-04-28T12:00:00.000Z")
  },
  "https://preview.example.com/red-valley": {
    status: "paywall_likely",
    robotsAllowed: true,
    paywallLikely: true,
    rawHtml: "<html><body><div class='metered'>Subscribe to continue reading...</div></body></html>",
    extractedText: null,
    extractedExcerpt: "Paywall likely. Only partial teaser content was available.",
    extractionMethod: "mock_paywall_detection",
    error: "Paywall likely; body text was not stored.",
    fetchedAt: new Date("2026-04-28T12:00:00.000Z")
  },
  "https://preview.example.com/witness-chair": {
    status: "timeout",
    robotsAllowed: true,
    paywallLikely: false,
    rawHtml: null,
    extractedText: null,
    extractedExcerpt: null,
    extractionMethod: null,
    error: "Timed out while fetching article HTML.",
    fetchedAt: new Date("2026-04-28T12:00:00.000Z")
  },
  "https://preview.example.com/harbor-lights-duplicate": {
    status: "fetch_error",
    robotsAllowed: true,
    paywallLikely: false,
    rawHtml: null,
    extractedText: null,
    extractedExcerpt: null,
    extractionMethod: null,
    error: "Fetch failed with 502.",
    fetchedAt: new Date("2026-04-28T12:00:00.000Z")
  }
};

function isPreviewFixture(url: string) {
  return url.startsWith("https://preview.example.com/") || url.startsWith("https://history.example.com/");
}

function truncateExcerpt(text: string | null, maxLength = 280) {
  if (!text) return null;
  const normalized = text.replace(/\s+/g, " ").trim();
  if (normalized.length <= maxLength) return normalized;
  return `${normalized.slice(0, maxLength - 1).trimEnd()}...`;
}

function detectPaywall(html: string) {
  const normalized = html.toLowerCase();
  return ["subscribe to continue", "subscriber-only", "sign in to continue", "already a subscriber", "join now to read"].some((marker) =>
    normalized.includes(marker)
  );
}

export async function checkRobotsAllowed(url: string): Promise<boolean | null> {
  if (isPreviewFixture(url)) {
    const fixture = MOCK_BODY_FIXTURES[url];
    return fixture ? fixture.robotsAllowed : true;
  }

  try {
    const target = new URL(url);
    const robotsUrl = `${target.origin}/robots.txt`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    const response = await fetch(robotsUrl, {
      headers: { "user-agent": BODY_USER_AGENT },
      cache: "no-store",
      signal: controller.signal
    });
    clearTimeout(timeout);

    if (!response.ok) return null;

    const body = await response.text();
    const robots = robotsParser(robotsUrl, body);
    return robots.isAllowed(url, BODY_USER_AGENT);
  } catch {
    return null;
  }
}

export function extractReadableText(html: string, url = "https://example.com/article"): {
  extractedText: string | null;
  extractedExcerpt: string | null;
  paywallLikely: boolean;
} {
  const paywallLikely = detectPaywall(html);
  if (paywallLikely) {
    return {
      extractedText: null,
      extractedExcerpt: "Paywall likely. Only limited preview text appears accessible.",
      paywallLikely
    };
  }

  try {
    const dom = new JSDOM(html, { url });
    const reader = new Readability(dom.window.document);
    const article = reader.parse();
    const extractedText = article?.textContent?.replace(/\s+/g, " ").trim() ?? null;

    return {
      extractedText,
      extractedExcerpt: truncateExcerpt(extractedText),
      paywallLikely: false
    };
  } catch {
    return {
      extractedText: null,
      extractedExcerpt: null,
      paywallLikely: false
    };
  }
}

export async function fetchArticleBody(url: string): Promise<BodyFetchResult> {
  if (isPreviewFixture(url) && MOCK_BODY_FIXTURES[url]) {
    return MOCK_BODY_FIXTURES[url];
  }

  const robotsAllowed = await checkRobotsAllowed(url);
  if (robotsAllowed === false) {
    return {
      status: "robots_blocked",
      robotsAllowed: false,
      paywallLikely: false,
      rawHtml: null,
      extractedText: null,
      extractedExcerpt: null,
      extractionMethod: null,
      error: "robots.txt disallows body fetch for this URL.",
      fetchedAt: new Date()
    };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      headers: {
        "user-agent": BODY_USER_AGENT,
        accept: "text/html,application/xhtml+xml"
      },
      cache: "no-store",
      signal: controller.signal
    });
    clearTimeout(timeout);

    if (!response.ok) {
      return {
        status: "fetch_error",
        robotsAllowed,
        paywallLikely: false,
        rawHtml: null,
        extractedText: null,
        extractedExcerpt: null,
        extractionMethod: null,
        error: `Fetch failed with ${response.status}.`,
        fetchedAt: new Date()
      };
    }

    const rawHtml = await response.text();
    const readable = extractReadableText(rawHtml, url);

    if (readable.paywallLikely) {
      return {
        status: "paywall_likely",
        robotsAllowed,
        paywallLikely: true,
        rawHtml,
        extractedText: null,
        extractedExcerpt: readable.extractedExcerpt,
        extractionMethod: "mozilla_readability",
        error: "Paywall likely; body text was not stored.",
        fetchedAt: new Date()
      };
    }

    if (!readable.extractedText) {
      return {
        status: "extraction_error",
        robotsAllowed,
        paywallLikely: false,
        rawHtml,
        extractedText: null,
        extractedExcerpt: null,
        extractionMethod: "mozilla_readability",
        error: "Readable body text could not be extracted.",
        fetchedAt: new Date()
      };
    }

    return {
      status: "success",
      robotsAllowed,
      paywallLikely: false,
      rawHtml,
      extractedText: readable.extractedText,
      extractedExcerpt: readable.extractedExcerpt,
      extractionMethod: "mozilla_readability",
      error: null,
      fetchedAt: new Date()
    };
  } catch (error) {
    clearTimeout(timeout);
    const timedOut = error instanceof Error && error.name === "AbortError";
    return {
      status: timedOut ? "timeout" : "fetch_error",
      robotsAllowed,
      paywallLikely: false,
      rawHtml: null,
      extractedText: null,
      extractedExcerpt: null,
      extractionMethod: null,
      error: timedOut ? "Timed out while fetching article HTML." : error instanceof Error ? error.message : "Article fetch failed.",
      fetchedAt: new Date()
    };
  }
}
