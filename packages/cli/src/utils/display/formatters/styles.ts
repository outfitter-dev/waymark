// tldr ::: @outfitter/cli theme-based styling utilities for waymark CLI output

import { ANSI } from "@outfitter/cli/colors";
import {
  getTypeCategory,
  MENTION_REGEX,
  PROPERTY_REGEX,
  TAG_REGEX,
} from "@waymarks/grammar";
import { isColorEnabled, wrap } from "../../theme";
import { sanitizeInlineText } from "../sanitize";

// Regex for extracting leading whitespace from property matches
const LEADING_SPACE_REGEX = /^\s*/;

// Regex for validating mention-only values (no scoped packages)
const MENTION_ONLY_REGEX = /^@[A-Za-z0-9._-]+$/;

// Regex for validating tag-only values
const TAG_ONLY_REGEX = /^#[A-Za-z0-9._/:%-]+$/;

/**
 * Find the closing position for a balanced structure
 */
function findClosingPosition(
  text: string,
  startPos: number,
  openChar: string,
  closeChar: string
): number | null {
  let depth = 1;
  let pos = startPos + 1;

  while (pos < text.length && depth > 0) {
    if (text[pos] === openChar) {
      depth++;
    } else if (text[pos] === closeChar) {
      depth--;
    }
    pos++;
  }

  return depth === 0 ? pos : null;
}

/**
 * Mask a single code block and return updated state
 */
function maskSingleBlock(
  text: string,
  blocks: string[],
  position: number,
  openIndex: number
): { text: string; position: number } {
  const openChars = ["{", "(", "["];
  const closeChars = ["}", ")", "]"];
  const openChar = openChars[openIndex] ?? "";
  const closeChar = closeChars[openIndex] ?? "";

  const closePos = findClosingPosition(text, position, openChar, closeChar);
  if (closePos === null) {
    return { text, position };
  }

  const block = text.slice(position, closePos);
  blocks.push(block);
  const placeholder = `__CODE_BLOCK_${blocks.length - 1}__`;
  const newText = text.slice(0, position) + placeholder + text.slice(closePos);
  const newPosition = position + placeholder.length - 1;

  return { text: newText, position: newPosition };
}

/**
 * Mask code-like structures (content inside balanced braces/parentheses)
 * to prevent property matching inside code examples
 */
function maskCodeBlocks(text: string): { masked: string; blocks: string[] } {
  const blocks: string[] = [];
  let masked = text;
  const openChars = ["{", "(", "["];

  for (let i = 0; i < masked.length; i++) {
    const char = masked[i];
    const openIndex = openChars.indexOf(char ?? "");

    if (openIndex !== -1) {
      const result = maskSingleBlock(masked, blocks, i, openIndex);
      masked = result.text;
      i = result.position;
    }
  }

  return { masked, blocks };
}

/**
 * Restore masked code blocks
 */
function unmaskCodeBlocks(text: string, blocks: string[]): string {
  let result = text;
  for (let i = 0; i < blocks.length; i++) {
    result = result.replace(`__CODE_BLOCK_${i}__`, blocks[i] ?? "");
  }
  return result;
}

// ANSI inverse escape code
const ANSI_INVERSE = "\x1b[7m";

/**
 * Get the raw ANSI color code for a waymark type based on its category.
 * @param type - Waymark type string.
 * @returns Raw ANSI escape code string.
 */
function getTypeColorCode(type: string): string {
  const category = getTypeCategory(type);

  switch (category) {
    case "work":
      return ANSI.yellow;
    case "info":
      if (type === "tldr") {
        return ANSI.brightGreen;
      }
      if (type === "this") {
        return ANSI.green;
      }
      return ANSI.blue;
    case "caution":
      if (type === "alert") {
        return ANSI.red;
      }
      return ANSI.magenta;
    case "workflow":
      if (type === "blocked") {
        return ANSI.brightRed;
      }
      return ANSI.yellow;
    case "inquiry":
      return ANSI.yellow;
    default:
      return ANSI.white;
  }
}

/**
 * Get color for a waymark type based on its category.
 * @param type - Waymark type string.
 * @returns Function that wraps text with the appropriate color.
 */
export function getTypeColor(type: string): (text: string) => string {
  const code = getTypeColorCode(type);
  return (t: string) => wrap(t, code);
}

/**
 * Style a waymark type with appropriate color and signals.
 * @param type - Waymark type string.
 * @param signals - Signal flags to include.
 * @returns Styled type string.
 */
export function styleType(
  type: string,
  signals: { flagged: boolean; starred: boolean }
): string {
  const signalStr = (signals.flagged ? "~" : "") + (signals.starred ? "*" : "");

  if (signalStr) {
    if (!isColorEnabled()) {
      return signalStr + type;
    }
    const colorCode = getTypeColorCode(type);
    return `${ANSI_INVERSE}${ANSI.bold}${colorCode}${signalStr}${type}${ANSI.reset}`;
  }

  const color = getTypeColor(type);
  return color(type);
}

/**
 * Style the ::: sigil (always dim).
 * @param text - Sigil text to style.
 * @returns Styled sigil string.
 */
export function styleSigil(text: string): string {
  return wrap(text, ANSI.dim);
}

/**
 * Style a mention (@user, not @scope/package).
 * Mentions never have / or : in them.
 * @param text - Mention text.
 * @returns Styled mention string.
 */
export function styleMention(text: string): string {
  if (text.includes("/") || text.includes(":")) {
    return text; // Not a mention, probably @scope or similar
  }
  return wrap(text, ANSI.bold, ANSI.yellow);
}

/**
 * Style a tag (#tag or #tag:subtag).
 * @param text - Tag text.
 * @returns Styled tag string.
 */
export function styleTag(text: string): string {
  return wrap(text, ANSI.bold, ANSI.cyan);
}

/**
 * Style a scoped package reference (@scope/package or @scope/package^v1.0.0).
 * @param text - Scope text.
 * @returns Styled scope string.
 */
export function styleScope(text: string): string {
  if (text.includes("/")) {
    return wrap(text, ANSI.bold, ANSI.cyan);
  }
  return text;
}

/**
 * Style a property key (dim).
 * @param text - Property key text.
 * @returns Styled property string.
 */
export function styleProperty(text: string): string {
  return wrap(text, ANSI.dim);
}

/**
 * Style a line number (dim).
 * Accepts either a number or a padded string to preserve alignment.
 * @param num - Line number or padded string.
 * @returns Styled line number string.
 */
export function styleLineNumber(num: number | string): string {
  return wrap(`${num}`, ANSI.dim);
}

/**
 * Style a file path (bold, no underline).
 * @param path - File path to style.
 * @returns Styled file path.
 */
export function styleFilePath(path: string): string {
  return wrap(path, ANSI.bold);
}

/**
 * Apply inline styling to waymark content text.
 * Styles tags, properties, mentions, and scopes within the content.
 * Order matters: tags first (to avoid conflict with properties containing colons).
 * @param content - Raw content text to style.
 * @returns Styled content string.
 */
export function styleContent(content: string): string {
  const sanitized = sanitizeInlineText(content);
  // Mask code blocks to prevent property matching inside them
  const { masked, blocks } = maskCodeBlocks(sanitized);
  let result = masked;

  // 1. Style #tags first (handles #perf:hotpath before property detection)
  result = result.replace(TAG_REGEX, (match, tag) =>
    match.replace(tag, styleTag(tag))
  );

  // 2. Style properties - extend tag/mention colors when value is homogeneous
  result = result.replace(
    PROPERTY_REGEX,
    (match, key, quotedValue, unquotedValue) => {
      const trimmed = match.trim();
      const leadingSpace = match.match(LEADING_SPACE_REGEX)?.[0] || "";

      // For quoted values, just underline (they could contain anything)
      if (quotedValue !== undefined) {
        return leadingSpace + wrap(trimmed, ANSI.underline);
      }

      const value = unquotedValue ?? "";

      // Check if value contains only mentions (comma-separated, no scoped packages)
      const parts = value.split(",");
      const isMentionOnly =
        parts.length > 0 &&
        parts.every((p: string) => {
          const part = p.trim();
          return (
            MENTION_ONLY_REGEX.test(part) &&
            !part.includes("/") &&
            !part.includes(":")
          );
        });

      if (isMentionOnly) {
        // For mention properties: yellow (not bold) key, bold yellow mentions, underline entire
        const styledKey = wrap(`${key}:`, ANSI.yellow);
        const styledValue = value
          .split(",")
          .map((v: string) => styleMention(v.trim()))
          .join(",");
        return leadingSpace + wrap(styledKey + styledValue, ANSI.underline);
      }

      // Check if value contains only tags (comma-separated)
      const isTagOnly =
        parts.length > 0 &&
        parts.every((p: string) => {
          const part = p.trim();
          return TAG_ONLY_REGEX.test(part);
        });

      if (isTagOnly) {
        // For tag properties: cyan (not bold) key, bold cyan tags, underline entire
        const styledKey = wrap(`${key}:`, ANSI.cyan);
        const styledValue = value
          .split(",")
          .map((v: string) => styleTag(v.trim()))
          .join(",");
        return leadingSpace + wrap(styledKey + styledValue, ANSI.underline);
      }

      // Mixed values or other - just underline without extending colors
      return leadingSpace + wrap(trimmed, ANSI.underline);
    }
  );

  // 3. Style @mentions (but not @scope/text) - will style mentions in properties too
  result = result.replace(MENTION_REGEX, (match, mention) => {
    // Check if it's a scoped package
    if (mention.includes("/") || mention.includes(":")) {
      return match.replace(mention, styleScope(mention));
    }
    return match.replace(mention, styleMention(mention));
  });

  // Restore code blocks
  return unmaskCodeBlocks(result, blocks);
}
