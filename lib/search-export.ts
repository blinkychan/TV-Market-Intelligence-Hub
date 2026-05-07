/**
 * Search Result Export — Step 34
 *
 * Exports DeepSearchResult arrays to:
 * - CSV  (pure JS, no deps)
 * - Markdown (plain text, copy-paste ready)
 * - PDF  (generates a printable HTML string; caller opens in new window)
 *
 * Server-safe: no DOM or browser APIs used in CSV/Markdown paths.
 */

import type { DeepSearchResult } from "@/lib/deep-search";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function csvEscape(v: string | null | undefined): string {
  if (v === null || v === undefined) return "";
  const s = String(v);
  if (s.includes(",") || s.includes('"') || s.includes("\n")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function fmtPct(score: number | null | undefined): string {
  if (score === null || score === undefined) return "";
  return `${Math.round(score * 100)}%`;
}

function kindLabel(kind: DeepSearchResult["kind"]): string {
  if (kind === "project") return "Development Project";
  if (kind === "current_show") return "Current Show";
  return "Article";
}

function fmtDate(d: Date | string | null | undefined): string {
  if (!d) return "";
  return new Date(d).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
}

// ─── CSV ──────────────────────────────────────────────────────────────────────

export function exportToCSV(results: DeepSearchResult[], query: string): string {
  const header = [
    "Title",
    "Type",
    "Status",
    "Genre",
    "Buyer / Network",
    "Studio",
    "Match Label",
    "Match Score",
    "Confidence",
    "Logline / Snippet",
    "Source URL",
    "Stale",
    "Auto-Created",
    "Published / Announced",
  ].join(",");

  const rows = results.map((r) =>
    [
      csvEscape(r.title),
      csvEscape(kindLabel(r.kind)),
      csvEscape(r.status),
      csvEscape(r.genre),
      csvEscape(r.buyer),
      csvEscape(r.studio),
      csvEscape(r.matchLabel),
      csvEscape(fmtPct(r.matchScore)),
      csvEscape(fmtPct(r.confidenceScore)),
      csvEscape(r.logline ?? r.snippet),
      csvEscape(r.sourceUrl),
      csvEscape(r.isStale ? "Yes" : "No"),
      csvEscape(r.isAutoCreated ? "Yes" : "No"),
      csvEscape(r.announcementYear ? String(r.announcementYear) : ""),
    ].join(",")
  );

  const meta = `# Market Search Export\n# Query: ${query}\n# Generated: ${new Date().toISOString()}\n# Results: ${results.length}\n`;
  return meta + header + "\n" + rows.join("\n");
}

// ─── Markdown ─────────────────────────────────────────────────────────────────

export function exportToMarkdown(results: DeepSearchResult[], query: string): string {
  const lines: string[] = [
    `# Market Search: "${query}"`,
    `_Exported ${new Date().toLocaleDateString()} · ${results.length} results_`,
    "",
  ];

  // Group by kind
  const projects = results.filter((r) => r.kind === "project");
  const shows = results.filter((r) => r.kind === "current_show");
  const articles = results.filter((r) => r.kind === "article");

  function renderGroup(title: string, items: DeepSearchResult[]) {
    if (!items.length) return;
    lines.push(`## ${title}`);
    lines.push("");
    for (const r of items) {
      const score = fmtPct(r.matchScore);
      const confidence = r.confidenceScore ? ` · Confidence: ${fmtPct(r.confidenceScore)}` : "";
      const staleTag = r.isStale ? " ⚠️ _Stale/Dead_" : "";
      const autoTag = r.isAutoCreated ? " 🤖 _Auto-Created_" : "";
      lines.push(`### ${r.title}${staleTag}${autoTag}`);
      lines.push(`**Match:** ${r.matchLabel} (${score})${confidence}`);
      if (r.buyer) lines.push(`**Buyer:** ${r.buyer}`);
      if (r.studio) lines.push(`**Studio:** ${r.studio}`);
      if (r.genre) lines.push(`**Genre:** ${r.genre}`);
      if (r.status) lines.push(`**Status:** ${r.status}`);
      if (r.logline) lines.push(`**Logline:** ${r.logline}`);
      else if (r.snippet) lines.push(`**Excerpt:** ${r.snippet}`);
      if (r.sourceUrl) lines.push(`**Source:** [${r.publication ?? r.sourceUrl}](${r.sourceUrl})`);
      if (r.announcementYear) lines.push(`**Year:** ${r.announcementYear}`);
      lines.push("");
    }
  }

  renderGroup("Development Projects", projects);
  renderGroup("Current Shows", shows);
  renderGroup("Articles", articles);

  lines.push("---");
  lines.push(`_Every result traces back to a database record or source URL. Conceptual matches are labeled as such._`);

  return lines.join("\n");
}

// ─── PDF (printable HTML) ─────────────────────────────────────────────────────
// Returns a self-contained HTML string the client can open in a new window and print.

export function exportToPrintableHTML(results: DeepSearchResult[], query: string): string {
  const rows = results.map((r) => {
    const score = fmtPct(r.matchScore);
    const conf = r.confidenceScore ? fmtPct(r.confidenceScore) : "—";
    const staleTag = r.isStale ? `<span style="color:#b45309;font-size:11px;border:1px solid #fde68a;border-radius:3px;padding:1px 4px;margin-left:4px">Stale</span>` : "";
    const autoTag = r.isAutoCreated ? `<span style="color:#6b7280;font-size:11px;border:1px solid #e5e7eb;border-radius:3px;padding:1px 4px;margin-left:4px">Auto</span>` : "";

    return `
      <tr>
        <td style="padding:8px 10px;vertical-align:top;border-bottom:1px solid #e5e7eb">
          <strong>${escapeHtml(r.title)}</strong>${staleTag}${autoTag}<br>
          <span style="color:#6b7280;font-size:12px">${escapeHtml(kindLabel(r.kind))}</span>
        </td>
        <td style="padding:8px 10px;vertical-align:top;border-bottom:1px solid #e5e7eb;color:#374151;font-size:13px">${escapeHtml(r.buyer ?? "—")}</td>
        <td style="padding:8px 10px;vertical-align:top;border-bottom:1px solid #e5e7eb;color:#374151;font-size:13px">${escapeHtml(r.genre ?? "—")}</td>
        <td style="padding:8px 10px;vertical-align:top;border-bottom:1px solid #e5e7eb;font-size:13px">
          <span style="font-weight:600;color:#1d4ed8">${score}</span><br>
          <span style="color:#6b7280;font-size:11px">${escapeHtml(r.matchLabel)}</span>
        </td>
        <td style="padding:8px 10px;vertical-align:top;border-bottom:1px solid #e5e7eb;font-size:12px;color:#374151">${conf}</td>
        <td style="padding:8px 10px;vertical-align:top;border-bottom:1px solid #e5e7eb;font-size:12px;color:#374151;max-width:260px">${
          r.logline
            ? `<em>${escapeHtml(r.logline.slice(0, 200))}${r.logline.length > 200 ? "…" : ""}</em>`
            : r.snippet ? escapeHtml(r.snippet) : "—"
        }</td>
        <td style="padding:8px 10px;vertical-align:top;border-bottom:1px solid #e5e7eb;font-size:12px">${
          r.sourceUrl ? `<a href="${escapeHtml(r.sourceUrl)}" style="color:#1d4ed8">${escapeHtml(r.publication ?? "source")}</a>` : "—"
        }</td>
      </tr>`;
  }).join("");

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Market Search: ${escapeHtml(query)}</title>
<style>
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; padding: 32px; color: #111827; }
  h1 { font-size: 20px; margin-bottom: 4px; }
  .meta { font-size: 13px; color: #6b7280; margin-bottom: 24px; }
  table { width: 100%; border-collapse: collapse; font-size: 13px; }
  th { background: #f9fafb; text-align: left; padding: 8px 10px; border-bottom: 2px solid #e5e7eb; font-size: 12px; color: #374151; font-weight: 600; }
  @media print { body { padding: 16px; } }
  .footer { margin-top: 24px; font-size: 11px; color: #9ca3af; border-top: 1px solid #e5e7eb; padding-top: 12px; }
</style>
</head>
<body>
<h1>Market Search: "${escapeHtml(query)}"</h1>
<p class="meta">Exported ${new Date().toLocaleString()} · ${results.length} results · Every result traces back to a database record or source URL.</p>
<table>
  <thead>
    <tr>
      <th>Title</th>
      <th>Buyer / Network</th>
      <th>Genre</th>
      <th>Match Score</th>
      <th>Confidence</th>
      <th>Logline / Excerpt</th>
      <th>Source</th>
    </tr>
  </thead>
  <tbody>${rows}</tbody>
</table>
<div class="footer">Conceptual matches are labeled as such. Auto-Created records are marked and may require review. Do not rely on these results for legal or financial decisions.</div>
</body>
</html>`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
