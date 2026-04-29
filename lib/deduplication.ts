import type { DuplicateStatus } from "@prisma/client";

export type DuplicateEntityType = "article" | "project" | "current_show" | "buyer" | "company" | "person";

export type DuplicateGroupRecord = {
  id: string;
  entityType: DuplicateEntityType;
  label: string;
  url?: string | null;
  buyerOrPlatform?: string | null;
  studioOrCompany?: string | null;
  date?: Date | string | null;
  aliases?: string | null;
  notes?: string | null;
  confidenceScore?: number | null;
  duplicateGroupId?: string | null;
  duplicateConfidence?: number | null;
  possibleDuplicateOfId?: string | null;
  duplicateStatus?: DuplicateStatus | null;
  payload: Record<string, unknown>;
};

export type DuplicateMatch = {
  targetId: string;
  confidence: number;
  reason: string;
};

export type DuplicateGroup = {
  id: string;
  entityType: DuplicateEntityType;
  label: string;
  confidence: number;
  reason: string;
  records: DuplicateGroupRecord[];
};

export type DuplicateWarning = {
  confidence: number;
  reason: string;
  targetId: string;
  targetLabel: string;
};

export const DUPLICATE_REVIEW_THRESHOLD = 0.74;

function normalizeText(value?: string | null) {
  return (value ?? "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeUrl(value?: string | null) {
  return (value ?? "")
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .replace(/\/+$/, "")
    .trim();
}

function splitAliases(value?: string | null) {
  return (value ?? "")
    .split(",")
    .map((item) => normalizeText(item))
    .filter(Boolean);
}

function tokenSet(value?: string | null) {
  return new Set(normalizeText(value).split(" ").filter(Boolean));
}

function overlapScore(left?: string | null, right?: string | null) {
  const a = tokenSet(left);
  const b = tokenSet(right);
  if (!a.size || !b.size) return 0;

  let intersection = 0;
  for (const token of a) {
    if (b.has(token)) intersection += 1;
  }

  return intersection / Math.max(a.size, b.size);
}

function nameSimilarity(left?: string | null, right?: string | null, leftAliases?: string | null, rightAliases?: string | null) {
  const normalizedLeft = normalizeText(left);
  const normalizedRight = normalizeText(right);
  if (!normalizedLeft || !normalizedRight) return 0;
  if (normalizedLeft === normalizedRight) return 1;

  const aliasPool = new Set([
    normalizedLeft,
    normalizedRight,
    ...splitAliases(leftAliases),
    ...splitAliases(rightAliases)
  ]);

  if (aliasPool.has(normalizedLeft) && aliasPool.has(normalizedRight)) {
    return 0.96;
  }

  if (normalizedLeft.replace(/\b(the|season|series)\b/g, "").trim() === normalizedRight.replace(/\b(the|season|series)\b/g, "").trim()) {
    return 0.92;
  }

  return overlapScore(left, right);
}

function dateProximityScore(left?: Date | string | null, right?: Date | string | null) {
  if (!left || !right) return 0;
  const leftDate = new Date(left);
  const rightDate = new Date(right);
  if (Number.isNaN(leftDate.getTime()) || Number.isNaN(rightDate.getTime())) return 0;

  const diffDays = Math.abs(leftDate.getTime() - rightDate.getTime()) / (1000 * 60 * 60 * 24);
  if (diffDays <= 1) return 1;
  if (diffDays <= 7) return 0.75;
  if (diffDays <= 31) return 0.4;
  return 0;
}

function confidenceBlend(left?: number | null, right?: number | null) {
  if (left == null && right == null) return 0;
  const nextLeft = left ?? 0.5;
  const nextRight = right ?? 0.5;
  return Math.min(1, (nextLeft + nextRight) / 2);
}

function buildReason(parts: Array<string | null | false | undefined>) {
  return parts.filter(Boolean).join("; ");
}

function scoreDuplicateMatch(left: DuplicateGroupRecord, right: DuplicateGroupRecord) {
  const titleScore = nameSimilarity(left.label, right.label, left.aliases, right.aliases);
  const urlScore = left.url && right.url && normalizeUrl(left.url) === normalizeUrl(right.url) ? 1 : 0;
  const buyerScore =
    left.buyerOrPlatform && right.buyerOrPlatform && normalizeText(left.buyerOrPlatform) === normalizeText(right.buyerOrPlatform) ? 0.88 : 0;
  const companyScore =
    left.studioOrCompany && right.studioOrCompany && normalizeText(left.studioOrCompany) === normalizeText(right.studioOrCompany) ? 0.82 : 0;
  const dateScore = dateProximityScore(left.date, right.date);
  const metadataConfidence = confidenceBlend(left.confidenceScore ?? left.duplicateConfidence, right.confidenceScore ?? right.duplicateConfidence);
  const groupBoost =
    left.duplicateGroupId && right.duplicateGroupId && left.duplicateGroupId === right.duplicateGroupId
      ? 1
      : 0;

  const confidence = Math.min(
    0.99,
    titleScore * 0.42 +
      urlScore * 0.18 +
      buyerScore * 0.12 +
      companyScore * 0.1 +
      dateScore * 0.1 +
      metadataConfidence * 0.04 +
      groupBoost * 0.04
  );

  const reason = buildReason([
    titleScore >= 0.9 ? "very close title/name match" : titleScore >= 0.7 ? "similar title/name" : null,
    urlScore > 0 ? "matching source URL" : null,
    buyerScore > 0 ? "same buyer/platform" : null,
    companyScore > 0 ? "same studio/company" : null,
    dateScore >= 0.75 ? "close dates" : null,
    groupBoost > 0 ? "same duplicate group" : null
  ]);

  return { confidence, reason };
}

function compareWithinType(records: DuplicateGroupRecord[]) {
  const results = new Map<string, DuplicateMatch[]>();

  for (let index = 0; index < records.length; index += 1) {
    const left = records[index];
    for (let cursor = index + 1; cursor < records.length; cursor += 1) {
      const right = records[cursor];
      if (left.entityType !== right.entityType) continue;

      const match = scoreDuplicateMatch(left, right);
      const forcedDuplicate =
        left.possibleDuplicateOfId === right.id ||
        right.possibleDuplicateOfId === left.id ||
        left.duplicateStatus === "confirmed_duplicate" ||
        right.duplicateStatus === "confirmed_duplicate";

      const confidence = forcedDuplicate ? Math.max(match.confidence, 0.9) : match.confidence;
      if (confidence < DUPLICATE_REVIEW_THRESHOLD) continue;

      const reason = match.reason || "high-overlap duplicate signal";
      const leftMatches = results.get(left.id) ?? [];
      leftMatches.push({ targetId: right.id, confidence, reason });
      results.set(left.id, leftMatches);

      const rightMatches = results.get(right.id) ?? [];
      rightMatches.push({ targetId: left.id, confidence, reason });
      results.set(right.id, rightMatches);
    }
  }

  return results;
}

export function buildDuplicateGroups(records: DuplicateGroupRecord[]) {
  const matches = compareWithinType(records);
  const byId = new Map(records.map((record) => [record.id, record]));
  const seen = new Set<string>();
  const groups: DuplicateGroup[] = [];

  for (const record of records) {
    if (seen.has(record.id)) continue;
    const nextMatches = matches.get(record.id) ?? [];
    if (!nextMatches.length) continue;

    const stack = [record.id];
    const memberIds = new Set<string>();

    while (stack.length) {
      const currentId = stack.pop();
      if (!currentId || memberIds.has(currentId)) continue;
      memberIds.add(currentId);
      const currentMatches = matches.get(currentId) ?? [];
      for (const match of currentMatches) {
        if (!memberIds.has(match.targetId)) stack.push(match.targetId);
      }
    }

    if (memberIds.size < 2) continue;

    const groupRecords = Array.from(memberIds)
      .map((id) => byId.get(id))
      .filter((item): item is DuplicateGroupRecord => Boolean(item));

    const confidence = Math.max(
      ...groupRecords.map((groupRecord) => groupRecord.duplicateConfidence ?? groupRecord.confidenceScore ?? 0),
      ...Array.from(memberIds).flatMap((id) => (matches.get(id) ?? []).map((match) => match.confidence))
    );

    const reason =
      Array.from(memberIds)
        .flatMap((id) => matches.get(id) ?? [])
        .map((match) => match.reason)
        .find(Boolean) ?? "duplicate review suggested by shared signals";

    for (const id of memberIds) {
      seen.add(id);
    }

    const seed = groupRecords[0];
    groups.push({
      id: seed.duplicateGroupId ?? `${seed.entityType}-${seed.id}`,
      entityType: seed.entityType,
      label: seed.label,
      confidence,
      reason,
      records: groupRecords.sort((left, right) => {
        const leftScore = left.duplicateConfidence ?? left.confidenceScore ?? 0;
        const rightScore = right.duplicateConfidence ?? right.confidenceScore ?? 0;
        return rightScore - leftScore;
      })
    });
  }

  return groups.sort((left, right) => right.confidence - left.confidence);
}

export function findBestDuplicateWarning(record: DuplicateGroupRecord, candidates: DuplicateGroupRecord[]): DuplicateWarning | null {
  let best: DuplicateWarning | null = null;

  for (const candidate of candidates) {
    if (candidate.id === record.id || candidate.entityType !== record.entityType) continue;
    const match = scoreDuplicateMatch(record, candidate);
    const forcedDuplicate =
      record.possibleDuplicateOfId === candidate.id ||
      candidate.possibleDuplicateOfId === record.id ||
      record.duplicateStatus === "confirmed_duplicate" ||
      candidate.duplicateStatus === "confirmed_duplicate";

    const confidence = forcedDuplicate ? Math.max(match.confidence, 0.9) : match.confidence;
    if (confidence < DUPLICATE_REVIEW_THRESHOLD) continue;

    const warning: DuplicateWarning = {
      confidence,
      reason: match.reason || "high-overlap duplicate signal",
      targetId: candidate.id,
      targetLabel: candidate.label
    };

    if (!best || warning.confidence > best.confidence) {
      best = warning;
    }
  }

  return best;
}

export function duplicateStatusTone(status?: DuplicateStatus | null) {
  if (status === "confirmed_duplicate") return "bg-rose-50 text-rose-700 ring-rose-200";
  if (status === "possible_duplicate") return "bg-amber-50 text-amber-800 ring-amber-200";
  if (status === "merged") return "bg-violet-50 text-violet-700 ring-violet-200";
  return "bg-slate-100 text-slate-700 ring-slate-200";
}
