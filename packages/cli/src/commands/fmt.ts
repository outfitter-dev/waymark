// tldr ::: format command helpers for waymark CLI

import { readFile, writeFile } from "node:fs/promises";

import type { FormatResult } from "@waymarks/core";
import { formatText } from "@waymarks/core";

import type { CommandContext } from "../types";
import { ensureFileExists } from "../utils/fs";

export type FormatCommandOptions = {
  filePath: string;
  write: boolean;
};

export async function formatFile(
  options: FormatCommandOptions,
  context: CommandContext
): Promise<FormatResult> {
  const { filePath, write } = options;
  ensureFileExists(filePath);
  const source = await readFile(filePath, "utf8");
  const result = formatText(source, {
    file: filePath,
    config: context.config,
  });

  if (write && result.edits.length > 0) {
    await writeFile(filePath, result.formattedText, "utf8");
  }

  return result;
}

export function parseFormatArgs(argv: string[]): FormatCommandOptions {
  if (argv.length === 0) {
    throw new Error("fmt requires a file path");
  }

  const write = argv.includes("--write") || argv.includes("-w");
  const remaining = argv.filter((arg) => !arg.startsWith("-"));
  const filePath = remaining[0];

  if (typeof filePath !== "string" || filePath.length === 0) {
    throw new Error("fmt requires a file path");
  }

  return {
    filePath,
    write,
  };
}
