// tldr ::: lint command helpers for waymark CLI

import { readFile } from "node:fs/promises";

import {
  isValidType,
  parse,
  SIGIL,
  type WaymarkConfig,
  type WaymarkRecord,
} from "@waymarks/core";
import { PROPERTY_KEYS, PROPERTY_REGEX } from "@waymarks/grammar";

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
  records: WaymarkRecord[];
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

function stripInlineCode(text: string): string {
  let result = "";
  let inBacktick = false;
  for (const char of text) {
    if (char === "`") {
      inBacktick = !inBacktick;
      result += " ";
      continue;
    }
    result += inBacktick ? " " : char;
  }
  return result;
}

function findContinuationPropertyKey(
  line: string,
  commentLeader: string | null
): string | null {
  if (!commentLeader) {
    return null;
  }
  const trimmed = line.trimStart();
  if (!trimmed.startsWith(commentLeader)) {
    return null;
  }
  const afterLeader = trimmed.slice(commentLeader.length);
  const sigilIndex = afterLeader.indexOf(SIGIL);
  if (sigilIndex === -1) {
    return null;
  }
  const beforeSigil = afterLeader.slice(0, sigilIndex).trim();
  if (beforeSigil.length === 0 || beforeSigil.includes(" ")) {
    return null;
  }
  const key = beforeSigil.toLowerCase();
  if (!PROPERTY_KEYS.has(key)) {
    return null;
  }
  return key;
}

const duplicatePropertyRule: LintRule = {
  name: "duplicate-property",
  severity: "warn",
  checkFile: ({ filePath, records }) => {
    const issues: LintIssue[] = [];
    for (const record of records) {
      issues.push(...findDuplicatePropertyIssues(filePath, record));
    }
    return issues;
  },
};

function findDuplicatePropertyIssues(
  filePath: string,
  record: WaymarkRecord
): LintIssue[] {
  const issues: LintIssue[] = [];
  const seen = new Map<string, number>();
  const rawLines = record.raw.split("\n");

  for (let index = 0; index < rawLines.length; index += 1) {
    const line = rawLines[index] ?? "";
    const lineNumber = record.startLine + index;
    const normalizedLine = stripInlineCode(line);

    addInlinePropertyIssues({
      issues,
      seen,
      filePath,
      lineNumber,
      recordType: record.type,
      normalizedLine,
    });

    if (index > 0) {
      addContinuationPropertyIssue({
        issues,
        seen,
        filePath,
        lineNumber,
        recordType: record.type,
        line,
        commentLeader: record.commentLeader,
      });
    }
  }

  return issues;
}

type DuplicatePropertyContext = {
  issues: LintIssue[];
  seen: Map<string, number>;
  filePath: string;
  lineNumber: number;
  recordType: string;
};

type InlinePropertyContext = DuplicatePropertyContext & {
  normalizedLine: string;
};

type ContinuationPropertyContext = DuplicatePropertyContext & {
  line: string;
  commentLeader: string | null;
};

function addInlinePropertyIssues({
  issues,
  seen,
  filePath,
  lineNumber,
  recordType,
  normalizedLine,
}: InlinePropertyContext): void {
  for (const match of normalizedLine.matchAll(PROPERTY_REGEX)) {
    const keyRaw = match[1];
    if (!keyRaw) {
      continue;
    }
    recordDuplicateProperty({
      issues,
      seen,
      filePath,
      lineNumber,
      key: keyRaw.toLowerCase(),
      recordType,
    });
  }
}

function addContinuationPropertyIssue({
  issues,
  seen,
  filePath,
  lineNumber,
  recordType,
  line,
  commentLeader,
}: ContinuationPropertyContext): void {
  const continuationKey = findContinuationPropertyKey(line, commentLeader);
  if (!continuationKey) {
    return;
  }
  recordDuplicateProperty({
    issues,
    seen,
    filePath,
    lineNumber,
    key: continuationKey,
    recordType,
  });
}

type RecordDuplicatePropertyInput = {
  issues: LintIssue[];
  seen: Map<string, number>;
  filePath: string;
  lineNumber: number;
  key: string;
  recordType: string;
};

function recordDuplicateProperty({
  issues,
  seen,
  filePath,
  lineNumber,
  key,
  recordType,
}: RecordDuplicatePropertyInput): void {
  const existing = seen.get(key);
  if (existing !== undefined) {
    issues.push({
      file: filePath,
      line: lineNumber,
      rule: "duplicate-property",
      severity: "warn",
      message: `Duplicate property key "${key}" (first at line ${existing})`,
      type: recordType,
    });
    return;
  }
  seen.set(key, lineNumber);
}

const multipleTldrRule: LintRule = {
  name: "multiple-tldr",
  severity: "error",
  checkFile: ({ filePath, records }) => {
    const tldrs = records.filter(
      (record) => record.type.toLowerCase() === "tldr"
    );
    if (tldrs.length <= 1) {
      return [];
    }
    const firstLine = tldrs[0]?.startLine ?? 1;
    return tldrs.slice(1).map((record) => ({
      file: filePath,
      line: record.startLine,
      rule: "multiple-tldr",
      severity: "error",
      message: `File already has tldr at line ${firstLine}`,
      type: record.type,
    }));
  },
};

const CODETAG_PATTERNS = [
  { regex: /\/\/\s*TODO\s*:/i, leader: "//", marker: "todo" },
  { regex: /\/\/\s*FIXME\s*:/i, leader: "//", marker: "fix" },
  { regex: /\/\/\s*NOTE\s*:/i, leader: "//", marker: "note" },
  { regex: /\/\/\s*HACK\s*:/i, leader: "//", marker: "hack" },
  { regex: /\/\/\s*XXX\s*:/i, leader: "//", marker: "fix" },
  { regex: /#\s*TODO\s*:/i, leader: "#", marker: "todo" },
  { regex: /#\s*FIXME\s*:/i, leader: "#", marker: "fix" },
  { regex: /#\s*NOTE\s*:/i, leader: "#", marker: "note" },
  { regex: /--\s*TODO\s*:/i, leader: "--", marker: "todo" },
  { regex: /--\s*FIXME\s*:/i, leader: "--", marker: "fix" },
];

const legacyPatternRule: LintRule = {
  name: "legacy-pattern",
  severity: "warn",
  checkFile: ({ filePath, source }) => {
    const issues: LintIssue[] = [];
    const lines = source.split("\n");

    for (let index = 0; index < lines.length; index += 1) {
      const line = lines[index] ?? "";
      // Skip lines that already have waymark sigil - they're valid waymarks, not legacy
      if (line.includes(SIGIL)) {
        continue;
      }
      for (const pattern of CODETAG_PATTERNS) {
        if (pattern.regex.test(line)) {
          issues.push({
            file: filePath,
            line: index + 1,
            rule: "legacy-pattern",
            severity: "warn",
            message: `Legacy codetag found. Consider: "${pattern.leader} ${pattern.marker} :::"`,
          });
        }
      }
    }

    return issues;
  },
};

function buildLintRules(): LintRule[] {
  return [
    unknownMarkerRule,
    duplicatePropertyRule,
    multipleTldrRule,
    legacyPatternRule,
  ];
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
