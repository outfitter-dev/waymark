// tldr ::: unified wm command orchestration and execution

import type { CommandContext } from "../../types";
import { formatRecords } from "../../utils/display";
import { printMap, serializeMap } from "../../utils/map-rendering";
import { renderRecords } from "../../utils/output";
import { graphRecords } from "../graph";
import { mapFiles } from "../map";
import { scanRecords } from "../scan";
import { applyFilters } from "./filters";
import type { UnifiedCommandOptions } from "./types";

/**
 * Unified command handler that intelligently routes to scan/find/map/graph behavior
 * based on flags and arguments provided.
 */
export async function runUnifiedCommand(
  options: UnifiedCommandOptions,
  _context: CommandContext
): Promise<string> {
  const { filePaths, isMapMode, isGraphMode, json, summary } = options;

  // Map mode: aggregate TLDRs and marker counts
  if (isMapMode) {
    const map = await mapFiles(filePaths);
    const mapOptions = {
      ...(options.types && { types: options.types }),
      ...(summary !== undefined && { includeSummary: summary }),
    };
    if (json) {
      return JSON.stringify(serializeMap(map, mapOptions));
    }
    printMap(map, mapOptions);
    return "";
  }

  // Graph mode: extract relation edges
  if (isGraphMode) {
    const edges = await graphRecords(filePaths);
    if (json) {
      return JSON.stringify(edges);
    }
    return edges.map((edge) => JSON.stringify(edge)).join("\n");
  }

  // Scan + filter mode (find behavior)
  const records = await scanRecords(filePaths);
  const filtered = applyFilters(records, options);

  // If JSON output requested, use renderRecords
  if (json) {
    return renderRecords(filtered, "json");
  }

  // Otherwise use the new display formatting
  return formatRecords(filtered, options);
}
