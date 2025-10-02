// tldr ::: chalk-based styling utilities for waymark CLI output

import { getTypeCategory } from "@waymarks/grammar";
import chalk from "chalk";

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
  signals: { raised: boolean; important: boolean }
): string {
  const color = getTypeColor(type);
  const signalStr =
    (signals.raised ? "^" : "") + (signals.important ? "*" : "");

  if (signalStr) {
    // Bold the signal and type, underline only the type
    return chalk.bold(signalStr) + chalk.bold.underline(color(type));
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
 */
export function styleLineNumber(num: number): string {
  return chalk.dim(`${num}:`);
}

/**
 * Style a file path (underline)
 */
export function styleFilePath(path: string): string {
  return chalk.underline(path);
}

/**
 * Apply inline styling to waymark content text
 * Styles mentions, tags, scopes, and properties within the content
 */
export function styleContent(content: string): string {
  let result = content;

  // Style @mentions (but not @scope/text)
  result = result.replace(/@[A-Za-z0-9._-]+/g, (match) => {
    if (match.includes("/") || match.includes(":")) {
      return styleScope(match);
    }
    return styleMention(match);
  });

  // Style @scope/text
  result = result.replace(
    /@[A-Za-z0-9._-]+\/[A-Za-z0-9._/-]+(\^v[0-9.]+)?/g,
    (match) => styleScope(match)
  );

  // Style #tags (but preserve property keys)
  result = result.replace(/#[A-Za-z0-9._/:%-]+/g, (match) => styleTag(match));

  return result;
}
