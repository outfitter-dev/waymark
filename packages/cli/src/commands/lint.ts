// tldr ::: lint command helpers for waymark CLI

import { readFile } from "node:fs/promises";

import { isValidType, parse, type WaymarkConfig } from "@waymarks/core";

import { expandInputPaths } from "../utils/fs";

export type LintCommandOptions = {
  filePaths: string[];
  json: boolean;
};

export type LintSeverity = "warn" | "error";

export type LintIssue = {
  file: string;
  line: number;
  rule: string;
  severity: LintSeverity;
  message: string;
  type?: string;
};

export type LintReport = {
  issues: LintIssue[];
};

type LintRuleContext = {
  filePath: string;
  source: string;
  records: ReturnType<typeof parse>;
  allowList: Set<string>;
  config: WaymarkConfig;
};

type LintRule = {
  name: string;
  severity: LintSeverity;
  checkFile: (context: LintRuleContext) => LintIssue[];
};

const unknownMarkerRule: LintRule = {
  name: "unknown-marker",
  severity: "warn",
  checkFile: ({ filePath, records, allowList }) => {
    const issues: LintIssue[] = [];
    for (const record of records) {
      const type = record.type.toLowerCase();
      if (isValidType(type) || allowList.has(type)) {
        continue;
      }
      issues.push({
        file: filePath,
        line: record.startLine,
        rule: "unknown-marker",
        severity: "warn",
        message: `Unknown marker "${record.type}"`,
        type: record.type,
      });
    }
    return issues;
  },
};

function buildLintRules(): LintRule[] {
  return [unknownMarkerRule];
}

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
  allowTypes: string[],
  config: WaymarkConfig
): Promise<LintReport> {
  const issues: LintIssue[] = [];
  const allowList = new Set(allowTypes.map((marker) => marker.toLowerCase()));
  const rules = buildLintRules();

  const files = await expandInputPaths(filePaths, config);
  for (const path of files) {
    const source = await readFile(path, "utf8").catch(() => null);
    if (typeof source !== "string") {
      continue;
    }
    const records = parse(source, { file: path });
    const context: LintRuleContext = {
      filePath: path,
      source,
      records,
      allowList,
      config,
    };
    for (const rule of rules) {
      issues.push(...rule.checkFile(context));
    }
  }

  return { issues };
}
