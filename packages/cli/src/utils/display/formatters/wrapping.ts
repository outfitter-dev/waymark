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
type TokenRead = {
  token: Token;
  nextIndex: number;
};

function readTagToken(content: string, index: number): TokenRead | undefined {
  const nextChar = content[index + 1] ?? "";
  if (content[index] !== "#" || !ALPHANUMERIC_PATTERN.test(nextChar)) {
    return;
  }

  let value = "#";
  let j = index + 1;
  while (j < content.length && TAG_CONTENT_PATTERN.test(content[j] ?? "")) {
    const c = content[j];
    if (!c) {
      break;
    }
    value += c;
    j += 1;
  }

  return {
    token: { type: "tag", value, canBreakBefore: true },
    nextIndex: j,
  };
}

function readMentionToken(
  content: string,
  index: number
): TokenRead | undefined {
  const nextChar = content[index + 1] ?? "";
  if (content[index] !== "@" || !ALPHANUMERIC_PATTERN.test(nextChar)) {
    return;
  }

  let value = "@";
  let j = index + 1;
  while (j < content.length && MENTION_CONTENT_PATTERN.test(content[j] ?? "")) {
    const c = content[j];
    if (!c) {
      break;
    }
    value += c;
    j += 1;
  }

  return {
    token: { type: "mention", value, canBreakBefore: true },
    nextIndex: j,
  };
}

type PropertyKeyRead = {
  key: string;
  nextIndex: number;
};

type PropertyValueRead = {
  value: string;
  nextIndex: number;
  /** True if a quoted string was not properly terminated */
  unterminated?: boolean;
};

function readPropertyKey(
  content: string,
  index: number
): PropertyKeyRead | undefined {
  const char = content[index] ?? "";
  if (!ALPHANUMERIC_PATTERN.test(char)) {
    return;
  }

  let key = char;
  let j = index + 1;
  while (j < content.length && PROPERTY_KEY_PATTERN.test(content[j] ?? "")) {
    const c = content[j];
    if (!c) {
      break;
    }
    key += c;
    j += 1;
  }

  if (content[j] !== ":") {
    return;
  }

  return { key, nextIndex: j };
}

function readQuotedPropertyValue(
  content: string,
  index: number
): PropertyValueRead {
  let value = '"';
  let j = index + 1;
  let terminated = false;

  while (j < content.length) {
    const c = content[j] ?? "";
    value += c;
    if (c === "\\" && j + 1 < content.length) {
      const escaped = content[j + 1];
      if (escaped) {
        value += escaped;
      }
      j += 2;
      continue;
    }
    if (c === '"') {
      j += 1;
      terminated = true;
      break;
    }
    j += 1;
  }

  return { value, nextIndex: j, unterminated: !terminated };
}

function readUnquotedPropertyValue(
  content: string,
  index: number
): PropertyValueRead {
  let value = "";
  let j = index;
  while (j < content.length && NON_SPACE_COMMA_PATTERN.test(content[j] ?? "")) {
    const c = content[j];
    if (!c) {
      break;
    }
    value += c;
    j += 1;
  }
  return { value, nextIndex: j };
}

function readPropertyValue(content: string, index: number): PropertyValueRead {
  if (index >= content.length) {
    return { value: "", nextIndex: index };
  }
  if (content[index] === '"') {
    return readQuotedPropertyValue(content, index);
  }
  return readUnquotedPropertyValue(content, index);
}

function readPropertyToken(
  content: string,
  index: number
): TokenRead | undefined {
  const keyRead = readPropertyKey(content, index);
  if (!keyRead) {
    return;
  }

  const valueRead = readPropertyValue(content, keyRead.nextIndex + 1);
  const value = `${keyRead.key}:${valueRead.value}`;

  return {
    token: { type: "property", value, canBreakBefore: true },
    nextIndex: valueRead.nextIndex,
  };
}

function readWhitespaceToken(
  content: string,
  index: number
): TokenRead | undefined {
  const char = content[index] ?? "";
  if (!WHITESPACE_PATTERN.test(char)) {
    return;
  }

  let value = "";
  let j = index;
  while (j < content.length && WHITESPACE_PATTERN.test(content[j] ?? "")) {
    const c = content[j];
    if (!c) {
      break;
    }
    value += c;
    j += 1;
  }

  return {
    token: { type: "space", value, canBreakBefore: false },
    nextIndex: j,
  };
}

function readCommaToken(content: string, index: number): TokenRead | undefined {
  if (content[index] !== ",") {
    return;
  }

  return {
    token: { type: "comma", value: ",", canBreakBefore: false },
    nextIndex: index + 1,
  };
}

function isPropertyKeyStart(content: string, index: number): boolean {
  let k = index + 1;
  while (k < content.length && PROPERTY_KEY_PATTERN.test(content[k] ?? "")) {
    k += 1;
  }
  return content[k] === ":";
}

function shouldStopTextToken(content: string, index: number): boolean {
  const nextChar = content[index];
  if (!nextChar) {
    return true;
  }
  if (SPECIAL_CHARS_PATTERN.test(nextChar)) {
    return true;
  }
  if (!ALPHANUMERIC_PATTERN.test(nextChar)) {
    return false;
  }
  return isPropertyKeyStart(content, index);
}

function readTextToken(content: string, index: number): TokenRead | undefined {
  const char = content[index] ?? "";
  if (!char) {
    return;
  }

  let value = char;
  let j = index + 1;
  while (j < content.length && !shouldStopTextToken(content, j)) {
    value += content[j] ?? "";
    j += 1;
  }

  return {
    token: { type: "text", value, canBreakBefore: false },
    nextIndex: j,
  };
}

function tokenize(content: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;

  while (i < content.length) {
    const tokenRead =
      readTagToken(content, i) ??
      readMentionToken(content, i) ??
      readPropertyToken(content, i) ??
      readWhitespaceToken(content, i) ??
      readCommaToken(content, i) ??
      readTextToken(content, i);

    if (!tokenRead) {
      i += 1;
      continue;
    }

    tokens.push(tokenRead.token);
    i = tokenRead.nextIndex;
  }

  return tokens;
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

function wrapTokens(tokens: Token[], availableWidth: number): string[] {
  const lines: string[] = [];
  let currentLine = "";

  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];
    if (!token) {
      continue;
    }

    const nextToken = tokens[i + 1];
    const prevToken = i > 0 ? tokens[i - 1] : undefined;
    const canBreakHere = canBreakBeforeToken(token, prevToken);

    if (token.value.length > availableWidth && currentLine.length === 0) {
      const { remainder, fragments } = splitLongToken(
        token.value,
        availableWidth
      );
      lines.push(...fragments);
      currentLine = remainder;
      continue;
    }

    const { lineToPush, nextLine } = appendToken(
      token.value,
      currentLine,
      availableWidth,
      canBreakHere
    );

    if (lineToPush) {
      lines.push(lineToPush);
    }
    currentLine = nextLine;

    if (shouldBreakOnSpace(token, nextToken, currentLine, availableWidth)) {
      lines.push(currentLine.trim());
      currentLine = "";
    }
  }

  if (currentLine.trim().length > 0) {
    lines.push(currentLine.trim());
  }

  return lines;
}

function splitLongToken(
  value: string,
  availableWidth: number
): { fragments: string[]; remainder: string } {
  const fragments: string[] = [];
  let remaining = value;
  while (remaining.length > availableWidth) {
    fragments.push(remaining.slice(0, availableWidth));
    remaining = remaining.slice(availableWidth);
  }
  return { fragments, remainder: remaining };
}

function appendToken(
  value: string,
  currentLine: string,
  availableWidth: number,
  canBreakHere: boolean
): { lineToPush?: string; nextLine: string } {
  const testLine = currentLine + value;
  if (testLine.length > availableWidth && currentLine.length > 0) {
    if (canBreakHere) {
      return { lineToPush: currentLine.trim(), nextLine: value };
    }
    return { nextLine: testLine };
  }
  return { nextLine: testLine };
}

function canBreakBeforeToken(
  token: Token,
  prevToken: Token | undefined
): boolean {
  return (
    token.canBreakBefore ||
    (token.type === "text" && prevToken?.type === "space")
  );
}

function shouldBreakOnSpace(
  token: Token,
  nextToken: Token | undefined,
  currentLine: string,
  availableWidth: number
): boolean {
  if (token.type !== "space" || !nextToken) {
    return false;
  }
  return currentLine.length + nextToken.value.length > availableWidth;
}
