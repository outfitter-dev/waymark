// tldr ::: normalization helpers for waymark records and related fields

import type { WaymarkRecord } from "@waymarks/grammar";

export type NormalizeMarkerOptions = {
  normalizeCase?: boolean;
};

export type NormalizeRecordOptions = {
  marker?: NormalizeMarkerOptions;
};

export function normalizeMarker(
  marker: string,
  options: NormalizeMarkerOptions = {}
): string {
  const trimmed = marker.trim();
  if (trimmed.length === 0) {
    return trimmed;
  }

  if (options.normalizeCase ?? true) {
    return trimmed.toLowerCase();
  }

  return trimmed;
}

export function normalizeProperties(
  properties: WaymarkRecord["properties"]
): WaymarkRecord["properties"] {
  const entries = Object.entries(properties);
  if (entries.length === 0) {
    return {};
  }

  return Object.fromEntries(entries.sort(([a], [b]) => a.localeCompare(b)));
}

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

export function normalizeCanonicals(
  canonicals: WaymarkRecord["canonicals"]
): string[] {
  if (canonicals.length === 0) {
    return [];
  }

  return sortUnique(canonicals.map(normalizeCanonicalToken));
}

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

export function normalizeRecord(
  record: WaymarkRecord,
  options: NormalizeRecordOptions = {}
): WaymarkRecord {
  const { marker: markerOptions } = options;

  return {
    ...record,
    marker: normalizeMarker(record.marker, markerOptions),
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
