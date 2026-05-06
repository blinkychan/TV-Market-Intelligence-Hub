export function csvEscape(value: unknown) {
  if (value == null) return "";
  const text = String(value);
  if (!/[",\n]/.test(text)) return text;
  return `"${text.replace(/"/g, "\"\"")}"`;
}

export function toCsv(headers: string[], rows: Array<Record<string, unknown>>) {
  const lines = [
    headers.map(csvEscape).join(","),
    ...rows.map((row) => headers.map((header) => csvEscape(row[header])).join(","))
  ];

  return lines.join("\n");
}

export function parseCsvLine(line: string) {
  const values: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];

    if (char === "\"") {
      if (inQuotes && line[index + 1] === "\"") {
        current += "\"";
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === "," && !inQuotes) {
      values.push(current.trim());
      current = "";
      continue;
    }

    current += char;
  }

  values.push(current.trim());
  return values;
}

export function parseCsvText(text: string) {
  const rows = text
    .split(/\r?\n/)
    .map((line) => line.trimEnd())
    .filter(Boolean)
    .map(parseCsvLine);

  const [headers = [], ...body] = rows;
  return { headers, rows: body };
}

export function normalizeHeader(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "");
}

export function parseTagList(raw: string | null | undefined) {
  return String(raw ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

export function mergeTagList(existing: string | null | undefined, additions: string[]) {
  const merged = new Set([...parseTagList(existing), ...additions]);
  return Array.from(merged).join(", ") || null;
}

export function removeTagList(existing: string | null | undefined, removals: string[]) {
  const removalSet = new Set(removals.map((item) => item.trim()).filter(Boolean));
  const next = parseTagList(existing).filter((item) => !removalSet.has(item));
  return next.join(", ") || null;
}
