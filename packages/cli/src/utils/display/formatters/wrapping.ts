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
  let i = 0;

  while (i < content.length) {
    const char = content[i];
    if (!char) {
      break;
    }

    // Handle tags (#tag)
    if (char === "#" && ALPHANUMERIC_PATTERN.test(content[i + 1] ?? "")) {
      let value = "#";
      let j = i + 1;
      while (j < content.length && TAG_CONTENT_PATTERN.test(content[j] ?? "")) {
        const c = content[j];
        if (!c) {
          break;
        }
        value += c;
        j++;
      }
      tokens.push({ type: "tag", value, canBreakBefore: true });
      i = j;
      continue;
    }

    // Handle mentions (@user)
    if (char === "@" && ALPHANUMERIC_PATTERN.test(content[i + 1] ?? "")) {
      let value = "@";
      let j = i + 1;
      while (
        j < content.length &&
        MENTION_CONTENT_PATTERN.test(content[j] ?? "")
      ) {
        const c = content[j];
        if (!c) {
          break;
        }
        value += c;
        j++;
      }
      tokens.push({ type: "mention", value, canBreakBefore: true });
      i = j;
      continue;
    }

    // Handle properties (key:value or key:"quoted value")
    if (ALPHANUMERIC_PATTERN.test(char)) {
      let value = char;
      let j = i + 1;

      // Scan for key
      while (
        j < content.length &&
        PROPERTY_KEY_PATTERN.test(content[j] ?? "")
      ) {
        const c = content[j];
        if (!c) {
          break;
        }
        value += c;
        j++;
      }

      // Check if followed by colon (property key)
      if (content[j] === ":") {
        value += ":";
        j++;

        // Handle quoted value
        if (content[j] === '"') {
          value += '"';
          j++;
          while (j < content.length) {
            const c = content[j] ?? "";
            value += c;
            if (c === "\\" && j + 1 < content.length) {
              // Escaped character
              const escaped = content[j + 1];
              if (escaped) {
                value += escaped;
              }
              j += 2;
            } else if (c === '"') {
              j++;
              break;
            } else {
              j++;
            }
          }
        } else {
          // Unquoted value (no spaces)
          while (
            j < content.length &&
            NON_SPACE_COMMA_PATTERN.test(content[j] ?? "")
          ) {
            const c = content[j];
            if (!c) {
              break;
            }
            value += c;
            j++;
          }
        }

        tokens.push({ type: "property", value, canBreakBefore: true });
        i = j;
        continue;
      }

      // Not a property, treat as text
      tokens.push({ type: "text", value, canBreakBefore: false });
      i = j;
      continue;
    }

    // Handle spaces
    if (WHITESPACE_PATTERN.test(char)) {
      let value = "";
      let j = i;
      while (j < content.length && WHITESPACE_PATTERN.test(content[j] ?? "")) {
        const c = content[j];
        if (!c) {
          break;
        }
        value += c;
        j++;
      }
      tokens.push({ type: "space", value, canBreakBefore: false });
      i = j;
      continue;
    }

    // Handle commas
    if (char === ",") {
      tokens.push({ type: "comma", value: ",", canBreakBefore: false });
      i++;
      continue;
    }

    // Default: treat as text (collect until special character)
    let value = char;
    let j = i + 1;
    while (j < content.length) {
      const nextChar = content[j];
      if (!nextChar) {
        break;
      }
      // Stop at spaces, tags, mentions, commas, or potential property keys
      if (SPECIAL_CHARS_PATTERN.test(nextChar)) {
        break;
      }
      // Check if this could be start of a property (letter followed eventually by colon)
      if (ALPHANUMERIC_PATTERN.test(nextChar)) {
        // Peek ahead to see if it's a property
        let k = j + 1;
        while (
          k < content.length &&
          PROPERTY_KEY_PATTERN.test(content[k] ?? "")
        ) {
          k++;
        }
        if (content[k] === ":") {
          // This is a property, stop here
          break;
        }
      }
      value += nextChar;
      j++;
    }
    tokens.push({ type: "text", value, canBreakBefore: false });
    i = j;
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
  const lines: string[] = [];
  let currentLine = "";

  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];
    if (!token) {
      continue;
    }
    const nextToken = tokens[i + 1];
    const prevToken = i > 0 ? tokens[i - 1] : undefined;

    // Determine if we can break before this token
    // Allow breaking before tags, mentions, properties, AND text that follows a space
    const canBreakHere =
      token.canBreakBefore ||
      (token.type === "text" && prevToken?.type === "space");

    // Handle very long single tokens (longer than available width)
    if (token.value.length > availableWidth && currentLine.length === 0) {
      // Single token too long - force split it
      let remaining = token.value;
      while (remaining.length > availableWidth) {
        lines.push(remaining.slice(0, availableWidth));
        remaining = remaining.slice(availableWidth);
      }
      currentLine = remaining;
      continue;
    }

    // Add token to current line
    const testLine = currentLine + token.value;

    // Check if this line would exceed width
    if (testLine.length > availableWidth && currentLine.length > 0) {
      // Can we break before this token?
      if (canBreakHere) {
        // Push current line and start new one
        lines.push(currentLine.trim());
        currentLine = token.value;
      } else {
        // Can't break here, add to current line anyway
        currentLine = testLine;
      }
    } else {
      // Fits on current line
      currentLine = testLine;
    }

    // Special handling: if this is a space and next token would overflow,
    // consider breaking here
    if (
      token.type === "space" &&
      nextToken &&
      currentLine.length + nextToken.value.length > availableWidth
    ) {
      lines.push(currentLine.trim());
      currentLine = "";
    }
  }

  // Push remaining content
  if (currentLine.trim().length > 0) {
    lines.push(currentLine.trim());
  }

  // If no lines were added (e.g., all whitespace), return appropriate value
  if (lines.length === 0) {
    return content.trim() === "" ? [""] : [content];
  }

  return lines;
}
