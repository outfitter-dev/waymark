// tldr ::: config command helpers for printing resolved settings [[cli/config-print]]

import { ValidationError } from "@outfitter/contracts";
import type { WaymarkConfig } from "@waymarks/core";
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

/**
 * Execute the `wm config` command to print resolved configuration.
 * @param context - CLI context with config.
 * @param options - Command options controlling output.
 * @returns Output payload and exit code.
 */
export function runConfigCommand(
  context: CommandContext,
  options: ConfigCommandOptions = {}
): ConfigCommandResult {
  if (!options.print) {
    throw ValidationError.fromMessage("Config command requires --print.");
  }

  const output = serializeConfig(context.config, {
    compact: Boolean(options.json),
  });

  return {
    output,
    exitCode: 0,
  };
}
