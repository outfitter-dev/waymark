// tldr ::: edit command implementation for wm CLI

import { readFile, writeFile } from "node:fs/promises";
import {
  type AnyKitError,
  InternalError,
  NotFoundError,
  Result,
  ValidationError,
} from "@outfitter/contracts";
import {
  fingerprintContent,
  fingerprintContext,
  JsonIdIndex,
  parse,
  SIGIL,
  type WaymarkConfig,
  type WaymarkRecord,
} from "@waymarks/core";
import type { CommandContext } from "../types.ts";
import {
  promptConfirm,
  promptSelect,
  promptText,
} from "../utils/clack-prompts.ts";
import { parseFileLineTarget } from "../utils/file-line.ts";
import { logger } from "../utils/logger.ts";
import { assertPromptAllowed } from "../utils/prompts.ts";
import { readStream } from "../utils/stdin.ts";

export type ModifyOptions = {
  id?: string;
  type?: string;
  content?: string;
  flagged?: boolean;
  starred?: boolean;
  noSignal?: boolean;
  write?: boolean;
  json?: boolean;
  jsonl?: boolean;
  interactive?: boolean;
};

export type ModifyTarget = {
  file: string;
  line: number;
  id?: string;
};

export type ModifyCommandResult = {
  output: string;
  payload: ModifyPayload;
};

type ModifySignals = {
  flagged: boolean;
  starred: boolean;
};

type ModifyIo = {
  stdin: NodeJS.ReadableStream;
};

export type ModifyPayload = {
  preview: boolean;
  applied: boolean;
  target: ModifyTarget;
  modifications: {
    type?: { from: string; to: string };
    signals?: { from: ModifySignals; to: ModifySignals };
    content?: { from: string; to: string };
  };
  before: {
    raw: string;
    type: string;
    signals: ModifySignals;
    content: string;
  };
  after: {
    raw: string;
    type: string;
    signals: ModifySignals;
    content: string;
  };
  indexRefreshed: boolean;
  noChange: boolean;
};

const LINE_SPLIT_REGEX = /\r?\n/;
// Match [[hash]], [[hash|alias]], or [[alias]] at end of content
const ID_TRAIL_REGEX = /(\[\[[^\]]+\]\])$/i;
const DEFAULT_MARKERS = ["todo", "fix", "note", "warn", "tldr", "done"];

const DEFAULT_IO: ModifyIo = {
  stdin: process.stdin,
};

class InteractiveCancelError extends Error {
  constructor() {
    super("Interactive session cancelled");
    this.name = "InteractiveCancelError";
  }
}

type InteractiveAnswers = {
  type?: string;
  addFlagged?: boolean;
  addStarred?: boolean;
  clearSignals?: boolean;
  updateContent?: boolean;
  content?: string;
  apply?: boolean;
};

/**
 * Execute the `wm modify` command to update an existing waymark.
 * @param context - CLI context with config and logging.
 * @param targetArg - Target file/line input.
 * @param options - Modify command options.
 * @param io - IO adapters for prompts and stdin.
 * @returns CLI result payload wrapped in a Result.
 */
export function runModifyCommand(
  context: CommandContext,
  targetArg: string | undefined,
  options: ModifyOptions,
  io: ModifyIo = DEFAULT_IO
): Promise<Result<ModifyCommandResult, AnyKitError>> {
  return Result.tryPromise({
    try: () => runModifyCommandInner(context, targetArg, options, io),
    catch: (cause) => {
      if (cause instanceof Error && "category" in cause) {
        return cause as AnyKitError;
      }
      return InternalError.create(
        `Modify failed: ${cause instanceof Error ? cause.message : String(cause)}`
      );
    },
  });
}

async function runModifyCommandInner(
  context: CommandContext,
  targetArg: string | undefined,
  options: ModifyOptions,
  io: ModifyIo
): Promise<ModifyCommandResult> {
  const target = await resolveTarget(context, targetArg, options.id);
  const snapshot = await loadWaymarkSnapshot(target);
  const originalFirstLine = snapshot.lines[snapshot.lineIndex];
  if (!originalFirstLine) {
    throw NotFoundError.create("line", String(snapshot.lineIndex + 1), {
      file: target.file,
    });
  }
  const originalContent = extractFirstLineContent(originalFirstLine);
  const existingId = extractTrailingId(originalContent);

  let effectiveOptions = { ...options };
  const wasInteractive = effectiveOptions.interactive;

  if (effectiveOptions.interactive) {
    try {
      effectiveOptions = await runInteractiveSession(
        context,
        snapshot.record,
        originalContent,
        effectiveOptions
      );
    } catch (error) {
      if (error instanceof InteractiveCancelError) {
        return {
          output: "Edit cancelled.",
          payload: {
            preview: true,
            applied: false,
            target,
            modifications: {},
            before: {
              raw: originalFirstLine,
              type: snapshot.record.type,
              signals: { ...snapshot.record.signals },
              content: originalContent,
            },
            after: {
              raw: originalFirstLine,
              type: snapshot.record.type,
              signals: { ...snapshot.record.signals },
              content: originalContent,
            },
            indexRefreshed: false,
            noChange: true,
          },
        };
      }
      throw error;
    }
  }

  // Skip modification check if interactive (user already chose what to modify)
  if (!wasInteractive) {
    ensureModificationsSpecified(effectiveOptions);
  }

  const resolvedContent = await resolveContentInput(effectiveOptions, io.stdin);

  const applyResult = applyModifications({
    record: snapshot.record,
    config: context.config,
    baseContent: originalContent,
    resolvedContent,
    options: effectiveOptions,
  });

  const updatedLines = [...snapshot.lines];
  updatedLines[snapshot.lineIndex] = applyResult.firstLine;

  const diffDetected = applyResult.firstLine !== originalFirstLine;
  const shouldWrite = Boolean(effectiveOptions.write && diffDetected);

  let indexRefreshed = false;
  if (shouldWrite) {
    const text = buildUpdatedFileContent(
      updatedLines,
      snapshot.newline,
      snapshot.hasTrailingNewline
    );
    await writeFile(target.file, text, "utf8");

    const activeId = extractTrailingId(applyResult.content) ?? existingId;
    if (activeId) {
      await updateIdIndex(context, target, activeId, applyResult);
      indexRefreshed = true;
    }
  }

  const preview = !shouldWrite;
  const payload: ModifyPayload = {
    preview,
    applied: shouldWrite,
    target,
    modifications: buildModificationSummary(snapshot.record, applyResult),
    before: {
      raw: originalFirstLine,
      type: snapshot.record.type,
      signals: { ...snapshot.record.signals },
      content: originalContent,
    },
    after: {
      raw: applyResult.firstLine,
      type: applyResult.type,
      signals: { ...applyResult.signals },
      content: applyResult.content,
    },
    indexRefreshed,
    noChange: !diffDetected,
  };

  const output = formatOutput({
    payload,
    options: effectiveOptions,
    record: snapshot.record,
    target,
  });

  return { output, payload };
}

type Snapshot = {
  record: WaymarkRecord;
  lines: string[];
  newline: string;
  hasTrailingNewline: boolean;
  lineCount: number;
  lineIndex: number;
};

async function loadWaymarkSnapshot(target: ModifyTarget): Promise<Snapshot> {
  const fileContent = await readFile(target.file, "utf8");
  const newline = fileContent.includes("\r\n") ? "\r\n" : "\n";
  const hasTrailingNewline = fileContent.endsWith("\n");
  const lines = fileContent.split(LINE_SPLIT_REGEX);
  const records = parse(fileContent, { file: target.file });
  const record = records.find((entry) => entry.startLine === target.line);
  if (!record) {
    throw NotFoundError.create("waymark", `${target.file}:${target.line}`);
  }
  const lineIndex = record.startLine - 1;
  return {
    record,
    lines,
    newline,
    hasTrailingNewline,
    lineCount: lines.length,
    lineIndex,
  };
}

const CARRIAGE_RETURN_REGEX = /\r$/;

function extractFirstLineContent(firstLine: string): string {
  const sigilIndex = firstLine.indexOf(SIGIL);
  if (sigilIndex === -1) {
    return "";
  }
  const after = firstLine.slice(sigilIndex + SIGIL.length);
  const trimmedStart = after.trimStart();
  return trimmedStart.replace(CARRIAGE_RETURN_REGEX, "");
}

export type ApplyArgs = {
  record: WaymarkRecord;
  config: WaymarkConfig;
  baseContent: string;
  resolvedContent?: string | undefined;
  options: ModifyOptions;
};

export type ApplyResult = {
  type: string;
  signals: ModifySignals;
  content: string;
  firstLine: string;
};

/**
 * Apply requested modifications to a waymark record.
 * @param args - Modification inputs and context.
 * @returns Updated waymark fields and first line output.
 */
export function applyModifications(args: ApplyArgs): ApplyResult {
  const { record, config, baseContent, resolvedContent, options } = args;

  const nextType = determineType(record.type, options.type);
  const nextSignals = determineSignals(record.signals, options);
  const contentInput =
    resolvedContent !== undefined ? resolvedContent.trim() : baseContent;
  const content = preserveId(baseContent, contentInput);
  const firstLine = renderFirstLine({
    record,
    config,
    type: nextType,
    signals: nextSignals,
    content,
  });

  return {
    type: nextType,
    signals: nextSignals,
    content,
    firstLine,
  };
}

function determineType(current: string, requested?: string): string {
  if (!requested) {
    return current;
  }
  const trimmed = requested.trim();
  if (!trimmed) {
    throw ValidationError.create("type", "cannot be empty");
  }
  return trimmed;
}

function determineSignals(
  current: ModifySignals,
  options: ModifyOptions
): ModifySignals {
  if (options.noSignal) {
    return { flagged: false, starred: false };
  }

  return {
    flagged: options.flagged ? true : current.flagged,
    starred: options.starred ? true : current.starred,
  };
}

/**
 * Preserve trailing ID tokens when content changes.
 * @param original - Original content with potential ID.
 * @param updated - Updated content without ID.
 * @returns Updated content with ID preserved when present.
 */
export function preserveId(original: string, updated: string): string {
  const originalId = extractTrailingId(original);
  if (!originalId) {
    return updated;
  }
  const withoutId = stripTrailingId(updated);
  const trimmed = withoutId.trim();
  if (!trimmed) {
    return originalId;
  }
  return `${trimmed} ${originalId}`.trim();
}

function extractTrailingId(content: string | undefined): string | undefined {
  if (!content) {
    return;
  }
  const match = content.match(ID_TRAIL_REGEX);
  return match ? match[1] : undefined;
}

function stripTrailingId(content: string): string {
  return content.replace(ID_TRAIL_REGEX, "").trimEnd();
}

type RenderArgs = {
  record: WaymarkRecord;
  config: WaymarkConfig;
  type: string;
  signals: ModifySignals;
  content: string;
};

function renderFirstLine(args: RenderArgs): string {
  const { record, config, type, signals, content } = args;
  const indent = " ".repeat(record.indent);
  const leader = record.commentLeader ?? "//";
  const leaderSeparator = leader.length > 0 ? " " : "";

  const normalizedType = config.format.normalizeCase
    ? type.toLowerCase()
    : type;

  const signalPrefix = buildSignalPrefix(signals);
  const markerToken = `${signalPrefix}${normalizedType}`;
  const sigil = config.format.spaceAroundSigil ? ` ${SIGIL} ` : SIGIL;

  let rendered = `${indent}${leader}${leaderSeparator}${markerToken}${sigil}`;
  if (content.length > 0) {
    rendered += config.format.spaceAroundSigil ? content : `${content}`;
  }

  rendered = rendered.trimEnd();

  if (leader === "<!--") {
    return appendHtmlClosure(rendered, content.length > 0);
  }

  return rendered;
}

function buildSignalPrefix(signals: ModifySignals): string {
  let prefix = "";
  if (signals.flagged) {
    prefix += "~";
  }
  if (signals.starred) {
    prefix += "*";
  }
  return prefix;
}

function appendHtmlClosure(rendered: string, hasContent: boolean): string {
  if (hasContent) {
    return rendered.endsWith(" ") ? `${rendered}-->` : `${rendered} -->`;
  }
  return rendered.endsWith(" ")
    ? `${rendered.trimEnd()} -->`
    : `${rendered} -->`;
}

async function resolveTarget(
  context: CommandContext,
  targetArg: string | undefined,
  idOption?: string
): Promise<ModifyTarget> {
  if (targetArg && idOption) {
    throw ValidationError.fromMessage("Cannot specify both file:line and --id");
  }
  if (!(targetArg || idOption)) {
    throw ValidationError.fromMessage(
      "Must provide a target (file:line) or --id"
    );
  }

  if (idOption) {
    return await resolveTargetFromId(context.workspaceRoot, idOption);
  }

  if (!targetArg) {
    throw ValidationError.fromMessage(
      "Target argument is required when --id is not provided"
    );
  }

  return parseFileLineTarget(targetArg, {
    missingSeparator: `Invalid target format: ${targetArg}`,
    invalidLine: `Invalid line number in target: ${targetArg}`,
  });
}

async function resolveTargetFromId(
  workspaceRoot: string,
  id: string
): Promise<ModifyTarget> {
  const normalized = normalizeId(id);
  const index = new JsonIdIndex({ workspaceRoot });
  const entry = await index.get(normalized);
  if (!entry) {
    throw NotFoundError.create("waymark ID", normalized);
  }
  return {
    file: entry.file,
    line: entry.line,
    id: normalized,
  };
}

function normalizeId(id: string): string {
  // Already in [[hash]] or [[hash|alias]] format
  if (id.startsWith("[[") && id.endsWith("]]")) {
    return id;
  }
  return `[[${id}]]`;
}

// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: sequential prompt flow with per-step cancellation checks
async function runInteractiveSession(
  context: CommandContext,
  record: WaymarkRecord,
  baseContent: string,
  options: ModifyOptions
): Promise<ModifyOptions> {
  assertPromptAllowed("interactive editing");
  logger.info("Interactive mode: Press Ctrl+C to cancel.");

  const markers = resolveMarkerChoices(context.config, record.type);
  const answers: InteractiveAnswers = {};

  // Step 1: Select waymark type
  const typeResult = await promptSelect<string>({
    message: "Waymark type",
    options: markers.map((marker) => ({
      value: marker,
      label: marker,
    })),
    initialValue: record.type,
  });
  if (typeResult.isErr()) {
    throw new InteractiveCancelError();
  }
  answers.type = typeResult.value;

  // Step 2: Add flagged signal?
  const flaggedResult = await promptConfirm({
    message: "Add flagged signal (~)?",
    initialValue: record.signals.flagged ?? options.flagged ?? false,
  });
  if (flaggedResult.isErr()) {
    throw new InteractiveCancelError();
  }
  answers.addFlagged = flaggedResult.value;

  // Step 3: Add starred signal?
  const starredResult = await promptConfirm({
    message: "Add starred signal (*) to mark as important/valuable?",
    initialValue: record.signals.starred ?? options.starred ?? false,
  });
  if (starredResult.isErr()) {
    throw new InteractiveCancelError();
  }
  answers.addStarred = starredResult.value;

  // Step 4: Clear all signals?
  const clearSignalsResult = await promptConfirm({
    message: "Remove all signals?",
    initialValue: false,
  });
  if (clearSignalsResult.isErr()) {
    throw new InteractiveCancelError();
  }
  answers.clearSignals = clearSignalsResult.value;

  // Step 5: Update content?
  const updateContentResult = await promptConfirm({
    message: "Update content text?",
    initialValue: false,
  });
  if (updateContentResult.isErr()) {
    throw new InteractiveCancelError();
  }
  answers.updateContent = updateContentResult.value;

  // Step 6: New content (only if updating)
  if (answers.updateContent) {
    const contentResult = await promptText({
      message: "New content (leave blank to read from stdin)",
      defaultValue: stripTrailingId(baseContent),
    });
    if (contentResult.isErr()) {
      throw new InteractiveCancelError();
    }
    answers.content = contentResult.value;
  }

  // Step 7: Apply modifications?
  const applyResult = await promptConfirm({
    message: "Apply modifications (write to file)?",
    initialValue: options.write ?? false,
  });
  if (applyResult.isErr()) {
    throw new InteractiveCancelError();
  }
  answers.apply = applyResult.value;

  const nextOptions: ModifyOptions = {
    ...options,
    interactive: false,
  };
  const {
    type,
    clearSignals,
    addFlagged,
    addStarred,
    updateContent,
    content,
    apply,
  } = answers;

  if (type && type !== record.type) {
    nextOptions.type = type;
  }

  if (clearSignals) {
    nextOptions.noSignal = true;
  } else {
    if (addFlagged && !record.signals.flagged) {
      nextOptions.flagged = true;
    }
    if (addStarred && !record.signals.starred) {
      nextOptions.starred = true;
    }
  }

  if (updateContent) {
    const provided = content ?? "";
    nextOptions.content = provided.length === 0 ? "-" : provided;
  }

  if (apply) {
    nextOptions.write = true;
  }

  return nextOptions;
}

function resolveMarkerChoices(
  config: WaymarkConfig,
  currentType: string
): string[] {
  const markers = new Set<string>(
    (config.allowTypes.length > 0 ? config.allowTypes : DEFAULT_MARKERS).map(
      (marker) => marker.trim()
    )
  );
  if (currentType.trim()) {
    markers.add(currentType.trim());
  }
  return Array.from(markers.values()).sort((a, b) => a.localeCompare(b));
}

const TRAILING_NEWLINE_REGEX = /\r?\n$/;

/**
 * Resolve content input from flags or stdin.
 * @param options - Modify command options.
 * @param stdin - Readable stream for stdin input.
 * @returns Resolved content string, or undefined if not provided.
 */
export async function resolveContentInput(
  options: ModifyOptions,
  stdin: NodeJS.ReadableStream
): Promise<string | undefined> {
  if (options.content === undefined) {
    return;
  }
  if (options.content === "-") {
    const raw = await readStream(stdin);
    return raw.replace(TRAILING_NEWLINE_REGEX, "");
  }
  return options.content;
}

function ensureModificationsSpecified(options: ModifyOptions): void {
  const hasType = Boolean(options.type);
  const hasSignals = Boolean(
    options.flagged || options.starred || options.noSignal
  );
  const hasContent = options.content !== undefined;

  if (!(hasType || hasSignals || hasContent)) {
    throw ValidationError.fromMessage(
      "No modifications specified. Use --type, --flagged, --starred, --clear-signals, --content, or run without arguments for interactive prompts."
    );
  }
}

function buildUpdatedFileContent(
  lines: string[],
  newline: string,
  hasTrailingNewline: boolean
): string {
  let text = lines.join(newline);
  if (hasTrailingNewline && !text.endsWith(newline)) {
    text += newline;
  }
  return text;
}

type OutputArgs = {
  payload: ModifyPayload;
  options: ModifyOptions;
  record: WaymarkRecord;
  target: ModifyTarget;
};

function formatOutput(args: OutputArgs): string {
  const { payload, options, record, target } = args;

  if (options.json || options.jsonl) {
    const serialized = options.json
      ? JSON.stringify(payload, null, 2)
      : JSON.stringify(payload);
    return serialized;
  }

  const lines: string[] = [];
  const heading = payload.applied
    ? `Edited ${target.file}:${target.line}`
    : `Preview edit for ${target.file}:${target.line}`;
  lines.push(heading, "");
  lines.push("Before:");
  lines.push(`  ${formatLine(record.startLine, payload.before.raw)}`);
  lines.push("", "After:");
  lines.push(`  ${formatLine(record.startLine, payload.after.raw)}`);
  lines.push("", "Modifications:");
  const summaryLines = describeChanges(payload);
  for (const entry of summaryLines) {
    lines.push(`  - ${entry}`);
  }

  if (!(payload.applied || payload.noChange)) {
    lines.push("", "Run with --write to apply changes.");
  }

  if (payload.indexRefreshed) {
    lines.push("", `Index refreshed for ${target.file}.`);
  }

  return lines.join("\n");
}

const LINE_NUMBER_PADDING = 4;

function formatLine(lineNumber: number, content: string): string {
  return `${lineNumber.toString().padStart(LINE_NUMBER_PADDING, " ")} | ${content}`;
}

function describeChanges(payload: ModifyPayload): string[] {
  if (payload.noChange) {
    return ["No modifications required"];
  }
  const entries: string[] = [];
  if (payload.modifications.type) {
    entries.push(
      `Changed type: ${payload.modifications.type.from} → ${payload.modifications.type.to}`
    );
  }
  if (payload.modifications.signals) {
    const { from, to } = payload.modifications.signals;
    if (from.flagged !== to.flagged) {
      entries.push(
        to.flagged ? "Added flagged signal (~)" : "Removed flagged signal (~)"
      );
    }
    if (from.starred !== to.starred) {
      entries.push(
        to.starred ? "Added starred signal (*)" : "Removed starred signal (*)"
      );
    }
  }
  if (payload.modifications.content) {
    entries.push("Updated content");
  }
  return entries.length > 0 ? entries : ["No user-visible changes"];
}

function buildModificationSummary(
  previous: WaymarkRecord,
  applied: ApplyResult
): ModifyPayload["modifications"] {
  const summary: ModifyPayload["modifications"] = {};
  if (previous.type !== applied.type) {
    summary.type = { from: previous.type, to: applied.type };
  }
  if (
    previous.signals.flagged !== applied.signals.flagged ||
    previous.signals.starred !== applied.signals.starred
  ) {
    summary.signals = {
      from: {
        flagged: previous.signals.flagged,
        starred: previous.signals.starred,
      },
      to: {
        flagged: applied.signals.flagged,
        starred: applied.signals.starred,
      },
    };
  }

  const beforeFirstLine = previous.raw.split(LINE_SPLIT_REGEX)[0] ?? "";
  const beforeContent = extractFirstLineContent(beforeFirstLine);
  if (beforeContent !== applied.content) {
    summary.content = {
      from: beforeContent,
      to: applied.content,
    };
  }

  return summary;
}

async function updateIdIndex(
  context: CommandContext,
  target: ModifyTarget,
  id: string,
  applied: ApplyResult
): Promise<void> {
  const normalized = normalizeId(id);
  const index = new JsonIdIndex({ workspaceRoot: context.workspaceRoot });
  const existing = await index.get(normalized);
  await index.set({
    id: normalized,
    file: target.file,
    line: target.line,
    type: applied.type,
    content: applied.content,
    contentHash: fingerprintContent(applied.content),
    contextHash: fingerprintContext(
      `${target.file}:${target.line}:${applied.firstLine}`
    ),
    updatedAt: Date.now(),
    ...(existing?.source ? { source: existing.source } : {}),
    ...(existing?.sourceType ? { sourceType: existing.sourceType } : {}),
  });
}
