// tldr ::: helper for --mention flag parsing

import type { ArgIterator } from "./iterator";
import { handleStringListFlag } from "./string-list";

/**
 * Capture mention flag values into the provided accumulator.
 */
export function handleMentionFlag(
  token: string | undefined,
  iterator: ArgIterator,
  mentions: string[]
): boolean {
  return handleStringListFlag(token, iterator, {
    names: ["--mention"],
    target: mentions,
    description: "--mention",
  });
}
