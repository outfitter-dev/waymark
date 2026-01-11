// tldr ::: remove waymarks from files by line, id, or criteria queries

import { randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import { readFile, rename, unlink, writeFile } from "node:fs/promises";
import { basename, dirname, join } from "node:path";

import { parse, type WaymarkRecord } from "@waymarks/grammar";
import safeRegex from "safe-regex";
import { z } from "zod";

import type { WaymarkIdManager } from "./ids.ts";
import type { CoreLogger, WaymarkConfig } from "./types.ts";

// Define the signals schema separately so we can reuse it
const RemovalSignalsSchema = z
  .object({
    flagged: z.boolean().optional(),
    starred: z.boolean().optional(),
  })
  .strict();

/** Signal filters used when selecting waymarks to remove. */
export type RemovalSignals = z.infer<typeof RemovalSignalsSchema>;

/** Zod schema describing removal criteria filters. */
export const RemovalCriteriaSchema = z
  .object({
    type: z.string().optional(),
    tags: z.array(z.string()).optional(),
    properties: z.record(z.string(), z.string()).optional(),
    mentions: z.array(z.string()).optional(),
    contentPattern: z.string().optional(),
    contains: z.string().optional(),
    signals: RemovalSignalsSchema.optional(),
  })
  .refine(
    (data) => {
      // At least one criteria field must be provided
      return (
        data.type !== undefined ||
        data.tags !== undefined ||
        data.properties !== undefined ||
        data.mentions !== undefined ||
        data.contentPattern !== undefined ||
        data.contains !== undefined ||
        data.signals !== undefined
      );
    },
    { message: "At least one criteria field must be provided" }
  );

/** Parsed criteria used to match waymarks for removal. */
export type RemovalCriteria = z.infer<typeof RemovalCriteriaSchema>;

/** Zod schema describing a removal request. */
export const RemovalSpecSchema = z
  .object({
    file: z.string().optional(),
    line: z.number().int().positive().optional(),
    id: z.string().optional(),
    files: z.array(z.string()).optional(),
    criteria: RemovalCriteriaSchema.optional(),
  })
  .refine(
    (data) => {
      // At least one removal method must be provided
      return (
        data.file !== undefined ||
        data.line !== undefined ||
        data.id !== undefined ||
        data.files !== undefined ||
        data.criteria !== undefined
      );
    },
    {
      message:
        "At least one removal method must be provided (file, line, id, files, or criteria)",
    }
  );

/** Parsed removal request for one or more waymarks. */
export type RemovalSpec = z.infer<typeof RemovalSpecSchema>;

/** Result for a single removal attempt. */
export type RemovalResult = {
  file: string;
  line: number;
  removed?: string;
  status: "success" | "error";
  error?: string;
};

/** Options that control how removals are applied and written. */
export type RemoveOptions = {
  write?: boolean;
  config?: WaymarkConfig;
  idManager?: WaymarkIdManager;
  logger?: CoreLogger;
  reason?: string;
  removedBy?: string;
};

type FileContext = {
  path: string;
  lines: string[];
  originalEol: string;
  endsWithFinalEol: boolean;
  records: WaymarkRecord[];
};

type RemovalMatch = {
  record: WaymarkRecord;
  reason: string;
};

type PlannedRemoval = {
  record: WaymarkRecord;
  reason: string;
  removedLines: string[];
  ids: string[];
};

// Match [[hash]], [[hash|alias]], or [[alias]]
const ID_REGEX = /\[\[([a-z0-9-]+)(?:\|([^\]]+))?\]\]/gi;
const LINE_SPLIT_REGEX = /\r?\n/;
const MAX_CONTENT_PATTERN_LENGTH = 512;

type RemovalState = {
  results: RemovalResult[];
  matchesByFile: Map<string, Map<number, RemovalMatch>>;
  options: RemoveOptions;
  contexts: Map<string, Promise<FileContext | null>>;
  dryRun: boolean;
};

/** Remove waymarks matching specs, optionally writing changes to disk. */
export async function removeWaymarks(
  specs: RemovalSpec[],
  options: RemoveOptions = {}
): Promise<RemovalResult[]> {
  if (specs.length === 0) {
    return [];
  }

  options.logger?.debug("Processing removals", {
    specCount: specs.length,
  });

  const state: RemovalState = {
    results: [],
    matchesByFile: new Map(),
    options,
    contexts: new Map(),
    dryRun: options.write !== true,
  };

  for (const spec of specs) {
    await processRemovalSpec(spec, state);
  }

  await applyMatches(state);
  return state.results;
}

async function processRemovalSpec(
  spec: RemovalSpec,
  state: RemovalState
): Promise<void> {
  const trimmedId = spec.id?.trim();
  if (trimmedId) {
    state.options.logger?.debug("Processing ID-based removal", {
      id: trimmedId,
    });
    await processIdSpec(trimmedId, state);
    return;
  }

  if (isLineSpec(spec)) {
    state.options.logger?.debug("Processing line-based removal", {
      file: spec.file,
      line: spec.line,
    });
    await processLineSpec(spec, state);
    return;
  }

  if (spec.criteria) {
    state.options.logger?.debug("Processing criteria-based removal", {
      criteria: spec.criteria,
    });
    await processCriteriaSpec(spec, state);
    return;
  }

  state.results.push(
    errorResult(spec.file ?? "", spec.line ?? 0, "Invalid removal spec")
  );
}

function isLineSpec(spec: RemovalSpec): spec is RemovalSpec & {
  file: string;
  line: number;
} {
  return (
    typeof spec.file === "string" &&
    spec.file.length > 0 &&
    typeof spec.line === "number"
  );
}

async function processIdSpec(id: string, state: RemovalState): Promise<void> {
  const idManager = state.options.idManager;
  if (!idManager) {
    state.results.push(
      errorResult("", 0, "ID-based removal requires an ID manager")
    );
    return;
  }

  const entry = await idManager.get(id);
  if (!entry) {
    state.results.push(errorResult("", 0, `Unknown waymark id: ${id}`));
    return;
  }

  const context = await ensureContext(state, entry.file);
  if (!context) {
    state.results.push(
      errorResult(entry.file, entry.line, `File not found: ${entry.file}`)
    );
    return;
  }

  const record =
    findRecordByLine(context.records, entry.line) ??
    findRecordById(context.records, id);

  if (!record) {
    state.results.push(
      errorResult(
        entry.file,
        entry.line,
        `Waymark id ${id} not found in ${entry.file}`
      )
    );
    return;
  }

  addMatch(state.matchesByFile, record.file, record.startLine, {
    record,
    reason: `id:${id}`,
  });
}

async function processLineSpec(
  spec: RemovalSpec & { file: string; line: number },
  state: RemovalState
): Promise<void> {
  const context = await ensureContext(state, spec.file);
  if (!context) {
    state.results.push(
      errorResult(spec.file, spec.line, `File not found: ${spec.file}`)
    );
    return;
  }

  const record = findRecordByLine(context.records, spec.line);
  if (!record) {
    state.results.push(
      errorResult(spec.file, spec.line, `Line ${spec.line} is not a waymark`)
    );
    return;
  }

  addMatch(state.matchesByFile, record.file, record.startLine, {
    record,
    reason: `line:${spec.line}`,
  });
}

async function processCriteriaSpec(
  spec: RemovalSpec,
  state: RemovalState
): Promise<void> {
  const criteria = spec.criteria;
  if (!criteria) {
    return;
  }

  const files = resolveCriteriaFiles(spec);
  if (files.length === 0) {
    state.results.push(
      errorResult(
        spec.file ?? "",
        0,
        "Criteria-based removal requires explicit files"
      )
    );
    return;
  }

  let regex: RegExp | undefined;
  if (criteria.contentPattern !== undefined) {
    const compiled = compileContentPattern(criteria.contentPattern);
    if (!compiled.ok) {
      state.results.push(errorResult(files[0] ?? "", 0, compiled.error));
      return;
    }
    regex = compiled.regex;
  }

  for (const filePath of files) {
    const context = await ensureContext(state, filePath);
    if (!context) {
      state.results.push(
        errorResult(filePath, 0, `File not found: ${filePath}`)
      );
      continue;
    }

    for (const record of context.records) {
      if (matchesCriteria(record, criteria, regex)) {
        addMatch(state.matchesByFile, record.file, record.startLine, {
          record,
          reason: "criteria",
        });
      }
    }
  }
}

function resolveCriteriaFiles(spec: RemovalSpec): string[] {
  if (spec.files && spec.files.length > 0) {
    return spec.files.filter((file) => file.length > 0);
  }
  if (spec.file && spec.file.length > 0) {
    return [spec.file];
  }
  return [];
}

async function ensureContext(
  state: RemovalState,
  filePath: string
): Promise<FileContext | null> {
  let promise = state.contexts.get(filePath);
  if (!promise) {
    promise = loadFileContext(filePath);
    state.contexts.set(filePath, promise);
  }
  return await promise;
}

async function applyMatches(state: RemovalState): Promise<void> {
  for (const [filePath, matches] of state.matchesByFile) {
    await applyMatchesForFile(state, filePath, matches);
  }

  if (state.dryRun) {
    state.options.logger?.debug("Dry-run mode, skipping writes", {
      matchCount: state.matchesByFile.size,
    });
    return;
  }

  const successfulRemovals = state.results.filter(
    (r) => r.status === "success"
  );
  if (successfulRemovals.length > 0) {
    state.options.logger?.info("Removed waymarks", {
      total: state.results.length,
      successful: successfulRemovals.length,
      filesModified: state.matchesByFile.size,
    });
  }
}

async function applyMatchesForFile(
  state: RemovalState,
  filePath: string,
  matches: Map<number, RemovalMatch>
): Promise<void> {
  const context = await ensureContext(state, filePath);
  if (!context) {
    for (const line of matches.keys()) {
      state.results.push(
        errorResult(filePath, line, `File not found: ${filePath}`)
      );
    }
    return;
  }

  const plan = buildRemovalPlan(context, matches);
  if (plan.errors.length > 0) {
    state.results.push(...plan.errors);
  }

  if (plan.removals.length === 0) {
    return;
  }

  if (state.dryRun) {
    state.results.push(
      ...plan.removals.map((removal) => ({
        file: removal.record.file,
        line: removal.record.startLine,
        removed: removal.removedLines.join(context.originalEol),
        status: "success" as const,
      }))
    );
    return;
  }

  try {
    await writeBackFileAtomic({
      filePath: context.path,
      lines: plan.updatedLines,
      originalEol: context.originalEol,
      endsWithFinalEol: context.endsWithFinalEol,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    state.results.push(
      ...plan.removals.map((removal) =>
        errorResult(
          removal.record.file,
          removal.record.startLine,
          `Failed to write ${filePath}: ${message}`
        )
      )
    );
    return;
  }

  state.results.push(
    ...plan.removals.map((removal) => ({
      file: removal.record.file,
      line: removal.record.startLine,
      removed: removal.removedLines.join(context.originalEol),
      status: "success" as const,
    }))
  );

  await commitIdRemovals(plan.removals, state.options);
}

function buildRemovalPlan(
  context: FileContext,
  matches: Map<number, RemovalMatch>
): {
  updatedLines: string[];
  removals: PlannedRemoval[];
  errors: RemovalResult[];
} {
  const updatedLines = [...context.lines];
  const removals: PlannedRemoval[] = [];
  const errors: RemovalResult[] = [];
  const sorted = Array.from(matches.values()).sort(
    (a, b) => b.record.startLine - a.record.startLine
  );

  for (const match of sorted) {
    const removedLines = removeRecordFromLines(updatedLines, match.record);
    if (!removedLines) {
      errors.push(
        errorResult(
          match.record.file,
          match.record.startLine,
          `Failed to remove waymark at line ${match.record.startLine}`
        )
      );
      continue;
    }
    removals.push({
      record: match.record,
      reason: match.reason,
      removedLines,
      ids: extractIds(match.record.raw),
    });
  }

  return { updatedLines, removals, errors };
}

async function commitIdRemovals(
  removals: PlannedRemoval[],
  options: RemoveOptions
): Promise<void> {
  if (!options.idManager) {
    return;
  }

  for (const removal of removals) {
    const reason = options.reason ?? removal.reason;
    const removeOptions: { reason?: string; removedBy?: string } = {};
    if (reason !== undefined) {
      removeOptions.reason = reason;
    }
    if (options.removedBy !== undefined) {
      removeOptions.removedBy = options.removedBy;
    }
    for (const id of removal.ids) {
      await options.idManager.remove(id, removeOptions);
    }
  }
}

function addMatch(
  matchesByFile: Map<string, Map<number, RemovalMatch>>,
  file: string,
  startLine: number,
  match: RemovalMatch
): void {
  const fileMatches =
    matchesByFile.get(file) ?? new Map<number, RemovalMatch>();
  if (!matchesByFile.has(file)) {
    matchesByFile.set(file, fileMatches);
  }
  if (!fileMatches.has(startLine)) {
    fileMatches.set(startLine, match);
  }
}

async function loadFileContext(filePath: string): Promise<FileContext | null> {
  if (!existsSync(filePath)) {
    return null;
  }
  const text = await readFile(filePath, "utf8");
  const originalEol = text.includes("\r\n") ? "\r\n" : "\n";
  const endsWithFinalEol = text.endsWith(originalEol);
  const lines = text.split(LINE_SPLIT_REGEX);
  if (lines.length > 0 && lines.at(-1) === "") {
    lines.pop();
  }
  const records = parse(text, { file: filePath });
  return { path: filePath, lines, originalEol, endsWithFinalEol, records };
}

function findRecordByLine(
  records: WaymarkRecord[],
  line: number
): WaymarkRecord | undefined {
  return records.find(
    (record) => line >= record.startLine && line <= record.endLine
  );
}

function findRecordById(
  records: WaymarkRecord[],
  id: string
): WaymarkRecord | undefined {
  // Normalize to [[hash]] format
  const normalized =
    id.startsWith("[[") && id.endsWith("]]") ? id : `[[${id}]]`;
  return records.find((record) => record.raw.includes(normalized));
}

function matchesCriteria(
  record: WaymarkRecord,
  criteria: RemovalCriteria,
  pattern?: RegExp
): boolean {
  if (!typeMatches(record, criteria.type)) {
    return false;
  }

  if (!tagsMatch(record, criteria.tags)) {
    return false;
  }

  if (!mentionsMatch(record, criteria.mentions)) {
    return false;
  }

  if (!propertiesMatch(record, criteria.properties)) {
    return false;
  }

  if (!containsMatch(record, criteria.contains)) {
    return false;
  }

  if (!signalsMatch(record, criteria.signals)) {
    return false;
  }

  if (pattern && !pattern.test(record.raw)) {
    return false;
  }

  return true;
}

function typeMatches(record: WaymarkRecord, type?: string): boolean {
  return type ? record.type === type : true;
}

function tagsMatch(record: WaymarkRecord, tags?: string[]): boolean {
  if (!tags || tags.length === 0) {
    return true;
  }
  const required = new Set(tags.map((tag) => tag.toLowerCase()));
  const recordTags = new Set(record.tags.map((tag) => tag.toLowerCase()));
  for (const tag of required) {
    if (!recordTags.has(tag)) {
      return false;
    }
  }
  return true;
}

function mentionsMatch(record: WaymarkRecord, mentions?: string[]): boolean {
  if (!mentions || mentions.length === 0) {
    return true;
  }
  const required = new Set(mentions.map((mention) => mention.toLowerCase()));
  const recordMentions = new Set(
    record.mentions.map((mention) => mention.toLowerCase())
  );
  for (const mention of required) {
    if (!recordMentions.has(mention)) {
      return false;
    }
  }
  return true;
}

function propertiesMatch(
  record: WaymarkRecord,
  properties?: Record<string, string>
): boolean {
  if (!properties) {
    return true;
  }
  return Object.entries(properties).every(
    ([key, value]) => record.properties[key] === value
  );
}

function containsMatch(record: WaymarkRecord, contains?: string): boolean {
  if (!contains) {
    return true;
  }
  const needle = contains.toLowerCase();
  return (
    record.contentText.toLowerCase().includes(needle) ||
    record.raw.toLowerCase().includes(needle)
  );
}

function signalsMatch(
  record: WaymarkRecord,
  signals?: RemovalSignals
): boolean {
  if (!signals) {
    return true;
  }
  if (
    signals.flagged !== undefined &&
    record.signals.flagged !== signals.flagged
  ) {
    return false;
  }
  if (
    signals.starred !== undefined &&
    record.signals.starred !== signals.starred
  ) {
    return false;
  }
  return true;
}

function removeRecordFromLines(
  lines: string[],
  record: WaymarkRecord
): string[] | null {
  const startIndex = record.startLine - 1;
  const endIndex = record.endLine - 1;
  if (startIndex < 0 || endIndex >= lines.length || startIndex > endIndex) {
    return null;
  }
  return lines.splice(startIndex, endIndex - startIndex + 1);
}

async function writeBackFileAtomic(args: {
  filePath: string;
  lines: string[];
  originalEol: string;
  endsWithFinalEol: boolean;
}): Promise<void> {
  const content = buildFileText(
    args.lines,
    args.originalEol,
    args.endsWithFinalEol
  );
  await writeFileAtomic(args.filePath, content);
}

function buildFileText(
  lines: string[],
  originalEol: string,
  endsWithFinalEol: boolean
): string {
  const joined = lines.join(originalEol);
  const suffix = lines.length > 0 && endsWithFinalEol ? originalEol : "";
  return joined + suffix;
}

async function writeFileAtomic(
  filePath: string,
  contents: string
): Promise<void> {
  const dir = dirname(filePath);
  const tempPath = join(
    dir,
    `.waymark-tmp-${basename(filePath)}-${randomUUID()}`
  );

  try {
    await writeFile(tempPath, contents, "utf8");
    await rename(tempPath, filePath);
  } catch (error) {
    await unlink(tempPath).catch((unlinkError) => {
      // note ::: best-effort cleanup, ignore temp unlink failures
      return unlinkError;
    });
    throw error;
  }
}

function compileContentPattern(
  pattern: string
): { ok: true; regex: RegExp } | { ok: false; error: string } {
  if (pattern.trim().length === 0) {
    return { ok: false, error: "Content pattern cannot be empty" };
  }
  if (pattern.length > MAX_CONTENT_PATTERN_LENGTH) {
    return {
      ok: false,
      error: `Content pattern exceeds ${MAX_CONTENT_PATTERN_LENGTH} characters`,
    };
  }

  if (!safeRegex(pattern)) {
    return {
      ok: false,
      error:
        "Content pattern is potentially unsafe; please simplify it to avoid catastrophic backtracking",
    };
  }

  try {
    return { ok: true, regex: new RegExp(pattern) };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return {
      ok: false,
      error: `Invalid content pattern: ${message}`,
    };
  }
}

function errorResult(
  file: string,
  line: number,
  message: string
): RemovalResult {
  return {
    file,
    line,
    status: "error",
    error: message,
  };
}

function extractIds(raw: string): string[] {
  const matches = raw.match(ID_REGEX);
  if (!matches) {
    return [];
  }
  return matches;
}
