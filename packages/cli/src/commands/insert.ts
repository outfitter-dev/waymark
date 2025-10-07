// tldr ::: insert command implementation for wm CLI

import { readFile } from "node:fs/promises";

import {
  type InsertionResult,
  type InsertionSpec,
  InsertionSpecSchema,
  insertWaymarks,
} from "@waymarks/core";
import { ZodError, z } from "zod";

import type { CommandContext } from "../types.ts";
import { createIdManager } from "../utils/id-manager.ts";
import { logger } from "../utils/logger.ts";
import { readFromStdin } from "../utils/stdin.ts";

export type InsertSummary = {
  total: number;
  successful: number;
  failed: number;
  filesModified: number;
};

export type InsertCommandOptions = {
  write: boolean;
  json: boolean;
  jsonl: boolean;
  from?: string;
};

export type ParsedInsertArgs = {
  specs: InsertionSpec[];
  options: InsertCommandOptions;
};

export function parseInsertArgs(argv: string[]): ParsedInsertArgs {
  const state: InsertParseState = {
    optionState: {
      write: false,
      json: false,
      jsonl: false,
    },
    tags: [],
    mentions: [],
    continuations: [],
    properties: {},
    signals: { raised: false, important: false },
  };

  let cursor = 0;
  while (cursor < argv.length) {
    const token = argv[cursor];
    if (token === undefined) {
      break;
    }
    cursor += 1;

    if (!token.startsWith("--")) {
      handlePositionalToken(token, state);
      continue;
    }

    const valueHandler = VALUE_FLAG_HANDLERS[token];
    if (valueHandler) {
      const [value, nextCursor] = readNextValue(argv, cursor, token);
      cursor = nextCursor;
      valueHandler(state, value);
      continue;
    }

    const flagHandler = SIMPLE_FLAG_HANDLERS[token];
    if (flagHandler) {
      flagHandler(state);
      continue;
    }

    throw new Error(`Unknown flag: ${token}`);
  }

  const options = buildInsertOptions(state);
  if (state.from !== undefined) {
    validateFromMode(state);
    return { specs: [], options };
  }

  const spec = buildInsertionSpec(state);
  return { specs: [spec], options };
}

type InsertParseState = {
  optionState: Omit<InsertCommandOptions, "from">;
  tags: string[];
  mentions: string[];
  continuations: string[];
  properties: Record<string, string>;
  signals: { raised: boolean; important: boolean };
  fileLine?: string;
  type?: string;
  content?: string;
  position?: "before" | "after";
  order?: number;
  id?: string;
  from?: string;
};

const VALUE_FLAG_HANDLERS: Record<
  string,
  (state: InsertParseState, value: string) => void
> = {
  "--from": (state, value) => {
    state.from = value;
  },
  "--type": (state, value) => {
    state.type = value;
  },
  "--content": (state, value) => {
    state.content = value;
  },
  "--position": (state, value) => {
    if (value !== "before" && value !== "after") {
      throw new Error("--position must be 'before' or 'after'");
    }
    state.position = value;
  },
  "--tag": (state, value) => {
    state.tags.push(value);
  },
  "--mention": (state, value) => {
    state.mentions.push(value);
  },
  "--property": (state, value) => {
    const separatorIndex =
      value.indexOf("=") >= 0 ? value.indexOf("=") : value.indexOf(":");
    if (separatorIndex === -1) {
      throw new Error("--property expects key=value or key:value format");
    }
    const key = value.slice(0, separatorIndex).trim();
    const propValue = value.slice(separatorIndex + 1).trim();
    if (!(key && propValue)) {
      throw new Error("--property expects key=value or key:value format");
    }
    state.properties[key] = propValue;
  },
  "--continuation": (state, value) => {
    state.continuations.push(value);
  },
  "--order": (state, value) => {
    const parsed = Number.parseInt(value, 10);
    if (!Number.isFinite(parsed)) {
      throw new Error("--order expects an integer");
    }
    state.order = parsed;
  },
  "--id": (state, value) => {
    state.id = value;
  },
};

const SIMPLE_FLAG_HANDLERS: Record<string, (state: InsertParseState) => void> =
  {
    "--write": (state) => {
      state.optionState.write = true;
    },
    "--json": (state) => {
      if (state.optionState.jsonl) {
        throw new Error("--json and --jsonl are mutually exclusive");
      }
      state.optionState.json = true;
    },
    "--jsonl": (state) => {
      if (state.optionState.json) {
        throw new Error("--json and --jsonl are mutually exclusive");
      }
      state.optionState.jsonl = true;
    },
    "--before": (state) => {
      state.position = "before";
    },
    "--after": (state) => {
      state.position = "after";
    },
    "--raised": (state) => {
      state.signals.raised = true;
    },
    "--starred": (state) => {
      state.signals.important = true;
    },
  };

function readNextValue(
  argv: string[],
  cursor: number,
  flag: string
): [string, number] {
  const value = argv[cursor];
  if (value === undefined || value.startsWith("--")) {
    throw new Error(`Flag ${flag} requires a value`);
  }
  return [value, cursor + 1];
}

function handlePositionalToken(token: string, state: InsertParseState): void {
  if (state.from !== undefined) {
    throw new Error("Cannot mix positional arguments with --from");
  }
  if (state.fileLine) {
    throw new Error(`Unexpected positional argument: ${token}`);
  }
  state.fileLine = token;
}

function validateFromMode(state: InsertParseState): void {
  const hasInlineData =
    state.fileLine ||
    state.type ||
    state.content ||
    state.tags.length > 0 ||
    state.mentions.length > 0 ||
    state.continuations.length > 0 ||
    Object.keys(state.properties).length > 0 ||
    state.position !== undefined ||
    state.order !== undefined ||
    state.id !== undefined;

  if (hasInlineData) {
    throw new Error(
      "Positional and inline flags cannot be combined with --from"
    );
  }
}

function ensureRequiredFields(state: InsertParseState): {
  fileLine: string;
  type: string;
  content: string;
} {
  if (!state.fileLine) {
    throw new Error("insert requires a FILE:LINE positional argument");
  }
  if (!state.type) {
    throw new Error("--type is required when not using --from");
  }
  if (!state.content) {
    throw new Error("--content is required when not using --from");
  }
  return {
    fileLine: state.fileLine,
    type: state.type,
    content: state.content,
  };
}

function parseFileLine(value: string): { file: string; line: number } {
  const colonIndex = value.lastIndexOf(":");
  if (colonIndex === -1) {
    throw new Error("Positional argument must be FILE:LINE");
  }
  const file = value.slice(0, colonIndex).trim();
  const lineValue = value.slice(colonIndex + 1).trim();
  const line = Number.parseInt(lineValue, 10);
  if (!file || Number.isNaN(line) || line <= 0) {
    throw new Error("Invalid FILE:LINE positional argument");
  }
  return { file, line };
}

function buildInsertionSpec(state: InsertParseState): InsertionSpec {
  const { fileLine, type, content } = ensureRequiredFields(state);
  const { file, line } = parseFileLine(fileLine);

  const spec: InsertionSpec = {
    file,
    line,
    type,
    content,
  };

  if (state.position) {
    spec.position = state.position;
  }
  if (state.signals.raised || state.signals.important) {
    spec.signals = { ...state.signals };
  }
  if (Object.keys(state.properties).length > 0) {
    spec.properties = state.properties;
  }
  if (state.tags.length > 0) {
    spec.tags = state.tags;
  }
  if (state.mentions.length > 0) {
    spec.mentions = state.mentions;
  }
  if (state.continuations.length > 0) {
    spec.continuations = state.continuations;
  }
  if (state.order !== undefined) {
    spec.order = state.order;
  }
  if (state.id) {
    spec.id = state.id;
  }

  return spec;
}

function buildInsertOptions(state: InsertParseState): InsertCommandOptions {
  if (state.from !== undefined) {
    return { ...state.optionState, from: state.from };
  }
  return { ...state.optionState };
}

export async function runInsertCommand(
  parsed: ParsedInsertArgs,
  context: CommandContext
): Promise<{
  results: InsertionResult[];
  summary: InsertSummary;
  output: string;
  exitCode: number;
}> {
  const specs = parsed.options.from
    ? await loadSpecsFromSource(parsed.options.from)
    : parsed.specs;

  if (specs.length === 0) {
    throw new Error("No insertions provided");
  }

  const idManager = parsed.options.write
    ? await createIdManager(context)
    : undefined;

  const insertOptions: Parameters<typeof insertWaymarks>[1] = {
    write: parsed.options.write,
    config: context.config,
    format: true,
    logger: {
      debug: (msg, meta) => logger.debug(meta ?? {}, msg),
      info: (msg, meta) => logger.info(meta ?? {}, msg),
      warn: (msg, meta) => logger.warn(meta ?? {}, msg),
      error: (msg, meta) => logger.error(meta ?? {}, msg),
    },
  };

  if (idManager) {
    insertOptions.idManager = idManager;
  }

  const results = await insertWaymarks(specs, insertOptions);

  const summary = summarize(results);
  const output = formatOutput(results, summary, parsed.options);
  const exitCode = results.some((result) => result.status === "error") ? 1 : 0;

  return { results, summary, output, exitCode };
}

// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: JSON parsing requires branching
async function loadSpecsFromSource(path: string): Promise<InsertionSpec[]> {
  const source =
    path === "-" ? await readFromStdin() : await readFile(path, "utf8");

  try {
    const parsed = JSON.parse(source);

    // Support both array format and object format with insertions field
    if (Array.isArray(parsed)) {
      return z.array(InsertionSpecSchema).parse(parsed);
    }

    if (
      parsed &&
      typeof parsed === "object" &&
      Array.isArray(parsed.insertions)
    ) {
      return z.array(InsertionSpecSchema).parse(parsed.insertions);
    }

    if (typeof parsed === "object" && parsed !== null) {
      // Single spec object
      return [InsertionSpecSchema.parse(parsed)];
    }

    throw new Error(
      "Invalid JSON: expected InsertionSpec, InsertionSpec[], or { insertions: InsertionSpec[] }"
    );
  } catch (error) {
    if (error instanceof ZodError) {
      logger.error("JSON validation failed");
      for (const issue of error.issues) {
        const issuePath = issue.path.length > 0 ? issue.path.join(".") : "root";
        logger.error(`  - ${issuePath}: ${issue.message}`);
      }
      throw new Error("JSON validation failed");
    }
    throw error;
  }
}

function summarize(results: InsertionResult[]): InsertSummary {
  const summary: InsertSummary = {
    total: results.length,
    successful: 0,
    failed: 0,
    filesModified: 0,
  };

  const files = new Set<string>();

  for (const result of results) {
    if (result.status === "success") {
      summary.successful += 1;
      files.add(result.file);
    } else {
      summary.failed += 1;
    }
  }

  summary.filesModified = files.size;
  return summary;
}

function formatOutput(
  results: InsertionResult[],
  summary: InsertSummary,
  options: InsertCommandOptions
): string {
  if (options.json || options.jsonl) {
    return formatJsonOutput(results, summary, options);
  }
  return formatTextOutput(results, summary, options.write);
}

function formatJsonOutput(
  results: InsertionResult[],
  summary: InsertSummary,
  options: InsertCommandOptions
): string {
  const payload = {
    results,
    summary: {
      total: summary.total,
      successful: summary.successful,
      failed: summary.failed,
      filesModified: summary.filesModified,
    },
  };

  if (options.jsonl) {
    const lines = results.map((result) => JSON.stringify(result));
    lines.push(JSON.stringify({ summary: payload.summary }));
    return lines.join("\n");
  }

  return JSON.stringify(payload, null, 2);
}

function formatTextOutput(
  results: InsertionResult[],
  summary: InsertSummary,
  writeEnabled: boolean
): string {
  const successes = results.filter((result) => result.status === "success");
  const failures = results.filter((result) => result.status === "error");
  const lines: string[] = [];

  if (successes.length > 0) {
    lines.push(...buildSuccessLines(successes, writeEnabled));
  }

  if (failures.length > 0) {
    lines.push(...buildFailureLines(failures));
  }

  lines.push(buildSummaryLine(summary));
  return lines.join("\n");
}

function buildSuccessLines(
  successes: InsertionResult[],
  writeEnabled: boolean
): string[] {
  const action = writeEnabled ? "Inserted" : "Would insert";
  const lines: string[] = [
    `${action} ${successes.length} waymark${successes.length === 1 ? "" : "s"}:`,
  ];

  for (const success of successes) {
    const displayLine = success.inserted?.line ?? success.requested.line;
    const displayContent = success.inserted?.content ?? "";
    lines.push(`  ✓ ${success.file}:${displayLine}`);
    if (displayContent) {
      lines.push(`    ${displayContent}`);
    }
  }

  return lines;
}

function buildFailureLines(failures: InsertionResult[]): string[] {
  const lines: string[] = [
    `Failed to process ${failures.length} waymark${failures.length === 1 ? "" : "s"}:`,
  ];

  for (const failure of failures) {
    lines.push(
      `  ✗ ${failure.file}:${failure.requested.line} - ${failure.error ?? "Unknown error"}`
    );
  }

  return lines;
}

function buildSummaryLine(summary: InsertSummary): string {
  return `Summary: ${summary.successful} successful, ${summary.failed} failed, ${summary.filesModified} files affected`;
}
