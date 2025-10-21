// tldr ::: helper for --type flag parsing

import type { ArgIterator } from "./iterator";
import { handleStringListFlag } from "./string-list";

/**
 * Collect waymark type flag values (case-normalized) into the provided accumulator.
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
