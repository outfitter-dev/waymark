// tldr ::: helper for --mention flag parsing

import type { ArgIterator } from "./iterator";
import { handleStringListFlag } from "./string-list";

/**
 * Capture mention flag values into the provided accumulator.
 * @param token - Current CLI token.
 * @param iterator - Iterator for remaining args.
 * @param mentions - Accumulator for mention values.
 * @returns Whether the token was handled.
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
