// tldr ::: add command implementation for wm CLI

import { readFile } from "node:fs/promises";

import {
  type InsertionResult,
  type InsertionSpec,
  InsertionSpecSchema,
  insertWaymarks,
} from "@waymarks/core";
import { ZodError, z } from "zod";

import type { CommandContext } from "../types.ts";
import { parseFileLineTarget } from "../utils/file-line.ts";
import { createIdManager } from "../utils/id-manager.ts";
import { logger } from "../utils/logger.ts";
import { parsePropertyEntry } from "../utils/properties.ts";
import { readFromStdin } from "../utils/stdin.ts";

export type AddSummary = {
  total: number;
  successful: number;
  failed: number;
  filesModified: number;
};

export type AddCommandOptions = {
  write: boolean;
  json: boolean;
  jsonl: boolean;
  from?: string;
};

export type AddCommandInputOptions = {
  from?: string;
  type?: string;
  content?: string;
  position?: string;
  before?: boolean;
  after?: boolean;
  mention?: string[] | string;
  tag?: string[] | string;
  property?: string[] | string;
  continuation?: string[] | string;
  order?: string | number;
  id?: string;
  flagged?: boolean;
  starred?: boolean;
  write?: boolean;
  json?: boolean;
  jsonl?: boolean;
};

export type AddCommandInput = {
  targetArg?: string;
  typeArg?: string;
  contentArg?: string;
  options: AddCommandInputOptions;
};

export type ParsedAddArgs = {
  specs: InsertionSpec[];
  options: AddCommandOptions;
};

/**
 * Build insertion specs and options from parsed add command input.
 * @param input - Parsed positional arguments and flags.
 * @returns Parsed insertion specs and options.
 */
export function buildAddArgs(input: AddCommandInput): ParsedAddArgs {
  const state = createInitialState();
  const { options } = input;

  assertAddOptionConflicts(options, input.typeArg, input.contentArg);
  applyOptionFlags(state, options);
  applyPositionalFields(state, input, options);
  applyPositionOptions(state, options);
  applyMetadata(state, options);
  applySignalFlags(state, options);
  applyOrderAndId(state, options);

  const insertOptions = buildInsertOptions(state);
  if (state.from !== undefined) {
    validateFromMode(state);
    return { specs: [], options: insertOptions };
  }

  const spec = buildInsertionSpec(state);
  return { specs: [spec], options: insertOptions };
}

type InsertParseState = {
  optionState: Omit<AddCommandOptions, "from">;
  tags: string[];
  mentions: string[];
  continuations: string[];
  properties: Record<string, string>;
  signals: { flagged: boolean; starred: boolean };
  fileLine?: string;
  type?: string;
  content?: string;
  position?: "before" | "after";
  order?: number;
  id?: string;
  from?: string;
};

function createInitialState(): InsertParseState {
  return {
    optionState: {
      write: false,
      json: false,
      jsonl: false,
    },
    tags: [],
    mentions: [],
    continuations: [],
    properties: {},
    signals: { flagged: false, starred: false },
  };
}

function assertAddOptionConflicts(
  options: AddCommandInputOptions,
  typeArg?: string,
  contentArg?: string
): void {
  if (options.position && (options.before || options.after)) {
    throw new Error("Use --position or --before/--after (not both).");
  }
  if (options.before && options.after) {
    throw new Error("Cannot combine --before and --after.");
  }
  if (options.type && typeArg) {
    throw new Error("Cannot combine --type with positional <type>.");
  }
  if (options.content && contentArg) {
    throw new Error("Cannot combine --content with positional <content>.");
  }
}

function applyOptionFlags(
  state: InsertParseState,
  options: AddCommandInputOptions
): void {
  state.optionState.write = Boolean(options.write);
  state.optionState.json = Boolean(options.json);
  state.optionState.jsonl = Boolean(options.jsonl);
  if (options.from !== undefined) {
    state.from = options.from;
  }
}

function applyPositionalFields(
  state: InsertParseState,
  input: AddCommandInput,
  options: AddCommandInputOptions
): void {
  if (input.targetArg !== undefined) {
    state.fileLine = input.targetArg;
  }
  const resolvedType = options.type ?? input.typeArg;
  if (resolvedType !== undefined) {
    state.type = resolvedType;
  }
  const resolvedContent = options.content ?? input.contentArg;
  if (resolvedContent !== undefined) {
    state.content = resolvedContent;
  }
}

function applyPositionOptions(
  state: InsertParseState,
  options: AddCommandInputOptions
): void {
  if (options.position) {
    assertValidPosition(options.position);
    state.position = options.position;
    return;
  }
  if (options.before) {
    state.position = "before";
  }
  if (options.after) {
    state.position = "after";
  }
}

function assertValidPosition(
  value: string
): asserts value is "before" | "after" {
  if (value !== "before" && value !== "after") {
    throw new Error("--position must be 'before' or 'after'");
  }
}

function applyMetadata(
  state: InsertParseState,
  options: AddCommandInputOptions
): void {
  state.tags = normalizeOptionValues(options.tag);
  state.mentions = normalizeOptionValues(options.mention);
  state.continuations = normalizeOptionValues(options.continuation);
  state.properties = parseProperties(options.property);
}

function parseProperties(value: unknown): Record<string, string> {
  const properties: Record<string, string> = {};
  for (const property of normalizeOptionValues(value)) {
    const parsed = parsePropertyEntry(property);
    properties[parsed.key] = parsed.value;
  }
  return properties;
}

function applySignalFlags(
  state: InsertParseState,
  options: AddCommandInputOptions
): void {
  state.signals.flagged = Boolean(options.flagged);
  state.signals.starred = Boolean(options.starred);
}

function applyOrderAndId(
  state: InsertParseState,
  options: AddCommandInputOptions
): void {
  if (options.order !== undefined && options.order !== null) {
    const parsedOrder = Number.parseInt(String(options.order), 10);
    if (!Number.isFinite(parsedOrder)) {
      throw new Error("--order expects an integer");
    }
    state.order = parsedOrder;
  }
  if (options.id) {
    state.id = String(options.id);
  }
}

function normalizeOptionValues(value: unknown): string[] {
  if (value === undefined || value === null) {
    return [];
  }
  if (Array.isArray(value)) {
    return value.map((item) => String(item));
  }
  return [String(value)];
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
    throw new Error("add requires a FILE:LINE positional argument");
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
  return parseFileLineTarget(value, {
    missingSeparator: "Positional argument must be FILE:LINE",
    invalidLine: "Invalid FILE:LINE positional argument",
  });
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
  if (state.signals.flagged || state.signals.starred) {
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

function buildInsertOptions(state: InsertParseState): AddCommandOptions {
  if (state.from !== undefined) {
    return { ...state.optionState, from: state.from };
  }
  return { ...state.optionState };
}

/**
 * Execute the `wm add` command with parsed inputs.
 * @param parsed - Parsed insertion specs and options.
 * @param context - CLI context with config, logger, and filesystem helpers.
 * @returns Results, summary, output text, and exit code.
 */
export async function runAddCommand(
  parsed: ParsedAddArgs,
  context: CommandContext
): Promise<{
  results: InsertionResult[];
  summary: AddSummary;
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

async function loadSpecsFromSource(path: string): Promise<InsertionSpec[]> {
  const source =
    path === "-" ? await readFromStdin() : await readFile(path, "utf8");

  try {
    const parsed = JSON.parse(source);
    const candidates = normalizeInsertionSpecs(parsed);
    return z.array(InsertionSpecSchema).parse(candidates);
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

function normalizeInsertionSpecs(parsed: unknown): unknown {
  if (Array.isArray(parsed)) {
    return parsed;
  }

  if (parsed && typeof parsed === "object") {
    const record = parsed as { insertions?: unknown };
    if (Array.isArray(record.insertions)) {
      return record.insertions;
    }
    return [parsed];
  }

  throw new Error(
    "Invalid JSON: expected InsertionSpec, InsertionSpec[], or { insertions: InsertionSpec[] }"
  );
}

function summarize(results: InsertionResult[]): AddSummary {
  const summary: AddSummary = {
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
  summary: AddSummary,
  options: AddCommandOptions
): string {
  if (options.json || options.jsonl) {
    return formatJsonOutput(results, summary, options);
  }
  return formatTextOutput(results, summary, options.write);
}

function formatJsonOutput(
  results: InsertionResult[],
  summary: AddSummary,
  options: AddCommandOptions
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
  summary: AddSummary,
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

function buildSummaryLine(summary: AddSummary): string {
  return `Summary: ${summary.successful} successful, ${summary.failed} failed, ${summary.filesModified} files affected`;
}
