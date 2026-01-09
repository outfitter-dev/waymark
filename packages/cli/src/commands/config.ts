// tldr ::: config command helpers for printing resolved settings [[cli/config-print]]

import type { WaymarkConfig } from "@waymarks/core";

import { createUsageError } from "../errors.ts";
import { ExitCode } from "../exit-codes.ts";
import type { CommandContext } from "../types.ts";

export type ConfigCommandOptions = {
  print?: boolean;
  json?: boolean;
};

export type ConfigCommandResult = {
  output: string;
  exitCode: number;
};

const PRETTY_JSON_INDENT = 2;

function serializeConfig(
  config: WaymarkConfig,
  options: { compact?: boolean }
): string {
  const indent = options.compact ? undefined : PRETTY_JSON_INDENT;
  return JSON.stringify(config, null, indent);
}

export function runConfigCommand(
  context: CommandContext,
  options: ConfigCommandOptions = {}
): ConfigCommandResult {
  if (!options.print) {
    throw createUsageError("Config command requires --print.");
  }

  const output = serializeConfig(context.config, {
    compact: Boolean(options.json),
  });

  return {
    output,
    exitCode: ExitCode.success,
  };
}
