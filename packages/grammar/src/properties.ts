// tldr ::: property, mention, and tag extraction utilities for waymark grammar

import type { WaymarkRecord } from "./types";

// Exported regex patterns for reuse in styling and other contexts
export const PROPERTY_REGEX =
  /(?:^|[\s])([A-Za-z][A-Za-z0-9_-]*)\s*:\s*(?:"([^"\\]*(?:\\.[^"\\]*)*)"|([^\s,]+(?:,[^\s,]+)*))/gm;
export const MENTION_REGEX = /(?:^|[^A-Za-z0-9/_-])(@[A-Za-z0-9/_-]+)/gm;
export const TAG_REGEX = /(?:^|[^A-Za-z0-9._/:%-])(#[A-Za-z0-9._/:%-]+)/gm;

export const RELATION_KIND_MAP: Record<
  string,
  WaymarkRecord["relations"][number]["kind"]
> = {
  ref: "ref",
  rel: "rel",
  depends: "depends",
  needs: "needs",
  blocks: "blocks",
  dupeof: "dupeof",
};

export function unescapeQuotedValue(value: string): string {
  return value.replace(/\\(["\\])/g, "$1");
}

export function splitRelationValues(value: string): string[] {
  return value
    .split(",")
    .map((token) => token.trim())
    .filter((token) => token.length > 0);
}

export function normalizeRelationToken(token: string): string | null {
  if (token.length === 0) {
    return null;
  }
  return token.startsWith("#") ? token : `#${token}`;
}

export function appendRelationTokens(
  relationKind: WaymarkRecord["relations"][number]["kind"],
  value: string,
  relations: WaymarkRecord["relations"],
  canonicalSet: Set<string>
): void {
  const tokens = splitRelationValues(value);
  for (const token of tokens) {
    const normalizedToken = normalizeRelationToken(token);
    if (!normalizedToken) {
      continue;
    }

    if (relationKind === "ref") {
      canonicalSet.add(normalizedToken);
    }

    relations.push({
      kind: relationKind,
      token: normalizedToken,
    });
  }
}

export function extractPropertiesAndRelations(content: string): {
  properties: Record<string, string>;
  relations: WaymarkRecord["relations"];
  canonicals: string[];
} {
  const properties: Record<string, string> = {};
  const relations: WaymarkRecord["relations"] = [];
  const canonicalSet = new Set<string>();

  for (const match of content.matchAll(PROPERTY_REGEX)) {
    const keyRaw = match[1];
    if (!keyRaw) {
      continue;
    }

    const quotedValue = match[2];
    const unquotedValue = match[3];
    const normalizedKey = keyRaw.toLowerCase();

    const rawValue = quotedValue ?? unquotedValue ?? "";
    const value =
      quotedValue !== undefined ? unescapeQuotedValue(quotedValue) : rawValue;

    properties[normalizedKey] = value;

    const relationKind = RELATION_KIND_MAP[normalizedKey];
    if (!relationKind) {
      continue;
    }

    appendRelationTokens(relationKind, value, relations, canonicalSet);
  }

  return {
    properties,
    relations,
    canonicals: Array.from(canonicalSet),
  };
}

export function extractMentions(content: string): string[] {
  const mentions = new Set<string>();

  for (const match of content.matchAll(MENTION_REGEX)) {
    const mention = match[1];
    if (mention) {
      mentions.add(mention);
    }
  }

  return Array.from(mentions);
}

export function extractTags(content: string): string[] {
  const tags = new Set<string>();

  for (const match of content.matchAll(TAG_REGEX)) {
    const tag = match[1];
    if (tag) {
      tags.add(tag);
    }
  }

  return Array.from(tags);
}

export function addRelationTokens(
  record: WaymarkRecord,
  relationKind: WaymarkRecord["relations"][number]["kind"],
  value: string
): void {
  const tokens = splitRelationValues(value);
  for (const token of tokens) {
    const normalizedToken = normalizeRelationToken(token);
    if (normalizedToken) {
      if (
        relationKind === "ref" &&
        !record.canonicals.includes(normalizedToken)
      ) {
        record.canonicals.push(normalizedToken);
      }
      record.relations.push({
        kind: relationKind,
        token: normalizedToken,
      });
    }
  }
}
