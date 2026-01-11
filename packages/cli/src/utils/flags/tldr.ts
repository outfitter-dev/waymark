// tldr ::: helper to handle --tldr flag as shorthand for --type tldr

import { matchesFlag } from "./iterator";

/**
 * Add "tldr" to the types array when the `--tldr` flag is encountered.
 * This is a convenience shorthand for `--type tldr`.
 * @param token - Current CLI token.
 * @param types - Array to push the tldr marker into.
 * @returns Whether the token was handled.
 */
export function handleTldrFlag(
  token: string | undefined,
  types: string[]
): boolean {
  if (!matchesFlag(token, ["--tldr"])) {
    return false;
  }
  types.push("tldr");
  return true;
}
