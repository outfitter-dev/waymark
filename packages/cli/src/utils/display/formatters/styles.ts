// tldr ::: chalk-based styling utilities for waymark CLI output

import {
  getTypeCategory,
  MENTION_REGEX,
  PROPERTY_REGEX,
  TAG_REGEX,
} from "@waymarks/grammar";
import chalk from "chalk";

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

/**
 * Get color for a waymark type based on its category
 */
export function getTypeColor(type: string): typeof chalk {
  const category = getTypeCategory(type);

  switch (category) {
    case "work":
      return chalk.yellow;
    case "info":
      if (type === "tldr") {
        return chalk.greenBright;
      }
      if (type === "this") {
        return chalk.green;
      }
      return chalk.blue;
    case "caution":
      if (type === "alert") {
        return chalk.red;
      }
      return chalk.magenta;
    case "workflow":
      if (type === "blocked") {
        return chalk.redBright;
      }
      if (type === "needs") {
        return chalk.yellow;
      }
      return chalk.yellow;
    case "inquiry":
      return chalk.yellow;
    default:
      return chalk.white;
  }
}

/**
 * Style a waymark type with appropriate color and signals
 */
export function styleType(
  type: string,
  signals: { flagged: boolean; starred: boolean }
): string {
  const color = getTypeColor(type);
  const signalStr = (signals.flagged ? "~" : "") + (signals.starred ? "*" : "");

  if (signalStr) {
    // Bold the signal and type with same color, use background for emphasis
    // Use bgYellow for a subtle amber/yellow background that works across themes
    return chalk.bgYellow(chalk.bold(color(signalStr + type)));
  }

  return color(type);
}

/**
 * Style the ::: sigil (always dim)
 */
export function styleSigil(text: string): string {
  return chalk.dim(text);
}

/**
 * Style a mention (@user, not @scope/package)
 * Mentions never have / or : in them
 */
export function styleMention(text: string): string {
  if (text.includes("/") || text.includes(":")) {
    return text; // Not a mention, probably @scope or similar
  }
  return chalk.bold.yellow(text);
}

/**
 * Style a tag (#tag or #tag:subtag)
 */
export function styleTag(text: string): string {
  return chalk.bold.cyan(text);
}

/**
 * Style a scoped package reference (@scope/package or @scope/package^v1.0.0)
 */
export function styleScope(text: string): string {
  if (text.includes("/")) {
    return chalk.bold.cyan(text);
  }
  return text;
}

/**
 * Style a property key (dim)
 */
export function styleProperty(text: string): string {
  return chalk.dim(text);
}

/**
 * Style a line number (dim)
 * Accepts either a number or a padded string to preserve alignment
 */
export function styleLineNumber(num: number | string): string {
  return chalk.dim(`${num}`);
}

/**
 * Style a file path (bold, no underline)
 */
export function styleFilePath(path: string): string {
  return chalk.bold(path);
}

/**
 * Apply inline styling to waymark content text
 * Styles tags, properties, mentions, and scopes within the content
 * Order matters: tags first (to avoid conflict with properties containing colons)
 */
export function styleContent(content: string): string {
  // Mask code blocks to prevent property matching inside them
  const { masked, blocks } = maskCodeBlocks(content);
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
        return leadingSpace + chalk.underline(trimmed);
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
        const styledKey = chalk.yellow(`${key}:`);
        const styledValue = value
          .split(",")
          .map((v: string) => styleMention(v.trim()))
          .join(",");
        return leadingSpace + chalk.underline(styledKey + styledValue);
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
        const styledKey = chalk.cyan(`${key}:`);
        const styledValue = value
          .split(",")
          .map((v: string) => styleTag(v.trim()))
          .join(",");
        return leadingSpace + chalk.underline(styledKey + styledValue);
      }

      // Mixed values or other - just underline without extending colors
      return leadingSpace + chalk.underline(trimmed);
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
