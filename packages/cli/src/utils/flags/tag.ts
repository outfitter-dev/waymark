// tldr ::: helper for --tag flag parsing

import type { ArgIterator } from "./iterator";
import { handleStringListFlag } from "./string-list";

/**
 * Collect tag flag values into the provided accumulator.
 * @param token - Current CLI token.
 * @param iterator - Iterator for remaining args.
 * @param tags - Accumulator for tag values.
 * @returns Whether the token was handled.
 */
export function handleTagFlag(
  token: string | undefined,
  iterator: ArgIterator,
  tags: string[]
): boolean {
  return handleStringListFlag(token, iterator, {
    names: ["--tag"],
    target: tags,
    description: "--tag",
  });
}
