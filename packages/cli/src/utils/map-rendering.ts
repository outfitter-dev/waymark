// tldr ::: map formatting and rendering utilities for waymark CLI

import {
  type FileSummary,
  type MarkerSummary,
  summarizeMarkerTotals,
  type WaymarkMap,
} from "@waymarks/core";
import { MARKERS } from "@waymarks/grammar";
import chalk from "chalk";

export type MapRenderOptions = {
  types?: string[];
  includeSummary?: boolean;
};

export type MapSerializeOptions = MapRenderOptions;

const STDOUT = process.stdout;

/**
 * Print a formatted representation of the provided map to stdout.
 */
export function printMap(
  map: WaymarkMap,
  options: MapRenderOptions = {}
): void {
  writeStdout(formatMapOutput(map, options));
}

/**
 * Format a waymark map for human-friendly CLI output.
 */
export function formatMapOutput(
  map: WaymarkMap,
  options: MapRenderOptions = {}
): string {
  const typeFilter = toTypeFilter(options.types);
  const fileLines = buildFileBlocks(map, typeFilter);
  const outputLines = fileLines.flat();

  if (options.includeSummary) {
    const summaryLines = buildSummaryLines(map, typeFilter);
    if (summaryLines.length > 0) {
      if (outputLines.length > 0 && outputLines.at(-1) !== "") {
        outputLines.push("");
      }
      outputLines.push(...summaryLines);
    }
  }

  if (outputLines.length === 0) {
    outputLines.push(
      typeFilter && typeFilter.size > 0
        ? "No matching waymarks."
        : "No waymarks found."
    );
  }

  return outputLines.join("\n");
}

/**
 * Serialize a waymark map into JSON-friendly data for CLI output.
 */
export function serializeMap(
  map: WaymarkMap,
  options: MapSerializeOptions = {}
): Record<string, unknown> {
  const typeFilter = toTypeFilter(options.types);
  const result: Record<string, unknown> = {};

  const entries = Array.from(map.files.entries()).sort((a, b) =>
    a[0].localeCompare(b[0])
  );

  for (const [file, summary] of entries) {
    const includeTldr = shouldIncludeTldr(summary, typeFilter);
    const markerCounts = collectMarkerCounts(summary, typeFilter);

    if (!includeTldr && markerCounts.length === 0 && typeFilter) {
      continue;
    }

    result[file] = {
      ...(includeTldr ? { tldr: summary.tldr?.contentText } : {}),
      types: Object.fromEntries(
        markerCounts.map(({ type, count }) => [type, count])
      ),
    };
  }

  if (options.includeSummary) {
    const totals = summarizeMarkerTotals(map).filter(
      ({ type }) => !typeFilter || typeFilter.has(type)
    );

    result._summary = {
      types: Object.fromEntries(totals.map(({ type, count }) => [type, count])),
    };
  }

  return result;
}

/**
 * Normalize a type filter into a Set when requested.
 */
export function toTypeFilter(types?: string[]): Set<string> | undefined {
  if (!types || types.length === 0) {
    return;
  }
  return new Set(types.map((type) => type.toLowerCase()));
}

type TreeNode = {
  name: string;
  type: "file" | "directory";
  summary?: FileSummary;
  children: Map<string, TreeNode>;
};

/**
 * Build the set of formatted lines for each file in the map.
 */
export function buildFileBlocks(
  map: WaymarkMap,
  typeFilter?: Set<string>
): string[][] {
  const summaries = Array.from(map.files.values()).sort((a, b) =>
    a.file.localeCompare(b.file)
  );

  // Filter summaries first
  const filtered = summaries.filter((summary) => {
    const includeTldr = shouldIncludeTldr(summary, typeFilter);
    return !typeFilter || includeTldr;
  });

  // Build directory tree
  const root: TreeNode = { name: "", type: "directory", children: new Map() };

  for (const summary of filtered) {
    const parts = summary.file.split("/");
    let current = root;

    // Build directory structure
    for (let i = 0; i < parts.length - 1; i++) {
      const part = parts[i];
      if (!part) {
        continue;
      }
      if (!current.children.has(part)) {
        current.children.set(part, {
          name: part,
          type: "directory",
          children: new Map(),
        });
      }
      const next = current.children.get(part);
      if (!next) {
        continue;
      }
      current = next;
    }

    // Add file
    const fileName = parts.at(-1);
    if (!fileName) {
      continue;
    }
    current.children.set(fileName, {
      name: fileName,
      type: "file",
      summary,
      children: new Map(),
    });
  }

  // Render tree
  const result: string[][] = [];
  renderTree({ node: root, prefix: "", result, typeFilter });
  return result;
}

type RenderOptions = {
  node: TreeNode;
  prefix: string;
  result: string[][];
  typeFilter?: Set<string> | undefined;
};

function renderTree(options: RenderOptions): void {
  const { node, prefix, result, typeFilter } = options;
  const entries = Array.from(node.children.entries()).sort((a, b) => {
    // Directories first, then files
    if (a[1].type !== b[1].type) {
      return a[1].type === "directory" ? -1 : 1;
    }
    return a[0].localeCompare(b[0]);
  });

  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];
    if (!entry) {
      continue;
    }
    const [name, child] = entry;
    const isLast = i === entries.length - 1;
    const connector = isLast ? "└─" : "├─";
    const childPrefix = isLast ? "   " : "│  ";

    if (child.type === "directory") {
      // Directory header
      result.push([`${prefix}${connector} ${name}/`]);
      // Recurse into directory
      renderTree({
        node: child,
        prefix: prefix + childPrefix,
        result,
        typeFilter,
      });
    } else if (child.summary) {
      // File with TLDR
      const lines = buildFileLines(
        child.summary,
        prefix + connector,
        prefix + childPrefix,
        typeFilter
      );
      if (lines.length > 0) {
        result.push(lines);
      }
    }
  }
}

/**
 * Format a single file summary into printable lines.
 */
export function buildFileLines(
  summary: FileSummary,
  linePrefix: string,
  tldrPrefix: string,
  typeFilter?: Set<string>
): string[] {
  const lines: string[] = [];
  const fileName = summary.file.split("/").pop() || summary.file;

  // File path in blue with tree drawing prefix
  const includeTldr = shouldIncludeTldr(summary, typeFilter);
  const fileDisplay = includeTldr && summary.tldr
    ? `${fileName}:${summary.tldr.startLine}`
    : fileName;
  const filePath = chalk.blue(fileDisplay);
  lines.push(`${linePrefix} ${filePath}`);

  // TLDR directly under file path with tree line
  if (includeTldr && summary.tldr) {
    lines.push(`${tldrPrefix}${summary.tldr.contentText}`);
  }

  return lines;
}

/**
 * Collect marker counts for a file summary, honouring any filter provided.
 */
export function collectMarkerCounts(
  summary: FileSummary,
  typeFilter?: Set<string>
): Array<{ type: string; count: number }> {
  const entries: [string, MarkerSummary][] = Array.from(
    summary.types.entries()
  );
  const filtered = typeFilter
    ? entries.filter(([type]) => typeFilter.has(type))
    : entries;
  return filtered
    .map(([type, details]) => ({ type, count: details.entries.length }))
    .sort((a, b) => a.type.localeCompare(b.type));
}

/**
 * Decide whether a TLDR should be included for a given file summary.
 */
export function shouldIncludeTldr(
  summary: FileSummary,
  typeFilter?: Set<string>
): boolean {
  if (!summary.tldr) {
    return false;
  }
  if (typeFilter && !typeFilter.has(MARKERS.tldr)) {
    return false;
  }
  return summary.tldr.contentText.trim().length > 0;
}

/**
 * Build the global summary footer lines for the provided map.
 */
export function buildSummaryLines(
  map: WaymarkMap,
  typeFilter?: Set<string>
): string[] {
  const totals = summarizeMarkerTotals(map).filter(
    ({ type }) => !typeFilter || typeFilter.has(type)
  );
  if (totals.length === 0) {
    return [];
  }
  const lines = ["Summary:"];
  for (const { type, count } of totals) {
    lines.push(`  ${type}: ${count}`);
  }
  return lines;
}

function writeStdout(message: string): void {
  STDOUT.write(`${message}\n`);
}
