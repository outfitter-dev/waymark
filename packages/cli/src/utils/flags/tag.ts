// tldr ::: helper for --tag flag parsing

import type { ArgIterator } from "./iterator";
import { handleStringListFlag } from "./string-list";

/**
 * Collect tag flag values into the provided accumulator.
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
