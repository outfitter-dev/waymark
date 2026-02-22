// tldr ::: edit waymarks in place while preserving IDs and formatting

import { existsSync } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";

import { parse, SIGIL, type WaymarkRecord } from "@waymarks/grammar";
import { z } from "zod";

import {
  InternalError,
  NotFoundError,
  Result,
  ValidationError,
  type WaymarkResult,
} from "./errors.ts";
import { formatText } from "./format.ts";
import {
  fingerprintContent,
  fingerprintContext,
  type WaymarkIdManager,
} from "./ids.ts";
import type { CoreLogger, WaymarkConfig } from "./types.ts";

const LINE_SPLIT_REGEX = /\r?\n/;
const CARRIAGE_RETURN_REGEX = /\r$/;
const HTML_COMMENT_LEADER = "<!--";
const HTML_COMMENT_CLOSE_REGEX = /\s*--!?>\s*$/;
const CONTEXT_BEFORE_LINES = 2;
const CONTEXT_AFTER_LINES = 3;

/** Zod schema for validating edit inputs. */
export const EditSpecSchema = z
  .object({
    file: z.string().min(1).optional(),
    line: z.number().int().positive().optional(),
    id: z.string().trim().min(1).optional(),
    type: z.string().trim().min(1).optional(),
    content: z.string().optional(),
    flagged: z.boolean().optional(),
    starred: z.boolean().optional(),
    clearSignals: z.boolean().optional(),
    write: z.boolean().optional(),
  })
  .refine(
    (data) => {
      const hasId = Boolean(data.id);
      const hasFileLine =
        typeof data.file === "string" && typeof data.line === "number";
      return hasId || hasFileLine;
    },
    {
      message: "Must provide a target via id or file + line",
      path: ["file"],
    }
  )
  .refine(
    (data) => {
      const hasId = Boolean(data.id);
      const hasFileLine =
        typeof data.file === "string" && typeof data.line === "number";
      return !(hasId && hasFileLine);
    },
    { message: "Cannot specify both id and file + line", path: ["id"] }
  )
  .refine(
    (data) =>
      data.type !== undefined ||
      data.content !== undefined ||
      data.flagged !== undefined ||
      data.starred !== undefined ||
      data.clearSignals === true,
    {
      message:
        "Must provide at least one modification (type, content, signals)",
      path: ["type"],
    }
  );

/** Validated edit specification for a waymark record. */
export type EditSpec = z.infer<typeof EditSpecSchema>;

/** Options for editing a waymark, including optional ID management. */
export type EditOptions = EditSpec & {
  idManager?: WaymarkIdManager;
  logger?: CoreLogger;
};

/** Result of applying edits to a waymark in a file. */
export type EditResult = {
  file: string;
  before: WaymarkRecord;
  after: WaymarkRecord;
  written: boolean;
};

type FileSnapshot = {
  text: string;
  lines: string[];
  eol: string;
  endsWithFinalEol: boolean;
  records: WaymarkRecord[];
};

type ResolvedTarget = {
  file: string;
  line: number;
  id?: string;
};

/** Validated context for applying an edit to a waymark. */
type EditContext = {
  spec: EditSpec;
  target: ResolvedTarget;
  snapshot: FileSnapshot;
  record: WaymarkRecord;
  originalContent: string;
  existingId: string | undefined;
  nextType: string;
};

/**
 * Edit a waymark in place, optionally writing changes to disk.
 * @param options - Edit request options and optional ID manager/logger.
 * @param config - Optional configuration overrides for formatting.
 * @returns Result containing the applied edit or a domain error.
 */
export async function editWaymark(
  options: EditOptions,
  config?: WaymarkConfig
): Promise<WaymarkResult<EditResult>> {
  const contextResult = await resolveEditContext(options);
  if (contextResult.isErr()) {
    return contextResult;
  }
  const ctx = contextResult.value;

  return applyEdit(ctx, options, config);
}

async function resolveEditContext(
  options: EditOptions
): Promise<WaymarkResult<EditContext>> {
  const parsed = EditSpecSchema.safeParse({
    file: options.file,
    line: options.line,
    id: options.id,
    type: options.type,
    content: options.content,
    flagged: options.flagged,
    starred: options.starred,
    clearSignals: options.clearSignals,
    write: options.write,
  });
  if (!parsed.success) {
    return Result.err(
      ValidationError.fromMessage(
        parsed.error.issues[0]?.message ?? "Invalid edit specification"
      )
    );
  }
  const spec = parsed.data;

  const targetResult = await resolveTarget(spec, options.idManager);
  if (targetResult.isErr()) {
    return targetResult;
  }
  const target = targetResult.value;

  options.logger?.debug("Editing waymark", {
    file: target.file,
    line: target.line,
    id: target.id,
  });

  const snapshot = await loadFileSnapshot(target.file);
  if (!snapshot) {
    return Result.err(
      NotFoundError.create("file", target.file, {
        reason: "File not found",
      })
    );
  }

  const recordResult = resolveRecordContext(snapshot, target);
  if (recordResult.isErr()) {
    return recordResult;
  }
  const { record, originalContent, existingId } = recordResult.value;

  const idMatchResult = assertIdMatches({
    targetId: target.id,
    existingId,
    file: target.file,
    line: record.startLine,
  });
  if (idMatchResult.isErr()) {
    return idMatchResult;
  }

  const typeResult = resolveType(record.type, spec.type);
  if (typeResult.isErr()) {
    return typeResult;
  }

  return Result.ok({
    spec,
    target,
    snapshot,
    record,
    originalContent,
    existingId,
    nextType: typeResult.value,
  });
}

async function applyEdit(
  ctx: EditContext,
  options: EditOptions,
  config?: WaymarkConfig
): Promise<WaymarkResult<EditResult>> {
  const { spec, target, snapshot, record, originalContent, existingId } = ctx;

  const signalOverrides = {
    flagged: spec.flagged,
    starred: spec.starred,
    clearSignals: spec.clearSignals,
  };
  const nextSignals = resolveSignals(record.signals, signalOverrides);

  const draftLines = buildDraftLines({
    record,
    spec,
    existingId,
    originalContent,
    type: ctx.nextType,
    signals: nextSignals,
  });

  const { updatedText, updatedLines, written } = await applyDraftEdits({
    snapshot,
    record,
    draftLines,
    file: target.file,
    config,
    write: spec.write,
  });

  const afterResult = resolveUpdatedRecord({
    updatedText,
    file: target.file,
    record,
    existingId,
    targetId: target.id,
  });
  if (afterResult.isErr()) {
    return afterResult;
  }
  const afterRecord = afterResult.value;

  if (written && options.idManager && (existingId || target.id)) {
    const normalizedId = normalizeId(existingId ?? target.id ?? "");
    const indexResult = await updateIdIndex({
      idManager: options.idManager,
      id: normalizedId,
      record: afterRecord,
      lines: updatedLines,
      file: target.file,
    });
    if (indexResult.isErr()) {
      return indexResult;
    }
  }

  return Result.ok({
    file: target.file,
    before: record,
    after: afterRecord,
    written,
  });
}

function resolveRecordContext(
  snapshot: FileSnapshot,
  target: ResolvedTarget
): WaymarkResult<{
  record: WaymarkRecord;
  originalContent: string;
  existingId: string | undefined;
}> {
  const record = resolveRecord(snapshot.records, target);
  if (!record) {
    return Result.err(
      NotFoundError.create("waymark", `${target.file}:${target.line}`, {
        reason: "No waymark found at target location",
      })
    );
  }

  const originalLines = record.raw.split(LINE_SPLIT_REGEX);
  const firstLine = originalLines[0] ?? "";
  const originalContent = stripHtmlClosure(
    extractFirstLineContent(firstLine),
    record.commentLeader
  );
  const existingId = extractExistingId(record.contentText);

  return Result.ok({ record, originalContent, existingId });
}

function assertIdMatches(args: {
  targetId: string | undefined;
  existingId: string | undefined;
  file: string;
  line: number;
}): WaymarkResult<void> {
  const { targetId, existingId, file, line } = args;
  if (!targetId) {
    return Result.ok(undefined);
  }
  const normalizedTargetId = normalizeId(targetId);
  if (!existingId) {
    return Result.err(
      NotFoundError.create("waymark", normalizedTargetId, {
        file,
        line,
        reason: "Waymark id not found at target location",
      })
    );
  }
  const normalizedExisting = normalizeId(existingId);
  if (normalizedExisting !== normalizedTargetId) {
    return Result.err(
      ValidationError.fromMessage(`Waymark id mismatch at ${file}:${line}`, {
        expected: normalizedTargetId,
        actual: normalizedExisting,
      })
    );
  }
  return Result.ok(undefined);
}

function buildDraftLines(args: {
  record: WaymarkRecord;
  spec: EditSpec;
  existingId: string | undefined;
  originalContent: string;
  type: string;
  signals: WaymarkRecord["signals"];
}): string[] {
  if (args.spec.content !== undefined) {
    return buildLinesFromContent({
      record: args.record,
      type: args.type,
      signals: args.signals,
      content: applyIdToContent(
        args.spec.content ?? "",
        args.existingId,
        args.record.commentLeader
      ),
    });
  }

  return buildLinesFromExisting({
    record: args.record,
    type: args.type,
    signals: args.signals,
    content: args.originalContent,
  });
}

async function applyDraftEdits(args: {
  snapshot: FileSnapshot;
  record: WaymarkRecord;
  draftLines: string[];
  config: WaymarkConfig | undefined;
  file: string;
  write: boolean | undefined;
}): Promise<{
  updatedText: string;
  updatedLines: string[];
  written: boolean;
}> {
  const draftText = args.draftLines.join("\n");
  const formatOptions = {
    file: args.file,
    ...(args.config === undefined ? {} : { config: args.config }),
  };
  const { formattedText } = formatText(draftText, formatOptions);
  const formattedLines = formattedText.split(LINE_SPLIT_REGEX);

  const updatedLines = [...args.snapshot.lines];
  const startIndex = args.record.startLine - 1;
  const removeCount = args.record.endLine - args.record.startLine + 1;
  updatedLines.splice(startIndex, removeCount, ...formattedLines);

  const updatedText = buildFileText(
    updatedLines,
    args.snapshot.eol,
    args.snapshot.endsWithFinalEol
  );

  const changed = updatedText !== args.snapshot.text;
  const written = Boolean(args.write && changed);

  if (written) {
    await writeFile(args.file, updatedText, "utf8");
  }

  return { updatedText, updatedLines, written };
}

function resolveUpdatedRecord(args: {
  updatedText: string;
  file: string;
  record: WaymarkRecord;
  existingId: string | undefined;
  targetId: string | undefined;
}): WaymarkResult<WaymarkRecord> {
  const updatedRecords = parse(args.updatedText, { file: args.file });
  const resolvedId = args.existingId ?? args.targetId;
  const afterRecord = resolveRecord(updatedRecords, {
    file: args.file,
    line: args.record.startLine,
    ...(resolvedId === undefined ? {} : { id: resolvedId }),
  });
  if (!afterRecord) {
    return Result.err(
      InternalError.create(
        `Failed to resolve updated waymark at ${args.file}:${args.record.startLine}`
      )
    );
  }
  return Result.ok(afterRecord);
}

async function resolveTarget(
  spec: EditSpec,
  idManager?: WaymarkIdManager
): Promise<WaymarkResult<ResolvedTarget>> {
  if (spec.id) {
    if (!idManager) {
      return Result.err(
        ValidationError.fromMessage("ID-based edits require an ID manager")
      );
    }
    const normalized = normalizeId(spec.id);
    const entry = await idManager.get(normalized);
    if (!entry) {
      return Result.err(
        NotFoundError.create("waymark", normalized, {
          reason: "Unknown waymark id",
        })
      );
    }
    return Result.ok({ file: entry.file, line: entry.line, id: normalized });
  }

  if (!spec.file || typeof spec.line !== "number") {
    return Result.err(
      ValidationError.fromMessage(
        "File and line are required for line-based edits"
      )
    );
  }

  return Result.ok({ file: spec.file, line: spec.line });
}

async function loadFileSnapshot(file: string): Promise<FileSnapshot | null> {
  if (!existsSync(file)) {
    return null;
  }

  const text = await readFile(file, "utf8");
  const eol = text.includes("\r\n") ? "\r\n" : "\n";
  const endsWithFinalEol = text.endsWith(eol);
  const lines = text.split(LINE_SPLIT_REGEX);
  if (lines.length > 0 && lines.at(-1) === "") {
    lines.pop();
  }
  const records = parse(text, { file });
  return { text, lines, eol, endsWithFinalEol, records };
}

function resolveRecord(
  records: WaymarkRecord[],
  target: ResolvedTarget
): WaymarkRecord | undefined {
  if (target.id) {
    const byId = findRecordById(records, target.id);
    if (byId) {
      return byId;
    }
  }
  return findRecordByLine(records, target.line);
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
  const normalized = normalizeId(id);
  return records.find((record) => record.raw.includes(normalized));
}

function resolveType(
  current: string,
  override?: string
): WaymarkResult<string> {
  if (override === undefined) {
    return Result.ok(current);
  }
  const trimmed = override.trim();
  if (!trimmed) {
    return Result.err(
      ValidationError.create("type", "Waymark type cannot be empty")
    );
  }
  return Result.ok(trimmed);
}

// `current` mirrors the flagged signal unless we are explicitly clearing signals,
// so the active display state stays aligned with the persisted flagged flag.
function resolveSignals(
  current: WaymarkRecord["signals"],
  overrides: {
    flagged: boolean | undefined;
    starred: boolean | undefined;
    clearSignals: boolean | undefined;
  }
): WaymarkRecord["signals"] {
  if (overrides.clearSignals) {
    return { ...current, flagged: false, starred: false, current: false };
  }

  const nextFlagged =
    overrides.flagged !== undefined ? overrides.flagged : current.flagged;
  const nextStarred =
    overrides.starred !== undefined ? overrides.starred : current.starred;

  return {
    ...current,
    flagged: nextFlagged,
    starred: nextStarred,
    current: nextFlagged,
  };
}

function buildLinesFromExisting(args: {
  record: WaymarkRecord;
  type: string;
  signals: WaymarkRecord["signals"];
  content: string;
}): string[] {
  const originalLines = args.record.raw.split(LINE_SPLIT_REGEX);
  const header = renderHeaderLine({
    record: args.record,
    type: args.type,
    signals: args.signals,
    content: args.content,
  });
  const lines = [header, ...originalLines.slice(1)];
  if (args.record.commentLeader === HTML_COMMENT_LEADER) {
    ensureHtmlClosure(lines);
  }
  return lines;
}

function buildLinesFromContent(args: {
  record: WaymarkRecord;
  type: string;
  signals: WaymarkRecord["signals"];
  content: string;
}): string[] {
  const segments = splitContentSegments(args.content);
  const [firstSegment = "", ...continuations] = segments;
  const header = renderHeaderLine({
    record: args.record,
    type: args.type,
    signals: args.signals,
    content: firstSegment,
  });
  const lines = [
    header,
    ...continuations.map((segment) =>
      renderContinuationLine(args.record, segment)
    ),
  ];

  if (args.record.commentLeader === HTML_COMMENT_LEADER) {
    ensureHtmlClosure(lines);
  }

  return lines;
}

function splitContentSegments(content: string): string[] {
  const trimmed = content.trim();
  if (!trimmed) {
    return [""];
  }
  return trimmed.split(LINE_SPLIT_REGEX);
}

function renderHeaderLine(args: {
  record: WaymarkRecord;
  type: string;
  signals: WaymarkRecord["signals"];
  content: string;
}): string {
  const leader = args.record.commentLeader ?? "//";
  const indent = " ".repeat(args.record.indent);
  const leaderSeparator = leader.length > 0 ? " " : "";
  const signalPrefix = buildSignalPrefix(args.signals);
  const markerToken = `${signalPrefix}${args.type}`.trim();
  const content = args.content.trim();
  let line = `${indent}${leader}${leaderSeparator}${markerToken} ${SIGIL}`;
  if (content.length > 0) {
    line += ` ${content}`;
  }
  return line.trimEnd();
}

function renderContinuationLine(
  record: WaymarkRecord,
  content: string
): string {
  const leader = record.commentLeader ?? "//";
  const indent = " ".repeat(record.indent);
  const leaderSeparator = leader.length > 0 ? " " : "";
  const trimmed = content.trim();
  let line = `${indent}${leader}${leaderSeparator}${SIGIL}`;
  if (trimmed.length > 0) {
    line += ` ${trimmed}`;
  }
  return line.trimEnd();
}

function buildSignalPrefix(signals: WaymarkRecord["signals"]): string {
  let prefix = "";
  if (signals.flagged) {
    prefix += "~";
  }
  if (signals.starred) {
    prefix += "*";
  }
  return prefix;
}

function extractFirstLineContent(firstLine: string): string {
  const sigilIndex = firstLine.indexOf(SIGIL);
  if (sigilIndex === -1) {
    return "";
  }
  const after = firstLine.slice(sigilIndex + SIGIL.length);
  const trimmedStart = after.trimStart();
  return trimmedStart.replace(CARRIAGE_RETURN_REGEX, "");
}

function stripHtmlClosure(
  content: string,
  commentLeader: string | null
): string {
  if (commentLeader === HTML_COMMENT_LEADER) {
    return content.replace(HTML_COMMENT_CLOSE_REGEX, "");
  }
  return content;
}

// Match [[hash]], [[hash|alias]], or [[Draft Title]] (draft IDs with spaces/uppercase)
const ID_REGEX = /\[\[([^\]]+)\]\]/gi;
const ID_TRAIL_REGEX = /(\[\[[^\]]+\]\])$/i;

function extractExistingId(content: string): string | undefined {
  const matches = content.match(ID_REGEX);
  if (!matches || matches.length === 0) {
    return;
  }
  return matches.at(-1);
}

function stripTrailingId(content: string): string {
  return content.replace(ID_TRAIL_REGEX, "").trimEnd();
}

function applyIdToContent(
  content: string,
  existingId: string | undefined,
  commentLeader: string | null
): string {
  const trimmed = stripHtmlClosure(content, commentLeader).trim();
  if (!existingId) {
    return trimmed;
  }

  const segments = splitContentSegments(trimmed);
  const first = stripTrailingId(segments[0] ?? "").trimEnd();
  segments[0] = first.length > 0 ? `${first} ${existingId}` : existingId;
  return segments.join("\n").trimEnd();
}

function ensureHtmlClosure(lines: string[]): void {
  if (lines.length === 0) {
    return;
  }
  const lastIndex = lines.length - 1;
  const line = lines[lastIndex]?.trimEnd() ?? "";
  if (HTML_COMMENT_CLOSE_REGEX.test(line)) {
    return;
  }
  lines[lastIndex] = line.endsWith(" ") ? `${line}-->` : `${line} -->`;
}

function normalizeId(id: string): string {
  // Already in [[hash]] or [[hash|alias]] format
  if (id.startsWith("[[") && id.endsWith("]]")) {
    return id;
  }
  return `[[${id}]]`;
}

function buildFileText(
  lines: string[],
  eol: string,
  endsWithFinalEol: boolean
): string {
  const joined = lines.join(eol);
  const suffix = endsWithFinalEol && lines.length > 0 ? eol : "";
  return joined + suffix;
}

function buildContextWindow(lines: string[], lineIndex: number): string {
  const start = Math.max(0, lineIndex - CONTEXT_BEFORE_LINES);
  const end = Math.min(lines.length, lineIndex + CONTEXT_AFTER_LINES + 1);
  return lines.slice(start, end).join("\n");
}

async function updateIdIndex(args: {
  idManager: WaymarkIdManager;
  id: string;
  record: WaymarkRecord;
  lines: string[];
  file: string;
}): Promise<WaymarkResult<void>> {
  const { idManager, id, record, lines, file } = args;
  const existing = await idManager.get(id);
  if (!existing) {
    return Result.err(
      NotFoundError.create("waymark", id, {
        reason: "Unknown waymark id during index update",
      })
    );
  }

  const contextWindow = buildContextWindow(lines, record.startLine - 1);
  const updateResult = await idManager.updateLocation(id, {
    file,
    line: record.startLine,
    type: record.type,
    content: record.contentText,
    contentHash: fingerprintContent(record.contentText),
    contextHash: fingerprintContext(contextWindow),
    ...(existing.source ? { source: existing.source } : {}),
    ...(existing.sourceType ? { sourceType: existing.sourceType } : {}),
  });
  if (updateResult.isErr()) {
    return Result.err(
      InternalError.create(updateResult.error.message, {
        cause: updateResult.error,
      })
    );
  }
  return Result.ok(undefined);
}
