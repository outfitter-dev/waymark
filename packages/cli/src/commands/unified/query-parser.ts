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
 * Parse a query string into structured filters.
 *
 * Examples:
 *   "todo @agent #perf" → types: [todo], mentions: [@agent], tags: [#perf]
 *   "fix !@alice" → types: [fix], exclusions.mentions: [@alice]
 *   "owner:@alice" → properties: { owner: "@alice" }
 * @param query - Raw query string.
 * @returns Parsed query tokens and filters.
 */
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
    applyToken(token, result);
  }

  return result;
}

function applyToken(token: QueryToken, result: ParsedQuery): void {
  switch (token.type) {
    case "exclusion":
      classifyExclusion(token.value, result);
      return;
    case "type":
      result.types.push(token.value);
      return;
    case "mention":
      result.mentions.push(token.value);
      return;
    case "tag":
      result.tags.push(token.value);
      return;
    case "property":
      applyPropertyToken(token.value, result);
      return;
    case "text":
      result.textTerms.push(token.value);
      return;
    default:
      return;
  }
}

function applyPropertyToken(value: string, result: ParsedQuery): void {
  const [key, propertyValue] = value.split(":", 2);
  if (key && propertyValue) {
    result.properties.set(key, propertyValue);
  } else if (key) {
    result.properties.set(key, true);
  }
}

/**
 * Tokenize a query string into individual tokens
 */
function tokenize(query: string): QueryToken[] {
  const tokens: QueryToken[] = [];
  const state = {
    current: "",
    inQuotes: false,
  };
  let i = 0;

  while (i < query.length) {
    const char = query.charAt(i);

    if (handleQuote(char, state, tokens)) {
      i += 1;
      continue;
    }

    if (state.inQuotes) {
      state.current += char;
      i += 1;
      continue;
    }

    if (handleWhitespace(char, state, tokens)) {
      i += 1;
      continue;
    }

    state.current += char;
    i += 1;
  }

  // Emit final token
  flushFinalToken(state, tokens);

  return tokens;
}

type TokenizeState = {
  current: string;
  inQuotes: boolean;
};

function handleQuote(
  char: string,
  state: TokenizeState,
  tokens: QueryToken[]
): boolean {
  if (char !== '"') {
    return false;
  }
  if (state.inQuotes) {
    emitQuotedToken(state, tokens);
    state.inQuotes = false;
  } else {
    flushCurrentToken(state, tokens);
    state.inQuotes = true;
  }
  return true;
}

function handleWhitespace(
  char: string,
  state: TokenizeState,
  tokens: QueryToken[]
): boolean {
  if (char !== " " && char !== "\t") {
    return false;
  }
  flushCurrentToken(state, tokens);
  return true;
}

function flushCurrentToken(state: TokenizeState, tokens: QueryToken[]): void {
  if (!state.current) {
    return;
  }
  emitToken(state.current, tokens);
  state.current = "";
}

function emitQuotedToken(state: TokenizeState, tokens: QueryToken[]): void {
  if (!state.current) {
    return;
  }
  tokens.push({
    type: "text",
    value: state.current,
    raw: `"${state.current}"`,
  });
  state.current = "";
}

function flushFinalToken(state: TokenizeState, tokens: QueryToken[]): void {
  if (!state.current) {
    return;
  }
  if (state.inQuotes) {
    tokens.push({
      type: "text",
      value: state.current,
      raw: `"${state.current}`,
    });
  } else {
    emitToken(state.current, tokens);
  }
  state.current = "";
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
