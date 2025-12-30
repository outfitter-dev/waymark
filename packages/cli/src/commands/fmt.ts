// tldr ::: format command helpers for waymark CLI

import { readFile, writeFile } from "node:fs/promises";

import type { FormatResult, WaymarkConfig } from "@waymarks/core";
import { formatText } from "@waymarks/core";

import type { CommandContext } from "../types";
import { ensureFileExists, expandInputPaths } from "../utils/fs";

export type FormatCommandOptions = {
  filePaths: string[];
  write: boolean;
};

const IGNORE_FILE_MARKER_PATTERN =
  /^\s*(\/\/|#|--|<!--)\s*waymark-ignore-file\b/;

export async function formatFile(
  options: { filePath: string; write: boolean },
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

async function filterFilesWithWaymarks(paths: string[]): Promise<string[]> {
  const results: string[] = [];
  for (const path of paths) {
    const source = await readFile(path, "utf8").catch(() => null);
    if (typeof source !== "string") {
      continue;
    }
    if (source.includes(":::")) {
      results.push(path);
    }
  }
  return results;
}

export async function expandFormatPaths(
  inputs: string[],
  config: WaymarkConfig
): Promise<string[]> {
  const expanded = await expandInputPaths(inputs, config);
  return await filterFilesWithWaymarks(expanded);
}

export function parseFormatArgs(argv: string[]): FormatCommandOptions {
  if (argv.length === 0) {
    throw new Error("fmt requires at least one file path");
  }

  const write = argv.includes("--write") || argv.includes("-w");
  const remaining = argv.filter((arg) => !arg.startsWith("-"));
  const filePaths = remaining.filter((path) => path.length > 0);

  if (filePaths.length === 0) {
    throw new Error("fmt requires at least one file path");
  }

  return {
    filePaths,
    write,
  };
}
