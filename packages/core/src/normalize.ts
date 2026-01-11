// tldr ::: normalization helpers for waymark records and related fields

import type { WaymarkRecord } from "@waymarks/grammar";

/** Options for normalizing waymark types. */
export type NormalizeTypeOptions = {
  normalizeCase?: boolean;
};

/** Options for normalizing entire waymark records. */
export type NormalizeRecordOptions = {
  type?: NormalizeTypeOptions;
};

/**
 * Normalize a waymark type string.
 * @param type - Marker type to normalize.
 * @param options - Normalization options.
 * @returns Normalized type string.
 */
export function normalizeType(
  type: string,
  options: NormalizeTypeOptions = {}
): string {
  const trimmed = type.trim();
  if (trimmed.length === 0) {
    return trimmed;
  }

  if (options.normalizeCase ?? true) {
    return trimmed.toLowerCase();
  }

  return trimmed;
}

/**
 * Normalize waymark properties by sorting keys.
 * @param properties - Properties map to normalize.
 * @returns Properties with sorted keys.
 */
export function normalizeProperties(
  properties: WaymarkRecord["properties"]
): WaymarkRecord["properties"] {
  const entries = Object.entries(properties);
  if (entries.length === 0) {
    return {};
  }

  return Object.fromEntries(entries.sort(([a], [b]) => a.localeCompare(b)));
}

/**
 * Normalize relation tokens and ordering.
 * @param relations - Relations to normalize.
 * @returns Normalized relations list.
 */
export function normalizeRelations(
  relations: WaymarkRecord["relations"]
): WaymarkRecord["relations"] {
  if (relations.length === 0) {
    return [];
  }

  return relations
    .map((relation) => ({
      kind: relation.kind,
      token: normalizeCanonicalToken(relation.token),
    }))
    .sort((left, right) => {
      const kindComparison = left.kind.localeCompare(right.kind);
      if (kindComparison !== 0) {
        return kindComparison;
      }
      return left.token.localeCompare(right.token);
    });
}

/**
 * Normalize tags by trimming, lowercasing, and sorting.
 * @param tags - Tags to normalize.
 * @returns Normalized tag list.
 */
export function normalizeTags(tags: WaymarkRecord["tags"]): string[] {
  if (tags.length === 0) {
    return [];
  }

  return sortUnique(
    tags
      .map((tag) => tag.trim())
      .filter((tag) => tag.length > 0)
      .map((tag) => tag.toLowerCase())
  );
}

/**
 * Normalize canonical references by formatting and sorting.
 * @param canonicals - Canonical tokens to normalize.
 * @returns Normalized canonical tokens.
 */
export function normalizeCanonicals(
  canonicals: WaymarkRecord["canonicals"]
): string[] {
  if (canonicals.length === 0) {
    return [];
  }

  return sortUnique(canonicals.map(normalizeCanonicalToken));
}

/**
 * Normalize mentions by trimming and sorting.
 * @param mentions - Mentions to normalize.
 * @returns Normalized mention list.
 */
export function normalizeMentions(
  mentions: WaymarkRecord["mentions"]
): string[] {
  if (mentions.length === 0) {
    return [];
  }

  return sortUnique(
    mentions
      .map((mention) => mention.trim())
      .filter((mention) => mention.length > 0)
  );
}

/**
 * Normalize a full waymark record for stable comparisons.
 * @param record - Waymark record to normalize.
 * @param options - Normalization options.
 * @returns Normalized waymark record.
 */
export function normalizeRecord(
  record: WaymarkRecord,
  options: NormalizeRecordOptions = {}
): WaymarkRecord {
  const { type: typeOptions } = options;

  return {
    ...record,
    type: normalizeType(record.type, typeOptions),
    properties: normalizeProperties(record.properties),
    relations: normalizeRelations(record.relations),
    tags: normalizeTags(record.tags),
    canonicals: normalizeCanonicals(record.canonicals),
    mentions: normalizeMentions(record.mentions),
  };
}

function normalizeCanonicalToken(token: string): string {
  const trimmed = token.trim();
  if (trimmed.length === 0) {
    return trimmed;
  }

  const normalized = trimmed.startsWith("#") ? trimmed : `#${trimmed}`;
  return normalized.toLowerCase();
}

function sortUnique(values: string[]): string[] {
  return Array.from(new Set(values)).sort((a, b) => a.localeCompare(b));
}
