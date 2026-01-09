// tldr ::: remove command implementation for wm CLI

import { readFile } from "node:fs/promises";

import {
  type RemovalResult,
  type RemovalSpec,
  RemovalSpecSchema,
  removeWaymarks,
} from "@waymarks/core";
import { ZodError, z } from "zod";

import type { CommandContext } from "../types.ts";
import { parseFileLineTarget } from "../utils/file-line.ts";
import { expandInputPaths } from "../utils/fs.ts";
import { createIdManager } from "../utils/id-manager.ts";
import { logger } from "../utils/logger.ts";
import { parsePropertyEntry } from "../utils/properties.ts";
import { readFromStdin } from "../utils/stdin.ts";

const LINE_SPLIT_REGEX = /\r?\n/;

export type RemoveSummary = {
  total: number;
  successful: number;
  failed: number;
  filesModified: number;
};

export type RemoveCommandOptions = {
  write: boolean;
  json: boolean;
  jsonl: boolean;
  from?: string;
  reason?: string;
};

export type RemoveCommandInputOptions = {
  id?: string[] | string;
  from?: string;
  reason?: string;
  type?: string;
  tag?: string[] | string;
  mention?: string[] | string;
  property?: string[] | string;
  file?: string[] | string;
  contentPattern?: string;
  contains?: string;
  flagged?: boolean;
  starred?: boolean;
  write?: boolean;
  json?: boolean;
  jsonl?: boolean;
};

export type RemoveCommandInput = {
  targets: string[];
  options: RemoveCommandInputOptions;
};

const RemoveCommandOptionsSchema = z
  .object({
    write: z.boolean(),
    json: z.boolean(),
    jsonl: z.boolean(),
    from: z.string(),
  })
  .partial();

export type ParsedRemoveArgs = {
  specs: RemovalSpec[];
  options: RemoveCommandOptions;
};

type RemoveCriteriaState = {
  type?: string;
  tags: string[];
  mentions: string[];
  properties: Record<string, string>;
  signals: { flagged?: boolean; starred?: boolean };
  contentPattern?: string;
  contains?: string;
};

type RemoveParseState = {
  positional: string[];
  ids: string[];
  filePatterns: string[];
  criteria: RemoveCriteriaState;
  optionState: Omit<RemoveCommandOptions, "from">;
  from?: string;
};

function createInitialState(): RemoveParseState {
  return {
    positional: [],
    ids: [],
    filePatterns: [],
    criteria: {
      tags: [],
      mentions: [],
      properties: {},
      signals: {},
    },
    optionState: {
      write: false,
      json: false,
      jsonl: false,
    },
  };
}

export function buildRemoveArgs(input: RemoveCommandInput): ParsedRemoveArgs {
  const state = createInitialState();
  const { targets, options } = input;

  state.positional = targets.map((target) => String(target));
  state.ids = normalizeOptionValues(options.id);
  state.filePatterns = normalizeOptionValues(options.file);
  state.criteria.tags = normalizeOptionValues(options.tag);
  state.criteria.mentions = normalizeOptionValues(options.mention);
  state.criteria.type = options.type;
  state.criteria.contentPattern = options.contentPattern;
  state.criteria.contains = options.contains;

  const properties: Record<string, string> = {};
  for (const property of normalizeOptionValues(options.property)) {
    const parsed = parsePropertyEntry(property);
    properties[parsed.key] = parsed.value;
  }
  state.criteria.properties = properties;

  if (options.flagged) {
    state.criteria.signals.flagged = true;
  }
  if (options.starred) {
    state.criteria.signals.starred = true;
  }

  state.optionState.write = Boolean(options.write);
  state.optionState.json = Boolean(options.json);
  state.optionState.jsonl = Boolean(options.jsonl);
  if (options.reason) {
    state.optionState.reason = options.reason;
  }
  if (options.from !== undefined) {
    state.from = options.from;
  }

  return finalizeRemoveState(state);
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

function finalizeRemoveState(state: RemoveParseState): ParsedRemoveArgs {
  const options: RemoveCommandOptions = state.from
    ? { ...state.optionState, from: state.from }
    : { ...state.optionState };

  if (state.from) {
    if (state.positional.length > 0 || state.ids.length > 0) {
      throw new Error(
        "Cannot combine --from with positional arguments or --id"
      );
    }
    return { specs: [], options };
  }

  const specs: RemovalSpec[] = [];
  for (const token of state.positional) {
    specs.push(parseFileLineToken(token));
  }

  for (const id of state.ids) {
    specs.push({ id });
  }

  const criteriaSpec = buildCriteriaSpec(state);
  if (criteriaSpec) {
    specs.push(criteriaSpec);
  }

  if (specs.length === 0) {
    throw new Error("No removal targets provided");
  }

  return { specs, options };
}

function parseFileLineToken(token: string): RemovalSpec {
  return parseFileLineTarget(token, {
    missingSeparator: "Positional arguments must be FILE:LINE",
    invalidLine: "Invalid positional argument; expected FILE:LINE",
  });
}

function buildCriteriaSpec(state: RemoveParseState): RemovalSpec | undefined {
  const criteria = state.criteria;
  const hasCriteria =
    criteria.type !== undefined ||
    criteria.tags.length > 0 ||
    criteria.mentions.length > 0 ||
    Object.keys(criteria.properties).length > 0 ||
    criteria.contentPattern !== undefined ||
    criteria.contains !== undefined ||
    Object.keys(criteria.signals).length > 0;

  if (!hasCriteria) {
    return;
  }

  const specCriteria: NonNullable<RemovalSpec["criteria"]> = {};
  if (criteria.type) {
    specCriteria.type = criteria.type;
  }
  if (criteria.tags.length > 0) {
    specCriteria.tags = [...criteria.tags];
  }
  if (criteria.mentions.length > 0) {
    specCriteria.mentions = [...criteria.mentions];
  }
  if (Object.keys(criteria.properties).length > 0) {
    specCriteria.properties = { ...criteria.properties };
  }
  if (Object.keys(criteria.signals).length > 0) {
    specCriteria.signals = { ...criteria.signals };
  }
  if (criteria.contentPattern) {
    specCriteria.contentPattern = criteria.contentPattern;
  }
  if (criteria.contains) {
    specCriteria.contains = criteria.contains;
  }

  return {
    files: [...state.filePatterns],
    criteria: specCriteria,
  };
}

export async function runRemoveCommand(
  parsed: ParsedRemoveArgs,
  context: CommandContext,
  execution: { writeOverride?: boolean } = {}
): Promise<{
  results: RemovalResult[];
  summary: RemoveSummary;
  output: string;
  exitCode: number;
  options: RemoveCommandOptions;
}> {
  const { mergedOptions, normalizedSpecs, shouldWrite } =
    await resolveRemoveInput(parsed, context, execution);

  // Create idManager if writing OR if any spec contains an ID (needed for lookups in dry-run)
  const needsIdManager =
    shouldWrite || normalizedSpecs.some((spec) => spec.id !== undefined);
  const idManager = needsIdManager ? await createIdManager(context) : undefined;
  const removeOptions: Parameters<typeof removeWaymarks>[1] = {
    write: shouldWrite,
    config: context.config,
    ...(idManager ? { idManager } : {}),
    ...(mergedOptions.reason ? { reason: mergedOptions.reason } : {}),
    removedBy: "cli",
    logger: {
      debug: (msg, meta) => logger.debug(meta ?? {}, msg),
      info: (msg, meta) => logger.info(meta ?? {}, msg),
      warn: (msg, meta) => logger.warn(meta ?? {}, msg),
      error: (msg, meta) => logger.error(meta ?? {}, msg),
    },
  };

  const results = await removeWaymarks(normalizedSpecs, removeOptions);

  const summary = summarize(results);
  const output = formatOutput(results, summary, {
    json: mergedOptions.json,
    jsonl: mergedOptions.jsonl,
    dryRun: !shouldWrite,
  });
  const exitCode = results.some((result) => result.status === "error") ? 1 : 0;

  return { results, summary, output, exitCode, options: mergedOptions };
}

async function resolveRemoveInput(
  parsed: ParsedRemoveArgs,
  context: CommandContext,
  execution: { writeOverride?: boolean }
): Promise<{
  mergedOptions: RemoveCommandOptions;
  normalizedSpecs: RemovalSpec[];
  shouldWrite: boolean;
}> {
  let mergedOptions: RemoveCommandOptions = { ...parsed.options };
  let rawSpecs = parsed.specs;

  if (parsed.options.from) {
    const fromPayload = await loadSpecsFromSource(parsed.options.from);
    rawSpecs = fromPayload.specs;
    if (fromPayload.options) {
      mergedOptions = { ...mergedOptions, ...fromPayload.options };
    }
  }

  const shouldWrite = execution.writeOverride ?? mergedOptions.write ?? false;
  const normalizedSpecs = await normalizeRemovalSpecs(rawSpecs, context);

  return { mergedOptions, normalizedSpecs, shouldWrite };
}

async function normalizeRemovalSpecs(
  specs: RemovalSpec[],
  context: CommandContext
): Promise<RemovalSpec[]> {
  const normalized: RemovalSpec[] = [];
  for (const spec of specs) {
    const patterns = determineSearchPatterns(spec, context.workspaceRoot);
    if (!patterns) {
      normalized.push(spec);
      continue;
    }
    const expanded = await expandInputPaths(patterns, context.config);
    normalized.push({
      ...spec,
      files: expanded,
    });
  }
  return normalized;
}

function determineSearchPatterns(
  spec: RemovalSpec,
  workspaceRoot: string
): string[] | undefined {
  if (spec.files && spec.files.length > 0) {
    return spec.files;
  }
  if (spec.criteria) {
    return [workspaceRoot];
  }
  return;
}

type LoadedRemovePayload = {
  specs: RemovalSpec[];
  options?: Partial<RemoveCommandOptions>;
};

type JsonRecord = Record<string, unknown>;

function isJsonRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null;
}

function logZodValidationErrors(error: ZodError): void {
  logger.error("JSON validation failed");
  for (const issue of error.issues) {
    const issuePath = issue.path.length > 0 ? issue.path.join(".") : "root";
    logger.error(`  - ${issuePath}: ${issue.message}`);
  }
}

function parsePayloadOptions(
  options: unknown
): Partial<RemoveCommandOptions> | undefined {
  const result = RemoveCommandOptionsSchema.safeParse(options);
  if (!result.success) {
    return;
  }
  // Filter out undefined values to satisfy exactOptionalPropertyTypes
  const validated: Partial<RemoveCommandOptions> = {};
  if (result.data.write !== undefined) {
    validated.write = result.data.write;
  }
  if (result.data.json !== undefined) {
    validated.json = result.data.json;
  }
  if (result.data.jsonl !== undefined) {
    validated.jsonl = result.data.jsonl;
  }
  if (result.data.from !== undefined) {
    validated.from = result.data.from;
  }
  return validated;
}

function parseRemovalPayload(parsed: unknown): LoadedRemovePayload {
  // Support both array format and object format with removals field
  if (Array.isArray(parsed)) {
    return { specs: z.array(RemovalSpecSchema).parse(parsed) };
  }

  if (isJsonRecord(parsed) && Array.isArray(parsed.removals)) {
    const specs = z.array(RemovalSpecSchema).parse(parsed.removals);
    const result: LoadedRemovePayload = { specs };
    if (parsed.options) {
      const validatedOptions = parsePayloadOptions(parsed.options);
      if (validatedOptions) {
        result.options = validatedOptions;
      }
    }
    return result;
  }

  if (isJsonRecord(parsed)) {
    // Single spec object
    return { specs: [RemovalSpecSchema.parse(parsed)] };
  }

  throw new Error(
    "Invalid JSON: expected RemovalSpec, RemovalSpec[], or { removals: RemovalSpec[] }"
  );
}

async function loadSpecsFromSource(path: string): Promise<LoadedRemovePayload> {
  const source =
    path === "-" ? await readFromStdin() : await readFile(path, "utf8");

  try {
    const parsed = JSON.parse(source);
    return parseRemovalPayload(parsed);
  } catch (error) {
    if (error instanceof ZodError) {
      logZodValidationErrors(error);
      throw new Error("JSON validation failed");
    }
    throw error;
  }
}

function summarize(results: RemovalResult[]): RemoveSummary {
  const summary: RemoveSummary = {
    total: results.length,
    successful: 0,
    failed: 0,
    filesModified: 0,
  };

  const files = new Set<string>();

  for (const result of results) {
    if (result.status === "success") {
      summary.successful += 1;
      if (result.file) {
        files.add(result.file);
      }
    } else {
      summary.failed += 1;
    }
  }

  summary.filesModified = files.size;
  return summary;
}

function formatOutput(
  results: RemovalResult[],
  summary: RemoveSummary,
  options: { json: boolean; jsonl: boolean; dryRun: boolean }
): string {
  if (options.json || options.jsonl) {
    return formatJsonOutput(results, summary, options);
  }
  return formatTextOutput(results, summary, options.dryRun);
}

function formatJsonOutput(
  results: RemovalResult[],
  summary: RemoveSummary,
  options: { json: boolean; jsonl: boolean }
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
  results: RemovalResult[],
  summary: RemoveSummary,
  dryRun: boolean
): string {
  const successes = results.filter((res) => res.status === "success");
  const failures = results.filter((res) => res.status === "error");
  const lines: string[] = [];

  if (successes.length > 0) {
    lines.push(...buildSuccessLines(successes, dryRun));
  }

  if (failures.length > 0) {
    lines.push(...buildFailureLines(failures));
  }

  lines.push(buildSummaryLine(summary));
  return lines.join("\n");
}

function buildSuccessLines(
  successes: RemovalResult[],
  dryRun: boolean
): string[] {
  const lines: string[] = [];
  const action = dryRun ? "Would remove" : "Removed";
  lines.push(
    `${action} ${successes.length} waymark${successes.length === 1 ? "" : "s"}:`
  );
  for (const success of successes) {
    lines.push(`  ✓ ${success.file}:${success.line}`);
    const snippet = success.removed?.split(LINE_SPLIT_REGEX)[0] ?? "";
    if (snippet.trim().length > 0) {
      lines.push(`    ${snippet}`);
    }
  }
  return lines;
}

function buildFailureLines(failures: RemovalResult[]): string[] {
  const lines: string[] = [];
  lines.push(
    `Failed to process ${failures.length} waymark${failures.length === 1 ? "" : "s"}:`
  );
  for (const failure of failures) {
    lines.push(
      `  ✗ ${failure.file}:${failure.line} - ${failure.error ?? "Unknown error"}`
    );
  }
  return lines;
}

function buildSummaryLine(summary: RemoveSummary): string {
  return `Summary: ${summary.successful} successful, ${summary.failed} failed, ${summary.filesModified} files affected`;
}
