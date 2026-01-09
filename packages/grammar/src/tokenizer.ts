// tldr ::: tokenization utilities for waymark grammar parsing

import { SIGIL } from "./constants";

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

export function normalizeLine(line: string): string {
  return line.endsWith("\r") ? line.slice(0, -1) : line;
}

export function findCommentLeader(text: string): string | null {
  for (const leader of COMMENT_LEADERS) {
    if (text.startsWith(leader)) {
      return leader;
    }
  }
  return null;
}

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

export function parseHeader(line: string): ParsedHeader | null {
  const indentMatch = line.match(LEADING_WHITESPACE_REGEX);
  const indent = indentMatch ? indentMatch[0].length : 0;
  const trimmed = line.slice(indent);

  const commentLeader = findCommentLeader(trimmed);
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
