// tldr ::: helper to handle --json flag parsing

import { matchesFlag } from "./iterator";

export type OutputFormat = "json" | "jsonl";

export type JsonFlagState = {
  outputFormat: OutputFormat | null;
};

/**
 * Toggle JSON output mode when the `--json` or `--jsonl` flag is encountered.
 */
export function handleJsonFlag(
  token: string | undefined,
  state: JsonFlagState
): boolean {
  if (matchesFlag(token, ["--json"])) {
    state.outputFormat = "json";
    return true;
  }
  if (matchesFlag(token, ["--jsonl"])) {
    state.outputFormat = "jsonl";
    return true;
  }
  return false;
}
