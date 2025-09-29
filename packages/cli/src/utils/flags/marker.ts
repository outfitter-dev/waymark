// tldr ::: helper for --marker flag parsing

import type { ArgIterator } from "./iterator";
import { handleStringListFlag } from "./string-list";

/**
 * Collect marker flag values (case-normalized) into the provided accumulator.
 */
export function handleMarkerFlag(
  token: string | undefined,
  iterator: ArgIterator,
  markers: string[]
): boolean {
  return handleStringListFlag(token, iterator, {
    names: ["--marker", "-m"],
    target: markers,
    normalize: (value) => value.toLowerCase(),
    description: "--marker",
  });
}
