// tldr ::: scan command helpers for waymark CLI

import { readFile, stat } from "node:fs/promises";
import { performance } from "node:perf_hooks";

import {
  parse,
  WaymarkCache,
  type WaymarkConfig,
  type WaymarkRecord,
} from "@waymarks/core";

import { expandInputPaths } from "../utils/fs";
import { logger } from "../utils/logger";
import type { ScanOutputFormat } from "../utils/output";

export type ParsedScanArgs = {
  filePaths: string[];
  format?: ScanOutputFormat;
};

export type ScanMetrics = {
  totalFiles: number;
  parsedFiles: number;
  cachedFiles: number;
  skippedFiles: number;
  durationMs: number;
};

export type ScanRuntimeOptions = {
  cache?: boolean;
  cachePath?: string;
  metrics?: ScanMetrics;
};

type LegacyPattern = {
  regex: RegExp;
  leader: string;
  marker: string;
};

const INDENT_MATCH_PATTERN = /^\s*/;

const LEGACY_CODETAG_PATTERNS: LegacyPattern[] = [
  { regex: /^\s*\/\/\s*TODO\s*:\s*(.*)$/i, leader: "//", marker: "todo" },
  { regex: /^\s*\/\/\s*FIXME\s*:\s*(.*)$/i, leader: "//", marker: "fix" },
  { regex: /^\s*\/\/\s*NOTE\s*:\s*(.*)$/i, leader: "//", marker: "note" },
  { regex: /^\s*\/\/\s*HACK\s*:\s*(.*)$/i, leader: "//", marker: "hack" },
  { regex: /^\s*\/\/\s*XXX\s*:\s*(.*)$/i, leader: "//", marker: "fix" },
  { regex: /^\s*#\s*TODO\s*:\s*(.*)$/i, leader: "#", marker: "todo" },
  { regex: /^\s*#\s*FIXME\s*:\s*(.*)$/i, leader: "#", marker: "fix" },
  { regex: /^\s*#\s*NOTE\s*:\s*(.*)$/i, leader: "#", marker: "note" },
  { regex: /^\s*--\s*TODO\s*:\s*(.*)$/i, leader: "--", marker: "todo" },
  { regex: /^\s*--\s*FIXME\s*:\s*(.*)$/i, leader: "--", marker: "fix" },
];

function buildLegacyRecord(args: {
  filePath: string;
  line: string;
  lineNumber: number;
  leader: string;
  marker: string;
  content: string;
}): WaymarkRecord | null {
  const { filePath, line, lineNumber, leader, marker, content } = args;
  const indentMatch = line.match(INDENT_MATCH_PATTERN);
  const indent = indentMatch ? (indentMatch[0] ?? "") : "";
  const synthetic = `${indent}${leader} ${marker} ::: ${content}`.trimEnd();
  const parsed = parse(synthetic, { file: filePath })[0];
  if (!parsed) {
    return null;
  }
  parsed.startLine = lineNumber;
  parsed.endLine = lineNumber;
  parsed.raw = line;
  parsed.contentText = content.trim();
  parsed.legacy = true;
  return parsed;
}

function scanLegacyCodetags(source: string, filePath: string): WaymarkRecord[] {
  const records: WaymarkRecord[] = [];
  const lines = source.split("\n");

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index] ?? "";
    for (const pattern of LEGACY_CODETAG_PATTERNS) {
      const match = line.match(pattern.regex);
      if (!match) {
        continue;
      }
      const content = match[1] ?? "";
      const record = buildLegacyRecord({
        filePath,
        line,
        lineNumber: index + 1,
        leader: pattern.leader,
        marker: pattern.marker,
        content,
      });
      if (record) {
        records.push(record);
      }
    }
  }

  return records;
}

export async function scanRecords(
  filePaths: string[],
  config: WaymarkConfig,
  options: ScanRuntimeOptions = {}
): Promise<WaymarkRecord[]> {
  const files = await expandInputPaths(filePaths, config);
  const records: WaymarkRecord[] = [];
  const cache = createCache(options);
  const cacheEnabled = Boolean(cache);
  const startTime = performance.now();
  let parsedFiles = 0;
  let cachedFiles = 0;
  let skippedFiles = 0;

  try {
    for (const filePath of files) {
      const fileStats = cacheEnabled
        ? await stat(filePath).catch(() => null)
        : null;
      if (
        cacheEnabled &&
        fileStats &&
        !cache?.isFileStale(filePath, fileStats.mtimeMs, fileStats.size)
      ) {
        records.push(...cache.findByFile(filePath));
        cachedFiles += 1;
        continue;
      }

      const source = await readFile(filePath, "utf8").catch(() => null);
      if (typeof source !== "string") {
        skippedFiles += 1;
        continue;
      }

      const parsed = parse(source, { file: filePath });
      if (config.scan?.includeCodetags) {
        parsed.push(...scanLegacyCodetags(source, filePath));
      }
      records.push(...parsed);
      parsedFiles += 1;

      if (cacheEnabled && fileStats) {
        cache.replaceFileWaymarks({
          filePath,
          mtime: fileStats.mtimeMs,
          size: fileStats.size,
          records: parsed,
        });
      }
    }
  } finally {
    cache?.close();
  }

  const durationMs = Math.round(performance.now() - startTime);
  const metrics: ScanMetrics = {
    totalFiles: files.length,
    parsedFiles,
    cachedFiles,
    skippedFiles,
    durationMs,
  };
  if (options.metrics) {
    Object.assign(options.metrics, metrics);
  }
  logger.debug({ cache: cacheEnabled, ...metrics }, "scan completed");

  return records;
}

function createCache(options: ScanRuntimeOptions): WaymarkCache | undefined {
  if (!options.cache) {
    return;
  }
  if (options.cachePath) {
    return new WaymarkCache({ dbPath: options.cachePath });
  }
  return new WaymarkCache();
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
    "--pretty": "text", // Pretty-printed JSON (deprecated - use --json with jq for formatting)
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
