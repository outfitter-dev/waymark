// tldr ::: scan command helpers for waymark CLI

import { readFile } from "node:fs/promises";

import { parse, type WaymarkConfig, type WaymarkRecord } from "@waymarks/core";

import { expandInputPaths } from "../utils/fs";
import type { ScanOutputFormat } from "../utils/output";

export type ParsedScanArgs = {
  filePaths: string[];
  format?: ScanOutputFormat;
};

export async function scanRecords(
  filePaths: string[],
  config: WaymarkConfig
): Promise<WaymarkRecord[]> {
  const files = await expandInputPaths(filePaths, config);
  const records: WaymarkRecord[] = [];

  for (const filePath of files) {
    const source = await readFile(filePath, "utf8").catch(() => null);
    if (typeof source !== "string") {
      continue;
    }
    records.push(...parse(source, { file: filePath }));
  }

  return records;
}

export function parseScanArgs(argv: string[]): ParsedScanArgs {
  if (argv.length === 0) {
    throw new Error("scan requires a file path");
  }

  let format: ScanOutputFormat = "text";
  let formatSet = false;
  const positional: string[] = [];

  const formatFlags: Record<string, ScanOutputFormat> = {
    "--json": "json",
    "--jsonl": "jsonl",
    "--text": "text",
    "--pretty": "text", // Deprecated alias for --text
  };

  for (const arg of argv) {
    if (arg.startsWith("--")) {
      const nextFormat = formatFlags[arg];
      if (!nextFormat) {
        throw new Error(`Unknown flag for scan: ${arg}`);
      }
      if (formatSet) {
        throw new Error("scan accepts only one format flag");
      }
      format = nextFormat;
      formatSet = true;
      continue;
    }
    positional.push(arg);
  }

  if (positional.length === 0) {
    throw new Error("scan requires a file path");
  }

  return { filePaths: positional, format };
}
