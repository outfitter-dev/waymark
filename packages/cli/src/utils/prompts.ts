// tldr ::: interactive prompts using inquirer for CLI confirmations and selection

import type { WaymarkRecord } from "@waymarks/grammar";
import inquirer from "inquirer";
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

export async function confirm(options: ConfirmOptions): Promise<boolean> {
  assertPromptAllowed("confirmation");
  const { confirmed } = await inquirer.prompt<{ confirmed: boolean }>([
    {
      type: "confirm",
      name: "confirmed",
      message: options.message,
      default: options.default ?? true,
    },
  ]);
  return confirmed;
}

export type WriteConfirmationOptions = {
  filePath: string;
  changeCount?: number;
  actionVerb?: string; // "format", "migrate", etc.
};

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
  pageSize?: number;
};

type WaymarkChoice = {
  name: string;
  value: WaymarkRecord;
  short: string;
};

export async function selectWaymark(
  options: SelectWaymarkOptions
): Promise<WaymarkRecord | undefined> {
  assertPromptAllowed("selection");
  const { records, pageSize = 15 } = options;

  if (records.length === 0) {
    return;
  }

  if (records.length === 1) {
    return records[0];
  }

  const choices: WaymarkChoice[] = records.map((record) => {
    let prefix = " ";
    if (record.signals.flagged) {
      prefix = "~";
    } else if (record.signals.starred) {
      prefix = "*";
    }

    const preview = record.contentText.slice(0, 60);
    const ellipsis = record.contentText.length > 60 ? "..." : "";

    return {
      name: `${prefix}${record.type} ::: ${preview}${ellipsis} (${record.file}:${record.startLine})`,
      value: record,
      short: `${record.file}:${record.startLine}`,
    };
  });

  const promptResult = await inquirer.prompt<{ selected?: WaymarkRecord }>([
    {
      type: "list",
      name: "selected",
      message: "Select a waymark:",
      choices,
      pageSize,
      loop: false,
    },
  ]);

  return promptResult.selected;
}
