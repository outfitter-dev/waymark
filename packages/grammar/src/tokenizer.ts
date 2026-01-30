// tldr ::: tokenization utilities for waymark grammar parsing

import { SIGIL } from "./constants";

/**
 * Default comment leaders used when no language-specific leaders are provided.
 * Prefer passing leaders from LanguageRegistry.getCommentCapability() for
 * accurate language-specific comment detection.
 *
 * @remarks
 * Order matters: longer prefixes (like "<!--") must precede shorter ones
 * that they contain to ensure correct matching.
 */
const COMMENT_LEADERS = ["<!--", "//", "--", "#", "/*"] as const;
const ANY_WHITESPACE_REGEX = /\s/;
const LEADING_WHITESPACE_REGEX = /^\s*/;

export type SignalState = {
  flagged: boolean;
  starred: boolean;
  current?: boolean;
};

export type ParsedHeader = {
  indent: number;
  commentLeader: string;
  type: string;
  signals: SignalState;
  content: string;
};

/**
 * Normalize a line by stripping trailing carriage returns.
 * @param line - Raw line text.
 * @returns Normalized line text.
 */
export function normalizeLine(line: string): string {
  return line.endsWith("\r") ? line.slice(0, -1) : line;
}

/**
 * Find the comment leader at the start of a string.
 * @param text - Text to inspect.
 * @param leaders - Optional array of comment leaders to use instead of defaults.
 *                  When provided, only these leaders are checked.
 * @returns Comment leader token or null.
 */
export function findCommentLeader(
  text: string,
  leaders?: readonly string[]
): string | null {
  const leaderList = leaders ?? COMMENT_LEADERS;
  for (const leader of leaderList) {
    if (text.startsWith(leader)) {
      return leader;
    }
  }
  return null;
}

/**
 * Parse the signals and type segment before the sigil.
 * @param segment - Raw segment before the sigil.
 * @returns Parsed type, signals, and validity.
 */
export function parseSignalsAndType(segment: string): {
  type: string;
  signals: SignalState;
  valid: boolean;
} {
  const trimmed = segment.trim();
  if (trimmed.length === 0) {
    return {
      type: "",
      signals: { flagged: false, current: false, starred: false },
      valid: true,
    };
  }

  if (ANY_WHITESPACE_REGEX.test(trimmed)) {
    return {
      type: "",
      signals: { flagged: false, current: false, starred: false },
      valid: false,
    };
  }

  let cursor = 0;
  let flagged = false;
  let starred = false;

  while (
    cursor < trimmed.length &&
    (trimmed[cursor] === "~" || trimmed[cursor] === "*")
  ) {
    const char = trimmed[cursor];
    if (char === "~") {
      flagged = true;
    } else if (char === "*") {
      starred = true;
    }
    cursor += 1;
  }

  const type = trimmed.slice(cursor);

  if (type.includes("~") || type.includes("*") || type.includes("^")) {
    return {
      type: "",
      signals: { flagged: false, starred: false },
      valid: false,
    };
  }

  return {
    type: type.toLowerCase(),
    signals: { flagged, starred, current: flagged },
    valid: true,
  };
}

/**
 * Parse a full waymark header line into structured data.
 * @param line - Raw line text.
 * @param leaders - Optional comment leaders to use instead of defaults.
 * @returns Parsed header or null when invalid.
 */
export function parseHeader(
  line: string,
  leaders?: readonly string[]
): ParsedHeader | null {
  const indentMatch = line.match(LEADING_WHITESPACE_REGEX);
  const indent = indentMatch ? indentMatch[0].length : 0;
  const trimmed = line.slice(indent);

  const commentLeader = findCommentLeader(trimmed, leaders);
  if (!commentLeader) {
    return null;
  }

  let afterLeader = trimmed.slice(commentLeader.length);
  if (commentLeader === "/*") {
    const closeIndex = afterLeader.lastIndexOf("*/");
    if (closeIndex !== -1) {
      afterLeader = afterLeader.slice(0, closeIndex).trimEnd();
    }
  }
  const sigilIndex = afterLeader.indexOf(SIGIL);
  if (sigilIndex === -1) {
    return null;
  }

  const beforeSigil = afterLeader.slice(0, sigilIndex);
  const afterSigil = afterLeader.slice(sigilIndex + SIGIL.length);

  const { type, signals, valid } = parseSignalsAndType(beforeSigil);
  if (!valid) {
    return null;
  }

  // If type is empty (typeless :::), this is not a valid header
  // It might be a continuation line but not a header
  if (!type) {
    return null;
  }

  return {
    indent,
    commentLeader,
    type,
    signals,
    content: afterSigil,
  };
}
