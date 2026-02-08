// tldr ::: interactive prompts using @outfitter/cli for CLI confirmations and selection

import { promptConfirm, promptSelect } from "@outfitter/cli/prompt";
import type { WaymarkRecord } from "@waymarks/grammar";
import { CliError } from "../errors.ts";
import { ExitCode } from "../exit-codes.ts";
import { canPrompt } from "./terminal.ts";

type PromptBlockReason = "no-input" | "no-tty" | undefined;

type PromptPolicy = {
  allowed: boolean;
  reason?: PromptBlockReason;
};

let promptPolicy: PromptPolicy = { allowed: true };

// note ::: central prompt policy for --no-input enforcement [[cli/no-input]]
/**
 * Set prompt policy based on no-input flags and TTY detection.
 * @param options - Prompt policy inputs.
 */
export function setPromptPolicy(options: {
  noInput?: boolean;
  isTty?: boolean;
}): void {
  const isTty = options.isTty ?? canPrompt();

  if (options.noInput) {
    promptPolicy = { allowed: false, reason: "no-input" };
    return;
  }

  if (!isTty) {
    promptPolicy = { allowed: false, reason: "no-tty" };
    return;
  }

  promptPolicy = { allowed: true };
}

/**
 * Assert that prompting is allowed for a given action.
 * @param action - Description of the prompt action.
 */
export function assertPromptAllowed(action: string): void {
  if (promptPolicy.allowed) {
    return;
  }

  const reason = promptPolicy.reason;
  const details =
    reason === "no-input"
      ? "because --no-input was specified"
      : "because the terminal is not interactive";

  throw new CliError(
    `Cannot prompt for ${action} ${details}.`,
    ExitCode.usageError
  );
}

export type ConfirmOptions = {
  message: string;
  default?: boolean;
};

/**
 * Show a confirmation prompt.
 * @param options - Confirmation prompt options.
 * @returns True when confirmed.
 */
export async function confirm(options: ConfirmOptions): Promise<boolean> {
  assertPromptAllowed("confirmation");
  const result = await promptConfirm({
    message: options.message,
    initialValue: options.default ?? true,
  });
  if (result.isErr()) {
    throw new CliError("Operation cancelled", ExitCode.usageError);
  }
  return result.value;
}

export type WriteConfirmationOptions = {
  filePath: string;
  changeCount?: number;
  actionVerb?: string; // "format", "migrate", etc.
};

/**
 * Show a confirmation prompt before writing changes.
 * @param options - Write confirmation options.
 * @returns True when confirmed.
 */
export async function confirmWrite(
  options: WriteConfirmationOptions
): Promise<boolean> {
  const { filePath, changeCount } = options;

  let message = `Write changes to ${filePath}?`;
  if (changeCount !== undefined) {
    message = `Write ${changeCount} change(s) to ${filePath}?`;
  }

  return await confirm({ message, default: true });
}

export type SelectWaymarkOptions = {
  records: WaymarkRecord[];
};

/**
 * Prompt the user to select a waymark from a list.
 * @param options - Selection prompt options.
 * @returns Selected waymark or undefined if cancelled.
 */
export async function selectWaymark(
  options: SelectWaymarkOptions
): Promise<WaymarkRecord | undefined> {
  assertPromptAllowed("selection");
  const { records } = options;

  if (records.length === 0) {
    return;
  }

  if (records.length === 1) {
    return records[0];
  }

  const selectOptions = records.map((record) => {
    let prefix = " ";
    if (record.signals.flagged) {
      prefix = "~";
    } else if (record.signals.starred) {
      prefix = "*";
    }

    const preview = record.contentText.slice(0, 60);
    const ellipsis = record.contentText.length > 60 ? "..." : "";

    return {
      value: record,
      label: `${prefix}${record.type} ::: ${preview}${ellipsis} (${record.file}:${record.startLine})`,
      hint: `${record.file}:${record.startLine}`,
    };
  });

  const result = await promptSelect<WaymarkRecord>({
    message: "Select a waymark:",
    options: selectOptions,
  });

  if (result.isErr()) {
    throw new CliError("Selection cancelled", ExitCode.usageError);
  }

  return result.value;
}
