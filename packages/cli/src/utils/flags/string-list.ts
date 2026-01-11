// tldr ::: helpers for list-style flags with string values

import type { ArgIterator } from "./iterator";
import { matchesFlag } from "./iterator";

/**
 * Generic helper for flags that accept a single string value and can repeat.
 * @param token - Current CLI token.
 * @param iterator - Iterator for remaining args.
 * @param options - Flag names, target list, and normalization settings.
 * @returns Whether the token was handled.
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
