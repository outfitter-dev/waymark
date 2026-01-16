// tldr ::: helper to handle --summary flag parsing

import { matchesFlag } from "./iterator";

export type SummaryFlagState = {
  summary: boolean;
};

/**
 * Enable summary output when the `--summary` flag is encountered.
 * @param token - Current CLI token.
 * @param state - Summary flag state to mutate.
 * @returns Whether the token was handled.
 */
export function handleSummaryFlag(
  token: string | undefined,
  state: SummaryFlagState
): boolean {
  if (!matchesFlag(token, ["--summary"])) {
    return false;
  }
  state.summary = true;
  return true;
}
