// tldr ::: property, mention, and tag extraction utilities for waymark grammar

import type { WaymarkRecord } from "./types";

// Exported regex patterns for reuse in styling and other contexts
// note ::: No space allowed after colon for unquoted values (key:value not key: value)
export const PROPERTY_REGEX =
  /(?:^|[\s])([A-Za-z][A-Za-z0-9_-]*)\s*:(?:"([^"\\]*(?:\\.[^"\\]*)*)"|([^\s,]+(?:,[^\s,]+)*))/gm;
// note ::: requires lowercase first char to reject decorators (@Component)
// note ::: lookahead rejects both continuations and parens to prevent backtracking on @dataclass()
export const MENTION_REGEX =
  /(?:^|[^A-Za-z0-9/_-])(@[a-z][A-Za-z0-9/_-]*)(?![A-Za-z0-9/_(-])/gm;
export const TAG_REGEX = /(?:^|[^A-Za-z0-9._/:%-])(#[A-Za-z0-9._/:%-]+)/gm;

export const RELATION_KIND_MAP: Record<
  string,
  WaymarkRecord["relations"][number]["kind"]
> = {
  see: "see",
  docs: "docs",
  from: "from",
  replaces: "replaces",
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

// note ::: URL schemes to preserve without # prefix in relation values
const URL_SCHEME_PATTERN = /^[a-z][a-z0-9+.-]*:\/\//i;

export function isUrl(value: string): boolean {
  return URL_SCHEME_PATTERN.test(value);
}

export function normalizeRelationToken(token: string): string | null {
  if (token.length === 0) {
    return null;
  }
  // Preserve URLs as-is (e.g., docs:https://example.com)
  if (isUrl(token)) {
    return token;
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

    if (relationKind === "see") {
      canonicalSet.add(normalizedToken);
    }

    relations.push({
      kind: relationKind,
      token: normalizedToken,
    });
  }
}

/**
 * Mask content inside backticks to prevent property extraction
 * about ::: prevents parsing `key:value` patterns inside inline code
 */
export function maskBackticks(text: string): {
  masked: string;
  blocks: string[];
} {
  const blocks: string[] = [];
  let masked = text;
  let i = 0;

  while (i < masked.length) {
    if (masked[i] === "`") {
      // Find closing backtick
      let closePos = i + 1;
      while (closePos < masked.length && masked[closePos] !== "`") {
        closePos++;
      }

      if (closePos < masked.length) {
        // Found matching closing backtick
        const block = masked.slice(i, closePos + 1);
        blocks.push(block);
        const placeholder = `__BACKTICK_BLOCK_${blocks.length - 1}__`;
        masked = masked.slice(0, i) + placeholder + masked.slice(closePos + 1);
        i += placeholder.length;
      } else {
        // No closing backtick, skip this one
        i++;
      }
    } else {
      i++;
    }
  }

  return { masked, blocks };
}

/**
 * Restore masked backtick blocks
 */
export function unmaskBackticks(text: string, blocks: string[]): string {
  let result = text;
  for (let i = 0; i < blocks.length; i++) {
    result = result.replace(`__BACKTICK_BLOCK_${i}__`, blocks[i] ?? "");
  }
  return result;
}

export function extractPropertiesAndRelations(content: string): {
  properties: Record<string, string>;
  relations: WaymarkRecord["relations"];
  canonicals: string[];
} {
  const properties: Record<string, string> = {};
  const relations: WaymarkRecord["relations"] = [];
  const canonicalSet = new Set<string>();

  // Mask backtick content to prevent property extraction inside inline code
  const { masked, blocks } = maskBackticks(content);

  for (const match of masked.matchAll(PROPERTY_REGEX)) {
    const keyRaw = match[1];
    if (!keyRaw) {
      continue;
    }

    const quotedValue = match[2];
    const unquotedValue = match[3];
    const normalizedKey = keyRaw.toLowerCase();

    const rawValue = quotedValue ?? unquotedValue ?? "";
    // Unmask any backticks in the value
    const unmaskedValue = unmaskBackticks(rawValue, blocks);
    const value =
      quotedValue !== undefined
        ? unescapeQuotedValue(unmaskedValue)
        : unmaskedValue;

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
        relationKind === "see" &&
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
