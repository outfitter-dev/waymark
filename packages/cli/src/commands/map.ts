// tldr ::: map command helpers for waymark CLI

import { buildWaymarkMap, type WaymarkMap } from "@waymarks/core";

import { scanRecords } from "./scan";

export type ParsedMapArgs = {
  filePaths: string[];
  json: boolean;
};

export async function mapFiles(filePaths: string[]): Promise<WaymarkMap> {
  const records = await scanRecords(filePaths);
  return buildWaymarkMap(records);
}

export function parseMapArgs(argv: string[]): ParsedMapArgs {
  const json = argv.includes("--json");
  const filePaths = argv.filter((arg) => !arg.startsWith("-"));
  return {
    filePaths: filePaths.length > 0 ? filePaths : [process.cwd()],
    json,
  };
}
