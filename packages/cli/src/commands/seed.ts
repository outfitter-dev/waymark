// tldr ::: seed command implementation for auto-generating TLDRs from docstrings

import { readFile } from "node:fs/promises";

import {
  type BulkInsertResult,
  bulkInsert,
  findTldrInsertionPoint,
  type InsertionSpec,
} from "@waymarks/core";
import {
  detectDocstring,
  extractSummary,
  getLanguageId,
} from "@waymarks/grammar";

import type { CommandContext } from "../types.ts";
import { expandInputPaths } from "../utils/fs.ts";

/** Options for the seed command. */
export type SeedCommandOptions = {
  write: boolean;
  json: boolean;
  jsonl: boolean;
};

/** Input for building seed arguments. */
export type SeedCommandInput = {
  paths: string[];
  options: Partial<SeedCommandOptions>;
};

/** Parsed seed command arguments. */
export type ParsedSeedArgs = {
  paths: string[];
  options: SeedCommandOptions;
};

/** Summary of seed operation. */
export type SeedSummary = {
  total: number;
  inserted: number;
  skipped: number;
  wouldInsert: number;
  filesProcessed: number;
};

/** Result of processing a single file. */
export type SeedFileResult = {
  file: string;
  status: "inserted" | "skipped" | "error" | "would-insert";
  content?: string;
  line?: number;
  reason?: string;
  error?: string;
};

/** Result of the seed command. */
export type SeedCommandResult = {
  results: SeedFileResult[];
  summary: SeedSummary;
  output: string;
  exitCode: number;
};

/**

- Build seed command arguments from input.
- @param input - Raw command input with paths and options.
- @returns Parsed seed arguments.
 */
export function buildSeedArgs(input: SeedCommandInput): ParsedSeedArgs {
  const paths = input.paths.length > 0 ? input.paths : ["."];

  return {
    paths,
    options: {
      write: Boolean(input.options.write),
      json: Boolean(input.options.json),
      jsonl: Boolean(input.options.jsonl),
    },
  };
}

/**

- Execute the seed command.
- @param parsed - Parsed seed arguments.
- @param context - CLI context with config.
- @returns Results, summary, output text, and exit code.
 */
export async function runSeedCommand(
  parsed: ParsedSeedArgs,
  context: CommandContext
): Promise<SeedCommandResult> {
  const expandedPaths = await expandInputPaths(parsed.paths, context.config);
  const results: SeedFileResult[] = [];
  const insertionSpecs: InsertionSpec[] = [];

  // Process each file to detect docstrings and build insertion specs
  for (const filePath of expandedPaths) {
    const fileResult = await processFileForSeed(filePath);
    results.push(fileResult);

    if (fileResult.status === "would-insert" && fileResult.line !== undefined) {
      insertionSpecs.push({
        file: filePath,
        line: fileResult.line,
        type: "tldr",
        content: fileResult.content ?? "",
        position: "before",
      });
    }
  }

  // If write mode, apply insertions
  if (parsed.options.write && insertionSpecs.length > 0) {
    const bulkResults = await bulkInsert(insertionSpecs, {
      write: true,
      config: context.config,
    });

    updateResultsFromBulkInsert(results, bulkResults);
  }

  const summary = buildSummary(results, parsed.options.write);
  const output = formatOutput(results, summary, parsed.options);
  const exitCode = results.some((r) => r.status === "error") ? 1 : 0;

  return { results, summary, output, exitCode };
}

/**

- Process a single file to detect docstring and determine TLDR content.
 */
async function processFileForSeed(filePath: string): Promise<SeedFileResult> {
  try {
    const content = await readFile(filePath, "utf8");
    const language = getLanguageId(filePath);

    if (!language) {
      return {
        file: filePath,
        status: "skipped",
        reason: "unsupported language",
      };
    }

    // Check if TLDR already exists
    const insertionPoint = findTldrInsertionPoint(content, language);
    if (insertionPoint === -1) {
      return {
        file: filePath,
        status: "skipped",
        reason: "already has TLDR",
      };
    }

    // Detect docstring
    const docstring = detectDocstring(content, language);
    if (!docstring) {
      return {
        file: filePath,
        status: "skipped",
        reason: "no docstring",
      };
    }

    // Extract summary from docstring
    const summary = extractSummary(docstring);
    if (!summary || summary.length === 0) {
      return {
        file: filePath,
        status: "skipped",
        reason: "empty docstring summary",
      };
    }

    return {
      file: filePath,
      status: "would-insert",
      content: summary,
      line: insertionPoint,
    };
  } catch (error) {
    return {
      file: filePath,
      status: "error",
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**

- Apply bulk result status to a seed result.
 */
function applyBulkResultStatus(
  result: SeedFileResult,
  bulkResult: BulkInsertResult
): void {
  if (bulkResult.status === "success") {
    result.status = "inserted";
    if (bulkResult.inserted) {
      result.line = bulkResult.inserted.line;
      result.content = bulkResult.inserted.content;
    }
    return;
  }

  if (bulkResult.status === "error") {
    result.status = "error";
    if (bulkResult.error) {
      result.error = bulkResult.error;
    }
    return;
  }

  if (bulkResult.status === "skipped") {
    result.status = "skipped";
    result.reason = bulkResult.skipped?.reason ?? "skipped by bulk insert";
  }
}

/**

- Update results from bulk insert operation.
 */
function updateResultsFromBulkInsert(
  results: SeedFileResult[],
  bulkResults: BulkInsertResult[]
): void {
  const bulkResultMap = new Map<string, BulkInsertResult>();
  for (const br of bulkResults) {
    bulkResultMap.set(br.file, br);
  }

  for (const result of results) {
    const bulkResult = bulkResultMap.get(result.file);
    if (bulkResult) {
      applyBulkResultStatus(result, bulkResult);
    }
  }
}

/**

- Build summary from results.
 */
function buildSummary(
  results: SeedFileResult[],
  writeMode: boolean
): SeedSummary {
  const summary: SeedSummary = {
    total: results.length,
    inserted: 0,
    skipped: 0,
    wouldInsert: 0,
    filesProcessed: results.length,
  };

  for (const result of results) {
    if (result.status === "inserted") {
      summary.inserted += 1;
    } else if (result.status === "skipped") {
      summary.skipped += 1;
    } else if (result.status === "would-insert") {
      summary.wouldInsert += writeMode ? 0 : 1;
      summary.inserted += writeMode ? 1 : 0;
    }
    // "error" status doesn't count toward any category
  }

  return summary;
}

/**

- Format output based on options.
 */
function formatOutput(
  results: SeedFileResult[],
  summary: SeedSummary,
  options: SeedCommandOptions
): string {
  if (options.json) {
    return formatJsonOutput(results, summary);
  }

  if (options.jsonl) {
    return formatJsonlOutput(results, summary);
  }

  return formatTextOutput(results, summary, options.write);
}

/**

- Format as JSON.
 */
function formatJsonOutput(
  results: SeedFileResult[],
  summary: SeedSummary
): string {
  return JSON.stringify({ results, summary }, null, 2);
}

/**

- Format as JSONL.
 */
function formatJsonlOutput(
  results: SeedFileResult[],
  summary: SeedSummary
): string {
  const lines: string[] = [];
  for (const result of results) {
    lines.push(JSON.stringify(result));
  }
  lines.push(JSON.stringify({ summary }));
  return lines.join("\n");
}

/**

- Format inserted results section.
 */
function formatInsertedSection(results: SeedFileResult[]): string[] {
  const lines: string[] = [`Inserted ${results.length} TLDR(s):`];
  for (const result of results) {
    lines.push(`✓ ${result.file}:${result.line}`);
    if (result.content) {
      lines.push(`tldr ::: ${result.content}`);
    }
  }
  return lines;
}

/**

- Format would-insert results section.
 */
function formatWouldInsertSection(results: SeedFileResult[]): string[] {
  const lines: string[] = [`Would insert ${results.length} TLDR(s):`];
  for (const result of results) {
    lines.push(`○ ${result.file}:${result.line}`);
    if (result.content) {
      lines.push(`tldr ::: ${result.content}`);
    }
  }
  return lines;
}

/**

- Format skipped results section.
 */
function formatSkippedSection(results: SeedFileResult[]): string[] {
  const lines: string[] = [`\nSkipped ${results.length} file(s):`];
  for (const result of results) {
    lines.push(`- ${result.file}: ${result.reason}`);
  }
  return lines;
}

/**

- Format error results section.
 */
function formatErrorsSection(results: SeedFileResult[]): string[] {
  const lines: string[] = [`\nErrors in ${results.length} file(s):`];
  for (const result of results) {
    lines.push(`✗ ${result.file}: ${result.error}`);
  }
  return lines;
}

/**

- Format as human-readable text.
 */
function formatTextOutput(
  results: SeedFileResult[],
  summary: SeedSummary,
  writeMode: boolean
): string {
  const lines: string[] = [];

  // Group by status
  const inserted = results.filter((r) => r.status === "inserted");
  const wouldInsert = results.filter((r) => r.status === "would-insert");
  const skipped = results.filter((r) => r.status === "skipped");
  const errors = results.filter((r) => r.status === "error");

  if (writeMode && inserted.length > 0) {
    lines.push(...formatInsertedSection(inserted));
  }

  if (!writeMode && wouldInsert.length > 0) {
    lines.push(...formatWouldInsertSection(wouldInsert));
  }

  if (skipped.length > 0) {
    lines.push(...formatSkippedSection(skipped));
  }

  if (errors.length > 0) {
    lines.push(...formatErrorsSection(errors));
  }

  // Summary line
  const countLabel = writeMode
    ? `${summary.inserted} inserted`
    : `${summary.wouldInsert} would insert`;
  lines.push(`\nSummary: ${countLabel}, ${summary.skipped} skipped`);

  return lines.join("\n");
}
