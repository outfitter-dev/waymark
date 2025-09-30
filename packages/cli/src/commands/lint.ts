// tldr ::: lint command helpers for waymark CLI

import { readFile } from "node:fs/promises";

import { isValidType, parse } from "@waymarks/core";

import { expandInputPaths } from "../utils/fs";

export type LintCommandOptions = {
  filePaths: string[];
  json: boolean;
};

export type LintIssue = {
  file: string;
  line: number;
  type: string;
};

export type LintReport = {
  issues: LintIssue[];
};

export function parseLintArgs(argv: string[]): LintCommandOptions {
  const json = argv.includes("--json");
  const filePaths = argv.filter((arg) => !arg.startsWith("-"));
  if (filePaths.length === 0) {
    throw new Error("lint requires at least one file path");
  }
  return { filePaths, json };
}

export async function lintFiles(
  filePaths: string[],
  allowTypes: string[]
): Promise<LintReport> {
  const issues: LintIssue[] = [];
  const allowList = new Set(allowTypes.map((marker) => marker.toLowerCase()));

  const files = await expandInputPaths(filePaths);
  for (const path of files) {
    const source = await readFile(path, "utf8").catch(() => null);
    if (typeof source !== "string") {
      continue;
    }
    const records = parse(source, { file: path });
    for (const record of records) {
      const type = record.type.toLowerCase();
      if (isValidType(type) || allowList.has(type)) {
        continue;
      }
      issues.push({
        file: path,
        line: record.startLine,
        type: record.type,
      });
    }
  }

  return { issues };
}
