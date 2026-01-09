// tldr ::: edit command implementation for wm CLI

import { readFile, writeFile } from "node:fs/promises";
import readline from "node:readline";

import {
  fingerprintContent,
  fingerprintContext,
  JsonIdIndex,
  parse,
  SIGIL,
  type WaymarkConfig,
  type WaymarkRecord,
} from "@waymarks/core";
import inquirer from "inquirer";

import type { CommandContext } from "../types.ts";
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
  exitCode: number;
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

if (process.stdin.isTTY) {
  readline.emitKeypressEvents(process.stdin);
}

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

type StepName = keyof InteractiveAnswers;

type InteractiveStep = {
  name: StepName;
  shouldSkip?: (state: InteractiveAnswers) => boolean;
  build: (state: InteractiveAnswers) => Record<string, unknown>;
};

export async function runModifyCommand(
  context: CommandContext,
  targetArg: string | undefined,
  options: ModifyOptions,
  io: ModifyIo = DEFAULT_IO
): Promise<ModifyCommandResult> {
  const target = await resolveTarget(context, targetArg, options.id);
  const snapshot = await loadWaymarkSnapshot(target);
  const originalFirstLine = snapshot.lines[snapshot.lineIndex];
  if (!originalFirstLine) {
    throw new Error(`Line ${snapshot.lineIndex + 1} not found in file`);
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
          exitCode: 1,
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

  const exitCode = 0;
  return { output, payload, exitCode };
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
    throw new Error(`No waymark found at ${target.file}:${target.line}`);
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
    throw new Error("Waymark type cannot be empty");
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
    throw new Error("Cannot specify both file:line and --id");
  }
  if (!(targetArg || idOption)) {
    throw new Error("Must provide a target (file:line) or --id");
  }

  if (idOption) {
    return await resolveTargetFromId(context.workspaceRoot, idOption);
  }

  if (!targetArg) {
    throw new Error("Target argument is required when --id is not provided");
  }

  const parsed = parseFileLine(targetArg);
  return parsed;
}

function parseFileLine(value: string): ModifyTarget {
  const colonIndex = value.lastIndexOf(":");
  if (colonIndex === -1) {
    throw new Error(`Invalid target format: ${value}`);
  }
  const file = value.slice(0, colonIndex);
  const lineRaw = value.slice(colonIndex + 1);
  const line = Number.parseInt(lineRaw, 10);
  if (!Number.isFinite(line) || line <= 0) {
    throw new Error(`Invalid line number in target: ${value}`);
  }
  return { file, line };
}

async function resolveTargetFromId(
  workspaceRoot: string,
  id: string
): Promise<ModifyTarget> {
  const normalized = normalizeId(id);
  const index = new JsonIdIndex({ workspaceRoot });
  const entry = await index.get(normalized);
  if (!entry) {
    throw new Error(`Waymark ID ${normalized} not found in index`);
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

async function runInteractiveSession(
  context: CommandContext,
  record: WaymarkRecord,
  baseContent: string,
  options: ModifyOptions
): Promise<ModifyOptions> {
  assertPromptAllowed("interactive editing");
  logger.info(
    "Interactive mode: Backspace on an empty input to go back. Press Esc to cancel."
  );

  const markers = resolveMarkerChoices(context.config, record.type);
  const prompt = inquirer.createPromptModule();
  const answers: InteractiveAnswers = {};
  const steps = buildInteractiveSteps({
    answers,
    baseContent,
    markers,
    options,
    record,
  });
  await runInteractiveWizard(prompt, steps, answers);

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

function buildInteractiveSteps(args: {
  answers: InteractiveAnswers;
  baseContent: string;
  markers: string[];
  options: ModifyOptions;
  record: WaymarkRecord;
}): InteractiveStep[] {
  const { answers, baseContent, markers, options, record } = args;
  return [
    {
      name: "type",
      build: () => ({
        type: "list",
        name: "type",
        message: "Waymark type",
        choices: markers.map((marker) => ({
          name: marker,
          value: marker,
          short: marker,
        })),
        default: answers.type ?? record.type,
      }),
    },
    {
      name: "addFlagged",
      build: () => ({
        type: "confirm",
        name: "addFlagged",
        message: "Add flagged signal (~)?",
        default:
          answers.addFlagged ??
          record.signals.flagged ??
          options.flagged ??
          false,
      }),
    },
    {
      name: "addStarred",
      build: () => ({
        type: "confirm",
        name: "addStarred",
        message: "Add starred signal (*) to mark as important/valuable?",
        default:
          answers.addStarred ??
          record.signals.starred ??
          options.starred ??
          false,
      }),
    },
    {
      name: "clearSignals",
      build: () => ({
        type: "confirm",
        name: "clearSignals",
        message: "Remove all signals?",
        default: answers.clearSignals ?? false,
      }),
    },
    {
      name: "updateContent",
      build: () => ({
        type: "confirm",
        name: "updateContent",
        message: "Update content text?",
        default: answers.updateContent ?? false,
      }),
    },
    {
      name: "content",
      shouldSkip: (state) => !state.updateContent,
      build: () => ({
        type: "input",
        name: "content",
        message: "New content (leave blank to read from stdin)",
        default: answers.content ?? stripTrailingId(baseContent),
      }),
    },
    {
      name: "apply",
      build: () => ({
        type: "confirm",
        name: "apply",
        message: "Apply modifications (write to file)?",
        default: answers.apply ?? Boolean(options.write),
      }),
    },
  ];
}

async function runInteractiveWizard(
  promptModule: ReturnType<typeof inquirer.createPromptModule>,
  steps: InteractiveStep[],
  answers: InteractiveAnswers
): Promise<void> {
  let index = 0;
  while (index < steps.length) {
    const step = steps[index];
    if (!step) {
      break;
    }
    if (step.shouldSkip?.(answers)) {
      index += 1;
      continue;
    }

    const outcome = await promptStep(promptModule, step, answers);
    if (outcome.type === "cancel") {
      throw new InteractiveCancelError();
    }
    if (outcome.type === "back") {
      index = Math.max(index - 1, 0);
      continue;
    }
    Object.assign(answers, outcome.value);
    index += 1;
  }
}

type PromptOutcome =
  | { type: "answered"; value: Record<string, unknown> }
  | { type: "back" }
  | { type: "cancel" };

function getDefaultValueAsString(question: unknown): string {
  if (
    typeof question === "object" &&
    question !== null &&
    "default" in question
  ) {
    const defaultValue = (question as { default?: unknown }).default;
    return typeof defaultValue === "string" ? defaultValue : "";
  }
  return "";
}

type KeypressState = {
  buffer: string;
  requestedBack: boolean;
  requestedCancel: boolean;
};

function createKeypressHandler(
  state: KeypressState,
  isTextInput: boolean,
  runner: { abortController: AbortController }
) {
  const appendIfPrintable = (key?: {
    sequence?: string;
    ctrl?: boolean;
    meta?: boolean;
  }) => {
    if (!(isTextInput && key) || key.ctrl || key.meta) {
      return;
    }
    const { sequence } = key;
    if (!sequence || sequence.length === 0) {
      return;
    }
    state.buffer += sequence;
  };

  return (
    _chunk: string,
    key?: { name?: string; sequence?: string; ctrl?: boolean; meta?: boolean }
  ) => {
    const keyName = key?.name;

    if (keyName === "escape") {
      state.requestedCancel = true;
      runner.abortController.abort("cancelled");
      return;
    }
    if (keyName === "backspace") {
      if (!isTextInput || state.buffer.length === 0) {
        state.requestedBack = true;
        runner.abortController.abort("back");
        return;
      }
      state.buffer = state.buffer.slice(0, -1);
      return;
    }
    if (isTextInput && (keyName === "return" || keyName === "enter")) {
      state.buffer = "";
      return;
    }

    appendIfPrintable(key);
  };
}

function resolvePromptAbortOutcome(
  error: unknown,
  state: KeypressState
): PromptOutcome | undefined {
  if (
    !(error instanceof Error) ||
    (error.name !== "AbortPromptError" && error.name !== "ExitPromptError")
  ) {
    return;
  }

  if (state.requestedCancel) {
    return { type: "cancel" };
  }
  if (state.requestedBack) {
    return { type: "back" };
  }
  return;
}

async function promptStep(
  promptModule: ReturnType<typeof inquirer.createPromptModule>,
  step: InteractiveStep,
  answers: InteractiveAnswers
): Promise<PromptOutcome> {
  const question = step.build(answers);
  // biome-ignore lint/suspicious/noExplicitAny: prompt typing requires cast
  const ticket = promptModule([question as any], answers);
  const runner = (
    ticket as unknown as {
      ui: { abortController: AbortController };
    }
  ).ui;

  const isTextInput = isInputQuestion(question);

  // Initialize buffer with default value to allow editing pre-filled content
  const state: KeypressState = {
    buffer: isTextInput ? getDefaultValueAsString(question) : "",
    requestedBack: false,
    requestedCancel: false,
  };

  const stdin = process.stdin;
  const hasTty = Boolean(stdin?.isTTY);
  const onKeypress = createKeypressHandler(state, isTextInput, runner);

  if (hasTty) {
    stdin.on("keypress", onKeypress);
  }

  try {
    const result = await ticket;
    return { type: "answered", value: result };
  } catch (error) {
    const outcome = resolvePromptAbortOutcome(error, state);
    if (outcome) {
      return outcome;
    }
    throw error;
  } finally {
    if (hasTty) {
      stdin.removeListener("keypress", onKeypress);
    }
  }
}

function isInputQuestion(question: unknown): boolean {
  return (
    typeof question === "object" &&
    question !== null &&
    "type" in question &&
    question.type === "input"
  );
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
    throw new Error(
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
