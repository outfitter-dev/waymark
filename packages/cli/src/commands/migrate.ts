// tldr ::: migrate command helpers for waymark CLI

import { readFile, writeFile } from "node:fs/promises";

import { formatText } from "@waymarks/core";

import type { CommandContext } from "../types";
import { ensureFileExists } from "../utils/fs";

export type MigrateCommandOptions = {
  filePath: string;
  write: boolean;
};

export async function migrateFile(
  options: MigrateCommandOptions,
  context: CommandContext
): Promise<{ output: string; changed: boolean }> {
  const { filePath, write } = options;
  ensureFileExists(filePath);
  const source = await readFile(filePath, "utf8");
  const migrated = migrateLegacyWaymarks(source);
  const { formattedText } = formatText(migrated, {
    file: filePath,
    config: context.config,
  });

  const changed = formattedText !== source;
  if (write && changed) {
    await writeFile(filePath, formattedText, "utf8");
  }

  return { output: formattedText, changed };
}

export function parseMigrateArgs(argv: string[]): MigrateCommandOptions {
  if (argv.length === 0) {
    throw new Error("migrate requires a file path");
  }

  const write = argv.includes("--write") || argv.includes("-w");
  const remaining = argv.filter((arg) => !arg.startsWith("-"));
  const filePath = remaining[0];

  if (typeof filePath !== "string" || filePath.length === 0) {
    throw new Error("migrate requires a file path");
  }

  return { filePath, write };
}

export function migrateLegacyWaymarks(source: string): string {
  return source
    .replace(/\/\/\s*TODO\s*:/gi, "// todo :::")
    .replace(/\/\/\s*FIXME\s*:/gi, "// fix :::")
    .replace(/\/\/\s*NOTE\s*:/gi, "// note :::");
}
