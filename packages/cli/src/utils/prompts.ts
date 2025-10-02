// tldr ::: interactive prompts using inquirer for CLI confirmations and selection

import type { WaymarkRecord } from "@waymarks/grammar";
import inquirer from "inquirer";

export type ConfirmOptions = {
  message: string;
  default?: boolean;
};

export async function confirm(options: ConfirmOptions): Promise<boolean> {
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
  const { records, pageSize = 15 } = options;

  if (records.length === 0) {
    return;
  }

  if (records.length === 1) {
    return records[0];
  }

  const choices: WaymarkChoice[] = records.map((record) => {
    let prefix = " ";
    if (record.signals.raised) {
      prefix = "^";
    } else if (record.signals.important) {
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
