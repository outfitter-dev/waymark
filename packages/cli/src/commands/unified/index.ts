// tldr ::: unified wm command orchestration and execution

import type { WaymarkRecord } from "@waymarks/grammar";
import chalk from "chalk";
import type { CommandContext } from "../../types";
import { formatRecords } from "../../utils/display";
import { renderRecords } from "../../utils/output";
import { graphRecords } from "../graph";
import { scanRecords } from "../scan";
import { applyFilters } from "./filters";
import type { UnifiedCommandOptions } from "./types";

export type UnifiedCommandResult = {
  output: string;
  records?: WaymarkRecord[];
};

const DEFAULT_CHALK_LEVEL = chalk.level;

/**
 * Unified command handler that intelligently routes to scan/find/map/graph behavior
 * based on flags and arguments provided.
 */
export async function runUnifiedCommand(
  options: UnifiedCommandOptions,
  context: CommandContext
): Promise<UnifiedCommandResult> {
  const { filePaths, isGraphMode, outputFormat, noColor } = options;

  // Disable chalk colors if --no-color flag is set
  if (noColor) {
    chalk.level = 0;
  } else {
    chalk.level = DEFAULT_CHALK_LEVEL;
  }

  // Graph mode: extract relation edges
  if (isGraphMode) {
    const edges = await graphRecords(filePaths, context.config);
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
  const records = await scanRecords(filePaths, context.config);
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
