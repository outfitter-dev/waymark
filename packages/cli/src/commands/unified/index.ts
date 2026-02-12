// tldr ::: unified wm command orchestration and execution

import { type AnyKitError, InternalError, Result } from "@outfitter/contracts";
import type { WaymarkRecord } from "@waymarks/grammar";
import type { CommandContext } from "../../types";
import { formatRecords } from "../../utils/display";
import { renderRecords } from "../../utils/output";
import { setColorEnabled } from "../../utils/theme";
import { graphRecords } from "../graph";
import { type ScanRuntimeOptions, scanRecords } from "../scan";
import { applyFilters } from "./filters";
import type { UnifiedCommandOptions } from "./types";

export type UnifiedCommandResult = {
  output: string;
  records?: WaymarkRecord[];
};

/**
 * Unified command handler that routes to scan/find/graph behavior.
 * @param options - Unified command options.
 * @param context - CLI context with config and globals.
 * @returns Result containing output payload and optional records, or an error.
 */
export function runUnifiedCommand(
  options: UnifiedCommandOptions,
  context: CommandContext
): Promise<Result<UnifiedCommandResult, AnyKitError>> {
  return Result.tryPromise({
    try: () => runUnifiedCommandInner(options, context),
    catch: (cause) =>
      InternalError.create(
        `Unified command failed: ${cause instanceof Error ? cause.message : String(cause)}`
      ),
  });
}

async function runUnifiedCommandInner(
  options: UnifiedCommandOptions,
  context: CommandContext
): Promise<UnifiedCommandResult> {
  const { filePaths, isGraphMode, outputFormat, noColor } = options;
  const scanOptions: ScanRuntimeOptions =
    context.globalOptions.cache === undefined
      ? {}
      : { cache: context.globalOptions.cache };

  // Disable colors if --no-color flag is set; otherwise preserve autodetected state
  if (noColor) {
    setColorEnabled(false);
  }

  // Graph mode: extract relation edges
  if (isGraphMode) {
    const edges = await graphRecords(filePaths, context.config, scanOptions);
    if (outputFormat === "json") {
      return { output: JSON.stringify(edges) };
    }
    if (outputFormat === "jsonl") {
      return { output: edges.map((edge) => JSON.stringify(edge)).join("\n") };
    }
    // Default: human-readable text output
    return {
      output: edges
        .map(
          (e) =>
            `${e.from.file}:${e.from.startLine} -[${e.relation}]-> ${e.toCanonical}`
        )
        .join("\n"),
    };
  }

  // Scan + filter mode (find behavior)
  const scanResult = await scanRecords(filePaths, context.config, scanOptions);
  if (scanResult.isErr()) {
    throw scanResult.error;
  }
  const records = scanResult.value;
  const filtered = applyFilters(records, options);

  // If JSON output requested, use renderRecords
  if (outputFormat) {
    return {
      output: renderRecords(filtered, outputFormat),
      records: filtered,
    };
  }

  // Otherwise use the new display formatting
  return { output: formatRecords(filtered, options), records: filtered };
}
