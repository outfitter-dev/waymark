// tldr ::: helper to handle --json flag parsing

import { matchesFlag } from "./iterator";

export type JsonFlagState = {
  json: boolean;
};

/**
 * Toggle JSON output mode when the `--json` flag is encountered.
 */
export function handleJsonFlag(
  token: string | undefined,
  state: JsonFlagState
): boolean {
  if (!matchesFlag(token, ["--json"])) {
    return false;
  }
  state.json = true;
  return true;
}
