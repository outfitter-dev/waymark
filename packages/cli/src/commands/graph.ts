// tldr ::: graph command helpers for waymark CLI

import {
  buildRelationGraph,
  type WaymarkConfig,
  type WaymarkRecord,
} from "@waymarks/core";

import { type ScanRuntimeOptions, scanRecords } from "./scan";

export type ParsedGraphArgs = {
  filePaths: string[];
  json: boolean;
};

/**
 * Scan records and build relation graph edges.
 * @param filePaths - Paths or globs to scan.
 * @param config - Resolved waymark configuration.
 * @param scanOptions - Optional scan runtime options.
 * @returns Relation graph edges.
 */
export async function graphRecords(
  filePaths: string[],
  config: WaymarkConfig,
  scanOptions?: ScanRuntimeOptions
) {
  const scanResult = await scanRecords(filePaths, config, scanOptions);
  if (scanResult.isErr()) {
    throw scanResult.error;
  }
  const records: WaymarkRecord[] = scanResult.value;
  return buildRelationGraph(records).edges;
}

/**
 * Parse CLI arguments for the graph command.
 * @param argv - Raw CLI arguments.
 * @returns Parsed graph arguments.
 */
export function parseGraphArgs(argv: string[]): ParsedGraphArgs {
  const json = argv.includes("--json");
  const filePaths = argv.filter((arg) => !arg.startsWith("-"));
  return {
    filePaths: filePaths.length > 0 ? filePaths : [process.cwd()],
    json,
  };
}
