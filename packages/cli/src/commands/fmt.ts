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

/**
 * Format a single file and optionally write changes.
 * @param options - Target file and write preference.
 * @param context - CLI context with config.
 * @returns Formatting result details.
 */
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

function hasIgnoreMarker(source: string): boolean {
  const lines = source.split("\n");
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#!")) {
      continue;
    }
    if (IGNORE_FILE_MARKER_PATTERN.test(line)) {
      return true;
    }
    const startsWithComment =
      trimmed.startsWith("//") ||
      trimmed.startsWith("#") ||
      trimmed.startsWith("--") ||
      trimmed.startsWith("<!--");
    if (!startsWithComment) {
      break;
    }
  }
  return false;
}
async function filterFilesWithWaymarks(paths: string[]): Promise<string[]> {
  const results: string[] = [];
  for (const path of paths) {
    const source = await readFile(path, "utf8").catch(() => null);
    if (typeof source !== "string") {
      continue;
    }
    if (hasIgnoreMarker(source)) {
      continue;
    }
    if (source.includes(":::")) {
      results.push(path);
    }
  }
  return results;
}

/**
 * Expand input globs and filter to files with waymarks.
 * @param inputs - Input paths or globs.
 * @param config - Resolved waymark configuration.
 * @returns Expanded list of file paths.
 */
export async function expandFormatPaths(
  inputs: string[],
  config: WaymarkConfig
): Promise<string[]> {
  const expanded = await expandInputPaths(inputs, config);
  return await filterFilesWithWaymarks(expanded);
}

/**
 * Parse fmt CLI arguments into options.
 * @param argv - Raw CLI arguments.
 * @returns Parsed format options.
 */
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
