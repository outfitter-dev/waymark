// tldr ::: scan command helpers for waymark CLI

import { readFile, stat } from "node:fs/promises";
import { performance } from "node:perf_hooks";

import {
  canHaveWaymarks,
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

type CodetagPattern = {
  regex: RegExp;
  leader: string;
  marker: string;
};

const INDENT_MATCH_PATTERN = /^\s*/;

const CODETAG_PATTERNS: CodetagPattern[] = [
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

function buildCodetagRecord(args: {
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
  parsed.codetag = true;
  return parsed;
}

function scanCodetags(source: string, filePath: string): WaymarkRecord[] {
  const records: WaymarkRecord[] = [];
  const lines = source.split("\n");

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index] ?? "";
    for (const pattern of CODETAG_PATTERNS) {
      const match = line.match(pattern.regex);
      if (!match) {
        continue;
      }
      const content = match[1] ?? "";
      const record = buildCodetagRecord({
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

/**
 * Scan file paths for waymark records.
 * @param filePaths - Paths or globs to scan.
 * @param config - Resolved waymark configuration.
 * @param options - Runtime scan options (cache, cachePath, metrics).
 * @returns Parsed waymark records.
 */
// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: sequential file processing with necessary branching
export async function scanRecords(
  filePaths: string[],
  config: WaymarkConfig,
  options: ScanRuntimeOptions = {}
): Promise<WaymarkRecord[]> {
  const files = await expandInputPaths(filePaths, config);
  const records: WaymarkRecord[] = [];
  const cache = createCache(options);
  const cacheEnabled = cache !== undefined;
  const startTime = performance.now();
  let parsedFiles = 0;
  let cachedFiles = 0;
  let skippedFiles = 0;

  try {
    for (const filePath of files) {
      // Skip files that cannot have waymarks (e.g., .json, binary files)
      // Check capability BEFORE cache lookup so config changes are honored
      if (!canHaveWaymarks(filePath, config)) {
        skippedFiles += 1;
        continue;
      }

      const fileStats = cacheEnabled
        ? await stat(filePath).catch(() => null)
        : null;
      if (cache && fileStats) {
        const staleResult = cache.isFileStale(
          filePath,
          fileStats.mtimeMs,
          fileStats.size
        );
        if (staleResult.isOk() && !staleResult.value) {
          const cachedRecords = cache.findByFile(filePath);
          if (cachedRecords.isOk()) {
            records.push(...cachedRecords.value);
            cachedFiles += 1;
            continue;
          }
        }
      }

      const source = await readFile(filePath, "utf8").catch(() => null);
      if (typeof source !== "string") {
        skippedFiles += 1;
        continue;
      }

      const parsed = parse(source, {
        file: filePath,
        includeIgnored: config.scan?.includeIgnored,
      });
      if (config.scan?.includeCodetags) {
        parsed.push(...scanCodetags(source, filePath));
      }
      records.push(...parsed);
      parsedFiles += 1;

      if (cache && fileStats) {
        // Best-effort cache update; ignore errors
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
  const result = options.cachePath
    ? WaymarkCache.open({ dbPath: options.cachePath })
    : WaymarkCache.open();
  if (result.isErr()) {
    logger.warn(
      { error: result.error.message },
      "Failed to open cache, proceeding without caching"
    );
    return;
  }
  return result.value;
}

/**
 * Parse CLI arguments for the scan command.
 * @param argv - Raw CLI arguments.
 * @returns Parsed scan arguments.
 */
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
    "--pretty": "text", // Pretty-printed JSON output
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
