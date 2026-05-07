/**
 * Shared utilities used by both semantic-search.ts and deep-search.ts.
 * Extracted to avoid circular imports.
 */

export function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .split(/\W+/)
    .filter((t) => t.length > 2);
}

export function scoreMatch(
  searchText: string,
  queryTokens: string[],
  query: string
): number {
  if (!searchText) return 0;

  const lower = searchText.toLowerCase();
  let score = 0;

  // Exact query phrase match (highest weight)
  if (lower.includes(query.toLowerCase())) {
    score += 0.6;
  }

  // Individual token matches
  const textTokens = new Set(tokenize(searchText));
  let tokenMatches = 0;
  for (const token of queryTokens) {
    if (textTokens.has(token)) tokenMatches++;
    else {
      // Partial match
      for (const t of textTokens) {
        if (t.includes(token) || token.includes(t)) {
          tokenMatches += 0.5;
          break;
        }
      }
    }
  }

  if (queryTokens.length > 0) {
    score += (tokenMatches / queryTokens.length) * 0.4;
  }

  return Math.min(1, score);
}

export function buildSnippet(
  searchableText: string | null | undefined,
  query: string
): string | null {
  if (!searchableText) return null;
  const idx = searchableText.toLowerCase().indexOf(query.toLowerCase());
  if (idx === -1) return searchableText.slice(0, 120) + "…";
  const start = Math.max(0, idx - 40);
  const end = Math.min(searchableText.length, idx + query.length + 80);
  const prefix = start > 0 ? "…" : "";
  const suffix = end < searchableText.length ? "…" : "";
  return prefix + searchableText.slice(start, end) + suffix;
}
