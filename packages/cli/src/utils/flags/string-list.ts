// tldr ::: helpers for list-style flags with string values

import type { ArgIterator } from "./iterator";
import { matchesFlag } from "./iterator";

/**
 * Generic helper for flags that accept a single string value and can repeat.
 */
export function handleStringListFlag(
  token: string | undefined,
  iterator: ArgIterator,
  options: {
    names: readonly string[];
    target: string[];
    normalize?: (value: string) => string;
    description: string;
  }
): boolean {
  if (!matchesFlag(token, options.names)) {
    return false;
  }
  const value = iterator.consumeValue(options.description);
  const next = options.normalize ? options.normalize(value) : value;
  options.target.push(next);
  return true;
}
