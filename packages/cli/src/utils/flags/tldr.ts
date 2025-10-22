// tldr ::: helper to handle --tldr flag as shorthand for --type tldr

import { matchesFlag } from "./iterator";

/**
 * Add "tldr" to the types array when the `--tldr` flag is encountered.
 * This is a convenience shorthand for `--type tldr`.
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
