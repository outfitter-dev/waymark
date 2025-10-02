// tldr ::: unified wm command orchestration and execution

import type { WaymarkRecord } from "@waymarks/grammar";
import chalk from "chalk";
import type { CommandContext } from "../../types";
import { formatRecords } from "../../utils/display";
import { printMap, serializeMap } from "../../utils/map-rendering";
import { renderRecords } from "../../utils/output";
import { graphRecords } from "../graph";
import { mapFiles } from "../map";
import { scanRecords } from "../scan";
import { applyFilters } from "./filters";
import type { UnifiedCommandOptions } from "./types";

export type UnifiedCommandResult = {
  output: string;
  records?: WaymarkRecord[];
};

/**
 * Unified command handler that intelligently routes to scan/find/map/graph behavior
 * based on flags and arguments provided.
 */
export async function runUnifiedCommand(
  options: UnifiedCommandOptions,
  context: CommandContext
): Promise<UnifiedCommandResult> {
  const { filePaths, isMapMode, isGraphMode, json, summary, noColor } = options;

  // Disable chalk colors if --no-color flag is set
  if (noColor) {
    chalk.level = 0;
  }

  // Map mode: aggregate TLDRs and marker counts
  if (isMapMode) {
    const map = await mapFiles(filePaths, context.config);
    const mapOptions = {
      ...(options.types && { types: options.types }),
      ...(summary !== undefined && { includeSummary: summary }),
    };
    if (json) {
      return { output: JSON.stringify(serializeMap(map, mapOptions)) };
    }
    printMap(map, mapOptions);
    return { output: "" };
  }

  // Graph mode: extract relation edges
  if (isGraphMode) {
    const edges = await graphRecords(filePaths, context.config);
    if (json) {
      return { output: JSON.stringify(edges) };
    }
    return { output: edges.map((edge) => JSON.stringify(edge)).join("\n") };
  }

  // Scan + filter mode (find behavior)
  const records = await scanRecords(filePaths, context.config);
  const filtered = applyFilters(records, options);

  // If JSON output requested, use renderRecords
  if (json) {
    return { output: renderRecords(filtered, "json"), records: filtered };
  }

  // Otherwise use the new display formatting
  return { output: formatRecords(filtered, options), records: filtered };
}
