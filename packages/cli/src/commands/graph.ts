// tldr ::: graph command helpers for waymark CLI

import {
  buildRelationGraph,
  type WaymarkConfig,
  type WaymarkRecord,
} from "@waymarks/core";

import { scanRecords } from "./scan";

export type ParsedGraphArgs = {
  filePaths: string[];
  json: boolean;
};

export async function graphRecords(filePaths: string[], config: WaymarkConfig) {
  const records: WaymarkRecord[] = await scanRecords(filePaths, config);
  return buildRelationGraph(records).edges;
}

export function parseGraphArgs(argv: string[]): ParsedGraphArgs {
  const json = argv.includes("--json");
  const filePaths = argv.filter((arg) => !arg.startsWith("-"));
  return {
    filePaths: filePaths.length > 0 ? filePaths : [process.cwd()],
    json,
  };
}
