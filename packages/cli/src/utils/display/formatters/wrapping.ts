// tldr ::: intelligent line wrapping for waymark content respecting terminal width

// Constants
const DEFAULT_TERMINAL_WIDTH = 80;

// Regex patterns
const ALPHANUMERIC_PATTERN = /[A-Za-z0-9]/;
const TAG_CONTENT_PATTERN = /[A-Za-z0-9._/:%-]/;
const MENTION_CONTENT_PATTERN = /[A-Za-z0-9._-]/;
const PROPERTY_KEY_PATTERN = /[A-Za-z0-9_-]/;
const NON_SPACE_COMMA_PATTERN = /[^\s,]/;
const WHITESPACE_PATTERN = /\s/;
const SPECIAL_CHARS_PATTERN = /[\s#@,]/;

/**
 * Token types for smart breaking
 */
type Token = {
  type: "text" | "tag" | "mention" | "property" | "space" | "comma";
  value: string;
  canBreakBefore: boolean;
};

/**
 * Configuration for wrapping behavior
 */
export type WrapConfig = {
  /** Terminal width (auto-detect if undefined) */
  width?: number;
  /** Disable wrapping entirely */
  noWrap?: boolean;
  /** Indentation for continuation lines */
  indent: number;
};

/**
 * Get terminal width with fallbacks
 */
function getTerminalWidth(): number {
  // Check COLUMNS env var first
  if (process.env.COLUMNS) {
    const parsed = Number.parseInt(process.env.COLUMNS, 10);
    if (!Number.isNaN(parsed) && parsed > 0) {
      return parsed;
    }
  }

  // Try stdout.columns
  if (process.stdout.columns && process.stdout.columns > 0) {
    return process.stdout.columns;
  }

  // Default fallback
  return DEFAULT_TERMINAL_WIDTH;
}

/**
 * Tokenize content into breakable chunks
 */
function tokenize(content: string): Token[] {
  const tokens: Token[] = [];
  let index = 0;

  while (index < content.length) {
    const char = content[index];
    if (!char) {
      break;
    }

    const scanned =
      scanTag(content, index) ??
      scanMention(content, index) ??
      scanPropertyOrText(content, index) ??
      scanWhitespace(content, index) ??
      scanComma(content, index) ??
      scanTextRun(content, index);

    tokens.push(scanned.token);
    index = scanned.nextIndex;
  }

  return tokens;
}

type ScanResult = {
  token: Token;
  nextIndex: number;
};

function scanTag(content: string, index: number): ScanResult | null {
  if (content[index] !== "#" || !isAlphanumeric(content[index + 1])) {
    return null;
  }
  const end = scanWhile(content, index + 1, TAG_CONTENT_PATTERN);
  return {
    token: {
      type: "tag",
      value: content.slice(index, end),
      canBreakBefore: true,
    },
    nextIndex: end,
  };
}

function scanMention(content: string, index: number): ScanResult | null {
  if (content[index] !== "@" || !isAlphanumeric(content[index + 1])) {
    return null;
  }
  const end = scanWhile(content, index + 1, MENTION_CONTENT_PATTERN);
  return {
    token: {
      type: "mention",
      value: content.slice(index, end),
      canBreakBefore: true,
    },
    nextIndex: end,
  };
}

function scanPropertyOrText(content: string, index: number): ScanResult | null {
  const char = content[index];
  if (!(char && ALPHANUMERIC_PATTERN.test(char))) {
    return null;
  }
  const keyEnd = scanWhile(content, index + 1, PROPERTY_KEY_PATTERN);
  const key = content.slice(index, keyEnd);

  if (content[keyEnd] !== ":") {
    return {
      token: { type: "text", value: key, canBreakBefore: false },
      nextIndex: keyEnd,
    };
  }

  const { value, nextIndex } = scanPropertyValue(content, key, keyEnd + 1);
  return {
    token: { type: "property", value, canBreakBefore: true },
    nextIndex,
  };
}

function scanWhitespace(content: string, index: number): ScanResult | null {
  if (!WHITESPACE_PATTERN.test(content[index] ?? "")) {
    return null;
  }
  const end = scanWhile(content, index, WHITESPACE_PATTERN);
  return {
    token: {
      type: "space",
      value: content.slice(index, end),
      canBreakBefore: false,
    },
    nextIndex: end,
  };
}

function scanComma(content: string, index: number): ScanResult | null {
  if (content[index] !== ",") {
    return null;
  }
  return {
    token: { type: "comma", value: ",", canBreakBefore: false },
    nextIndex: index + 1,
  };
}

function scanTextRun(content: string, index: number): ScanResult {
  let end = index + 1;
  while (end < content.length) {
    const nextChar = content[end];
    if (!nextChar) {
      break;
    }
    if (SPECIAL_CHARS_PATTERN.test(nextChar)) {
      break;
    }
    if (isPropertyStart(content, end)) {
      break;
    }
    end += 1;
  }
  return {
    token: {
      type: "text",
      value: content.slice(index, end),
      canBreakBefore: false,
    },
    nextIndex: end,
  };
}

function scanPropertyValue(
  content: string,
  key: string,
  index: number
): { value: string; nextIndex: number } {
  let value = `${key}:`;
  const current = index;

  if (content[current] === '"') {
    value += '"';
    const quoted = scanQuotedValue(content, current + 1);
    value += quoted.value;
    return { value, nextIndex: quoted.nextIndex };
  }

  const end = scanWhile(content, current, NON_SPACE_COMMA_PATTERN);
  value += content.slice(current, end);
  return { value, nextIndex: end };
}

function scanQuotedValue(
  content: string,
  index: number
): { value: string; nextIndex: number; unterminated?: boolean } {
  let value = "";
  let current = index;
  let terminated = false;
  while (current < content.length) {
    const char = content[current] ?? "";
    value += char;
    if (char === "\\" && current + 1 < content.length) {
      const escaped = content[current + 1] ?? "";
      value += escaped;
      current += 2;
      continue;
    }
    if (char === '"') {
      current += 1;
      terminated = true;
      break;
    }
    current += 1;
  }
  return { value, nextIndex: current, unterminated: !terminated };
}

function scanWhile(content: string, index: number, pattern: RegExp): number {
  let current = index;
  while (current < content.length && pattern.test(content[current] ?? "")) {
    current += 1;
  }
  return current;
}

function isAlphanumeric(char?: string): boolean {
  return Boolean(char && ALPHANUMERIC_PATTERN.test(char));
}

function isPropertyStart(content: string, index: number): boolean {
  if (!ALPHANUMERIC_PATTERN.test(content[index] ?? "")) {
    return false;
  }
  const end = scanWhile(content, index + 1, PROPERTY_KEY_PATTERN);
  return content[end] === ":";
}

/**
 * Wrap content to terminal width with smart breaking
 *
 * @param content - The waymark content to wrap (without line number, type, or sigil)
 * @param config - Wrapping configuration
 * @returns Array of wrapped lines
 */
export function wrapContent(content: string, config: WrapConfig): string[] {
  // Handle empty/whitespace-only content early
  if (content.trim() === "") {
    return [""];
  }

  // If wrapping disabled, return single line
  if (config.noWrap === true) {
    return [content];
  }

  const terminalWidth = config.width ?? getTerminalWidth();
  const availableWidth = terminalWidth - config.indent;

  // If content fits on one line, return as-is
  if (content.length <= availableWidth) {
    return [content];
  }

  const tokens = tokenize(content);
  const lines = wrapTokens(tokens, availableWidth);

  if (lines.length === 0) {
    return content.trim() === "" ? [""] : [content];
  }

  return lines;
}

type WrapState = {
  lines: string[];
  currentLine: string;
};

function handleSplitToken(
  split: { lines: string[]; remainder: string; flushCurrentLine: boolean },
  state: WrapState
): void {
  if (split.flushCurrentLine && state.currentLine.trim().length > 0) {
    state.lines.push(state.currentLine.trim());
  }
  state.lines.push(...split.lines);
  state.currentLine = split.remainder;
}

function wrapTokens(tokens: Token[], availableWidth: number): string[] {
  const state: WrapState = { lines: [], currentLine: "" };

  for (let i = 0; i < tokens.length; i += 1) {
    const token = tokens[i];
    if (!token) {
      continue;
    }
    const nextToken = tokens[i + 1];
    const prevToken = i > 0 ? tokens[i - 1] : undefined;
    const canBreakHere = shouldBreakBefore(token, prevToken);

    const split = splitLongToken(token, availableWidth, state.currentLine);
    if (split) {
      handleSplitToken(split, state);
      continue;
    }

    const appended = appendTokenToLine(
      state.currentLine,
      token,
      availableWidth,
      canBreakHere
    );
    if (appended.lineToPush) {
      state.lines.push(appended.lineToPush);
    }
    state.currentLine = appended.nextLine;

    if (
      shouldBreakAfterSpace(token, nextToken, state.currentLine, availableWidth)
    ) {
      state.lines.push(state.currentLine.trim());
      state.currentLine = "";
    }
  }

  if (state.currentLine.trim().length > 0) {
    state.lines.push(state.currentLine.trim());
  }

  return state.lines;
}

function shouldBreakBefore(token: Token, prevToken?: Token): boolean {
  return (
    token.canBreakBefore ||
    (token.type === "text" && prevToken?.type === "space")
  );
}

function splitLongToken(
  token: Token,
  availableWidth: number,
  currentLine: string
): { lines: string[]; remainder: string; flushCurrentLine: boolean } | null {
  if (token.value.length <= availableWidth) {
    return null;
  }
  // Token is longer than availableWidth and needs splitting
  const lines: string[] = [];
  let remaining = token.value;
  // If currentLine has content, signal caller to flush it first
  const flushCurrentLine = currentLine.length > 0;
  while (remaining.length > availableWidth) {
    lines.push(remaining.slice(0, availableWidth));
    remaining = remaining.slice(availableWidth);
  }
  return { lines, remainder: remaining, flushCurrentLine };
}

function appendTokenToLine(
  currentLine: string,
  token: Token,
  availableWidth: number,
  canBreakHere: boolean
): { lineToPush?: string; nextLine: string } {
  const testLine = currentLine + token.value;
  if (testLine.length > availableWidth && currentLine.length > 0) {
    if (canBreakHere) {
      return { lineToPush: currentLine.trim(), nextLine: token.value };
    }
    return { nextLine: testLine };
  }
  return { nextLine: testLine };
}

function shouldBreakAfterSpace(
  token: Token,
  nextToken: Token | undefined,
  currentLine: string,
  availableWidth: number
): boolean {
  return (
    token.type === "space" &&
    Boolean(nextToken) &&
    currentLine.length + (nextToken?.value.length ?? 0) > availableWidth
  );
}
