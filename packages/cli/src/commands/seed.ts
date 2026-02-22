// tldr ::: seed command for discovering TLDR candidates from docstrings and codetags

import { readFile } from "node:fs/promises";

import { findTldrInsertionPoint } from "@waymarks/core";
import {
  detectDocstring,
  extractSummary,
  getLanguageId,
} from "@waymarks/grammar";

import type { CommandContext } from "../types.ts";
import { expandInputPaths } from "../utils/fs.ts";

/** Options for the seed command. */
export type SeedCommandOptions = {
  docstrings: boolean;
  codetags: boolean;
  all: boolean;
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

/** Type of candidate source. */
export type CandidateSource = "docstring" | "codetag";

/** A TLDR candidate discovered in a file. */
export type SeedCandidate = {
  file: string;
  source: CandidateSource;
  line: number;
  content: string;
  insertionPoint: number;
};

/** Result of processing a single file. */
export type SeedFileResult = {
  file: string;
  status: "candidate" | "skipped" | "error";
  candidate?: SeedCandidate;
  reason?: string;
  error?: string;
};

/** Summary of seed operation. */
export type SeedSummary = {
  total: number;
  candidates: number;
  skipped: number;
  errors: number;
  bySource: {
    docstrings: number;
    codetags: number;
  };
};

/** Result of the seed command. */
export type SeedCommandResult = {
  results: SeedFileResult[];
  summary: SeedSummary;
  output: string;
  exitCode: number;
};

// Codetag patterns to detect
const CODETAG_PATTERNS = [
  { pattern: /^\s*(?:\/\/|#|--|%)\s*TODO\s*[:-]?\s*(.+)/im, tag: "TODO" },
  { pattern: /^\s*(?:\/\/|#|--|%)\s*FIXME\s*[:-]?\s*(.+)/im, tag: "FIXME" },
  { pattern: /^\s*(?:\/\/|#|--|%)\s*NOTE\s*[:-]?\s*(.+)/im, tag: "NOTE" },
  { pattern: /^\s*(?:\/\/|#|--|%)\s*HACK\s*[:-]?\s*(.+)/im, tag: "HACK" },
];

/** Maximum lines to search for codetags (file-level context). */
const CODETAG_SEARCH_LIMIT = 50;

/**
 * Build seed command arguments from input.
 * @param input - Raw command input with paths and options.
 * @returns Parsed seed arguments.
 */
export function buildSeedArgs(input: SeedCommandInput): ParsedSeedArgs {
  const paths = input.paths.length > 0 ? input.paths : ["."];
  const all = Boolean(input.options.all);

  return {
    paths,
    options: {
      // If --all, enable both; otherwise use explicit flags (default to docstrings if none specified)
      docstrings:
        all || Boolean(input.options.docstrings) || !input.options.codetags,
      codetags: all || Boolean(input.options.codetags),
      all,
      json: Boolean(input.options.json),
      jsonl: Boolean(input.options.jsonl),
    },
  };
}

/**
 * Execute the seed command (discovery mode).
 * @param parsed - Parsed seed arguments.
 * @param context - CLI context with config.
 * @returns Results, summary, output text, and exit code.
 */
export async function runSeedCommand(
  parsed: ParsedSeedArgs,
  context: CommandContext
): Promise<SeedCommandResult> {
  const expandedPaths = await expandInputPaths(parsed.paths, context.config);
  const results: SeedFileResult[] = [];

  // Process each file to find TLDR candidates
  for (const filePath of expandedPaths) {
    const fileResult = await processFileForCandidates(filePath, parsed.options);
    results.push(fileResult);
  }

  const summary = buildSummary(results);
  const output = formatOutput(results, summary, parsed.options);
  const exitCode = results.some((r) => r.status === "error") ? 1 : 0;

  return { results, summary, output, exitCode };
}

/**
 * Process a single file to find TLDR candidates.
 */
async function processFileForCandidates(
  filePath: string,
  options: SeedCommandOptions
): Promise<SeedFileResult> {
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

    // Try docstrings first if enabled
    if (options.docstrings) {
      const docstringCandidate = findDocstringCandidate(
        filePath,
        content,
        language,
        insertionPoint
      );
      if (docstringCandidate) {
        return docstringCandidate;
      }
    }

    // Try codetags if enabled
    if (options.codetags) {
      const codetagCandidate = findCodetagCandidate(
        filePath,
        content,
        insertionPoint
      );
      if (codetagCandidate) {
        return codetagCandidate;
      }
    }

    // No candidates found
    const reasons: string[] = [];
    if (options.docstrings) {
      reasons.push("no file-level docstring");
    }
    if (options.codetags) {
      reasons.push("no codetags");
    }

    return {
      file: filePath,
      status: "skipped",
      reason: reasons.join(", "),
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
 * Find a docstring candidate in the file.
 */
function findDocstringCandidate(
  filePath: string,
  content: string,
  language: string,
  insertionPoint: number
): SeedFileResult | null {
  const docstring = detectDocstring(content, language);
  if (!docstring) {
    return null;
  }

  // Only use file-level docstrings for TLDRs
  if (docstring.kind !== "file") {
    return null;
  }

  const summary = extractSummary(docstring);
  if (!summary || summary.length === 0) {
    return null;
  }

  return {
    file: filePath,
    status: "candidate",
    candidate: {
      file: filePath,
      source: "docstring",
      line: docstring.startLine,
      content: summary,
      insertionPoint,
    },
  };
}

/**
 * Find a codetag candidate in the file.
 */
function findCodetagCandidate(
  filePath: string,
  content: string,
  insertionPoint: number
): SeedFileResult | null {
  const lines = content.split("\n");

  const searchLimit = Math.min(CODETAG_SEARCH_LIMIT, lines.length);

  for (let i = 0; i < searchLimit; i++) {
    const line = lines[i];
    if (!line) {
      continue;
    }

    for (const { pattern, tag } of CODETAG_PATTERNS) {
      const match = line.match(pattern);
      if (match?.[1]) {
        return {
          file: filePath,
          status: "candidate",
          candidate: {
            file: filePath,
            source: "codetag",
            line: i + 1,
            content: `${tag}: ${match[1].trim()}`,
            insertionPoint,
          },
        };
      }
    }
  }

  return null;
}

/**
 * Build summary from results.
 */
function buildSummary(results: SeedFileResult[]): SeedSummary {
  const summary: SeedSummary = {
    total: results.length,
    candidates: 0,
    skipped: 0,
    errors: 0,
    bySource: {
      docstrings: 0,
      codetags: 0,
    },
  };

  for (const result of results) {
    if (result.status === "candidate" && result.candidate) {
      summary.candidates += 1;
      if (result.candidate.source === "docstring") {
        summary.bySource.docstrings += 1;
      } else {
        summary.bySource.codetags += 1;
      }
    } else if (result.status === "skipped") {
      summary.skipped += 1;
    } else if (result.status === "error") {
      summary.errors += 1;
    }
  }

  return summary;
}

/**
 * Format output based on options.
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

  return formatTextOutput(results, summary);
}

/**
 * Format as JSON.
 */
function formatJsonOutput(
  results: SeedFileResult[],
  summary: SeedSummary
): string {
  const candidates = results
    .filter((r) => r.status === "candidate" && r.candidate)
    .map((r) => r.candidate);
  return JSON.stringify({ candidates, summary }, null, 2);
}

/**
 * Format as JSONL.
 */
function formatJsonlOutput(
  results: SeedFileResult[],
  summary: SeedSummary
): string {
  const lines: string[] = [];
  for (const result of results) {
    if (result.status === "candidate" && result.candidate) {
      lines.push(JSON.stringify(result.candidate));
    }
  }
  lines.push(JSON.stringify({ summary }));
  return lines.join("\n");
}

/**
 * Format as human-readable text.
 */
function formatTextOutput(
  results: SeedFileResult[],
  summary: SeedSummary
): string {
  const lines: string[] = [];
  const candidates = results.filter(
    (r) => r.status === "candidate" && r.candidate
  );

  if (candidates.length === 0) {
    lines.push("No TLDR candidates found.");
    lines.push("");
    lines.push(`Scanned ${summary.total} file(s), ${summary.skipped} skipped.`);
    return lines.join("\n");
  }

  lines.push(`Found ${candidates.length} TLDR candidate(s):\n`);

  for (const result of candidates) {
    const candidate = result.candidate;
    if (!candidate) {
      continue;
    }

    lines.push(`${candidate.file} (${candidate.source})`);
    lines.push(`  line ${candidate.line}: "${candidate.content}"`);
    lines.push(`  insertion point: line ${candidate.insertionPoint}`);
    lines.push("");
  }

  // Summary
  lines.push("---");
  lines.push(
    `Summary: ${summary.candidates} candidates, ${summary.skipped} skipped`
  );
  if (summary.bySource.docstrings > 0 || summary.bySource.codetags > 0) {
    const parts: string[] = [];
    if (summary.bySource.docstrings > 0) {
      parts.push(`${summary.bySource.docstrings} from docstrings`);
    }
    if (summary.bySource.codetags > 0) {
      parts.push(`${summary.bySource.codetags} from codetags`);
    }
    lines.push(`  (${parts.join(", ")})`);
  }

  return lines.join("\n");
}
