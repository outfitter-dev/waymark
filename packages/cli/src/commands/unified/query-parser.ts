// tldr ::: natural language query parsing for waymark CLI

import { BLESSED_MARKERS, getCanonicalType } from "@waymarks/grammar";

/**
 * Token types extracted from query strings
 */
export type QueryToken = {
  type: "type" | "mention" | "tag" | "property" | "text" | "exclusion";
  value: string;
  raw: string;
};

/**
 * Parsed query result
 */
export type ParsedQuery = {
  types: string[];
  mentions: string[];
  tags: string[];
  properties: Map<string, string | true>; // true = has property (any value)
  exclusions: {
    types: string[];
    mentions: string[];
    tags: string[];
  };
  textTerms: string[];
};

/**
 * Parse a query string into structured filters
 *
 * Examples:
 *   "todo @agent #perf" → types: [todo], mentions: [@agent], tags: [#perf]
 *   "fix !@alice" → types: [fix], exclusions.mentions: [@alice]
 *   "owner:@alice" → properties: { owner: "@alice" }
 */
// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: token classification requires multiple branches
export function parseQuery(query: string): ParsedQuery {
  const tokens = tokenize(query);
  const result: ParsedQuery = {
    types: [],
    mentions: [],
    tags: [],
    properties: new Map(),
    exclusions: {
      types: [],
      mentions: [],
      tags: [],
    },
    textTerms: [],
  };

  for (const token of tokens) {
    if (token.type === "exclusion") {
      classifyExclusion(token.value, result);
    } else if (token.type === "type") {
      result.types.push(token.value);
    } else if (token.type === "mention") {
      result.mentions.push(token.value);
    } else if (token.type === "tag") {
      result.tags.push(token.value);
    } else if (token.type === "property") {
      const [key, value] = token.value.split(":", 2);
      if (key && value) {
        result.properties.set(key, value);
      } else if (key) {
        result.properties.set(key, true);
      }
    } else if (token.type === "text") {
      result.textTerms.push(token.value);
    }
  }

  return result;
}

/**
 * Tokenize a query string into individual tokens
 */
// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: quote handling and state machine requires complex branching
function tokenize(query: string): QueryToken[] {
  const tokens: QueryToken[] = [];
  let current = "";
  let inQuotes = false;
  let i = 0;

  while (i < query.length) {
    const char = query[i];

    // Handle quoted strings
    if (char === '"') {
      if (inQuotes) {
        // End quote - emit current as text token
        if (current) {
          tokens.push({
            type: "text",
            value: current,
            raw: `"${current}"`,
          });
          current = "";
        }
        inQuotes = false;
      } else {
        // Start quote
        if (current) {
          emitToken(current, tokens);
          current = "";
        }
        inQuotes = true;
      }
      i++;
      continue;
    }

    // Inside quotes, accumulate everything
    if (inQuotes) {
      current += char;
      i++;
      continue;
    }

    // Whitespace delimiter
    if (char === " " || char === "\t") {
      if (current) {
        emitToken(current, tokens);
        current = "";
      }
      i++;
      continue;
    }

    // Accumulate character
    current += char;
    i++;
  }

  // Emit final token
  if (current) {
    if (inQuotes) {
      // Unclosed quote - treat as text
      tokens.push({ type: "text", value: current, raw: `"${current}` });
    } else {
      emitToken(current, tokens);
    }
  }

  return tokens;
}

/**
 * Emit a token by classifying its type
 */
function emitToken(raw: string, tokens: QueryToken[]): void {
  // Exclusion prefix
  if (raw.startsWith("!")) {
    tokens.push({
      type: "exclusion",
      value: raw.slice(1),
      raw,
    });
    return;
  }

  // Property (key:value or key:)
  if (raw.includes(":") && !raw.startsWith("#") && !raw.startsWith("@")) {
    tokens.push({
      type: "property",
      value: raw,
      raw,
    });
    return;
  }

  // Mention (@agent, @alice)
  if (raw.startsWith("@")) {
    tokens.push({
      type: "mention",
      value: raw,
      raw,
    });
    return;
  }

  // Tag (#perf, #wip/something)
  if (raw.startsWith("#")) {
    tokens.push({
      type: "tag",
      value: raw,
      raw,
    });
    return;
  }

  // Try fuzzy type matching
  const canonicalType = fuzzyMatchType(raw);
  if (canonicalType) {
    tokens.push({
      type: "type",
      value: canonicalType,
      raw,
    });
    return;
  }

  // Default to text
  tokens.push({
    type: "text",
    value: raw,
    raw,
  });
}

/**
 * Classify an exclusion token (! prefix removed)
 */
function classifyExclusion(value: string, result: ParsedQuery): void {
  if (value.startsWith("@")) {
    result.exclusions.mentions.push(value);
  } else if (value.startsWith("#")) {
    result.exclusions.tags.push(value);
  } else {
    const canonicalType = fuzzyMatchType(value);
    if (canonicalType) {
      result.exclusions.types.push(canonicalType);
    }
  }
}

/**
 * Fuzzy match a string to a blessed marker type
 *
 * Returns the canonical type name or null if no match
 */
function fuzzyMatchType(input: string): string | null {
  const normalized = input.toLowerCase().trim();

  // Check if it's a known marker or alias (getCanonicalType returns input if not found)
  const canonical = getCanonicalType(normalized);
  if (BLESSED_MARKERS.includes(canonical)) {
    return canonical;
  }

  // Common variations not already in aliases
  const variations: Record<string, string> = {
    todos: "todo",
    "to do": "todo",
    "to-do": "todo",
    "fix me": "fix",
    notes: "note",
    tldrs: "tldr",
  };

  return variations[normalized] ?? null;
}
