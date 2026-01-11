// tldr ::: helper for --type flag parsing

import type { ArgIterator } from "./iterator";
import { handleStringListFlag } from "./string-list";

/**
 * Collect waymark type flag values (case-normalized) into the provided accumulator.
 * @param token - Current CLI token.
 * @param iterator - Iterator for remaining args.
 * @param types - Accumulator for type values.
 * @returns Whether the token was handled.
 */
export function handleTypeFlag(
  token: string | undefined,
  iterator: ArgIterator,
  types: string[]
): boolean {
  return handleStringListFlag(token, iterator, {
    names: ["--type", "-t"],
    target: types,
    normalize: (value) => value.toLowerCase(),
    description: "--type",
  });
}
