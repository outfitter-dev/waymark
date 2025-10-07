// tldr ::: core waymark insertion helpers used by the CLI and automation hooks

import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, extname } from "node:path";
import { z } from "zod";
import {
  fingerprintContent,
  fingerprintContext,
  type WaymarkIdManager,
  type WaymarkIdMetadata,
} from "./ids.ts";
import type { CoreLogger, WaymarkConfig } from "./types.ts";

const LINE_SPLIT_REGEX = /\r?\n/;
const LEADING_WHITESPACE_REGEX = /^(\s+)/;
const CONTEXT_BEFORE_LINES = 2;
const CONTEXT_AFTER_LINES = 3;
const DEFAULT_EOL = "\n";

// Define the Zod schema for InsertionSpec
export const InsertionSpecSchema = z.object({
  file: z.string().min(1, "File path is required"),
  line: z.number().int().positive("Line must be a positive integer"),
  position: z.enum(["before", "after"]).optional(),
  type: z.string().min(1, "Waymark type is required"),
  content: z.string(),
  signals: z
    .object({
      raised: z.boolean().optional(),
      important: z.boolean().optional(),
    })
    .strict()
    .optional(),
  properties: z.record(z.string(), z.string()).optional(),
  tags: z.array(z.string()).optional(),
  mentions: z.array(z.string()).optional(),
  order: z.number().optional(),
  continuations: z.array(z.string()).optional(),
  id: z.string().optional(),
});

// Infer the type from the schema for consistency
export type InsertionSpec = z.infer<typeof InsertionSpecSchema>;

export type InsertionResult = {
  file: string;
  requested: {
    line: number;
    position: "before" | "after";
  };
  inserted?: {
    line: number;
    content: string;
    id?: string;
  };
  status: "success" | "error";
  error?: string;
};

export type InsertOptions = {
  write?: boolean;
  format?: boolean;
  config?: WaymarkConfig;
  idManager?: WaymarkIdManager;
  logger?: CoreLogger;
};

export async function insertWaymarks(
  specs: InsertionSpec[],
  options: InsertOptions = {}
): Promise<InsertionResult[]> {
  if (specs.length === 0) {
    return [];
  }
  const grouped = groupByFile(specs);
  const results: InsertionResult[] = [];

  for (const [file, fileSpecs] of grouped) {
    const fileResults = await processFileGroup(file, fileSpecs, options);
    results.push(...fileResults);
  }

  return results;
}

type FileProcessingContext = {
  file: string;
  lines: string[];
  commentLeader: string;
  originalEol: string;
  options: InsertOptions;
};

async function processFileGroup(
  file: string,
  specs: InsertionSpec[],
  options: InsertOptions
): Promise<InsertionResult[]> {
  options.logger?.debug("Processing file group", {
    file,
    specCount: specs.length,
  });

  const existing = await readLines(file);
  if (!existing) {
    options.logger?.debug("File not found", { file });
    return specs.map((spec) =>
      errorResult(file, spec, `File not found: ${file}`)
    );
  }

  const { lines, originalEol } = existing;
  options.logger?.debug("Read file", {
    file,
    lineCount: lines.length,
  });

  const context: FileProcessingContext = {
    file,
    lines,
    commentLeader: detectCommentLeader(file),
    originalEol,
    options,
  };

  const results: InsertionResult[] = [];
  const sorted = sortSpecsForInsertion(specs);
  for (const spec of sorted) {
    const result = await applyInsertion(spec, context);
    results.push(result);
  }

  if (options.write) {
    const successCount = results.filter((r) => r.status === "success").length;
    options.logger?.info("Writing waymarks to file", {
      file,
      insertedCount: successCount,
    });
    await writeUpdatedFile(context);
  } else {
    options.logger?.debug("Dry-run mode, skipping write", { file });
  }

  return results;
}

function sortSpecsForInsertion(specs: InsertionSpec[]): InsertionSpec[] {
  return specs
    .map((spec, index) => ({ spec, index }))
    .sort((a, b) => {
      if (a.spec.line === b.spec.line) {
        const orderA = a.spec.order ?? Number.MAX_SAFE_INTEGER;
        const orderB = b.spec.order ?? Number.MAX_SAFE_INTEGER;
        if (orderA !== orderB) {
          return orderB - orderA;
        }
        return a.index - b.index;
      }
      return b.spec.line - a.spec.line;
    })
    .map((entry) => entry.spec);
}

async function applyInsertion(
  spec: InsertionSpec,
  context: FileProcessingContext
): Promise<InsertionResult> {
  const insertPos = calculateInsertPosition(spec, context.lines.length);
  if (insertPos === null) {
    return errorResult(
      context.file,
      spec,
      `Line ${spec.line} out of bounds (file has ${context.lines.length} lines)`
    );
  }

  const referenceIndex = calculateReferenceIndex(
    spec.line,
    context.lines.length
  );
  const indentWidth = detectIndentWidth(context.lines, referenceIndex);
  const reservedId = await reserveIdIfNeeded(spec, context);
  const resolvedId = reservedId ?? spec.id;
  const formatted = formatWaymark(
    spec,
    context.commentLeader,
    indentWidth,
    resolvedId
  );

  context.lines.splice(insertPos, 0, formatted.header);
  if (formatted.continuations.length > 0) {
    context.lines.splice(insertPos + 1, 0, ...formatted.continuations);
  }

  const insertedLine = insertPos + 1;
  const contextWindow = buildContextWindow(context.lines, insertedLine - 1);
  await commitReservedIdIfNeeded({
    reservedId,
    spec,
    formattedHeader: formatted.header,
    insertedLine,
    context,
    contextWindow,
  });

  const insertedInfo: { line: number; content: string; id?: string } = {
    line: insertedLine,
    content: formatted.header,
  };
  if (resolvedId) {
    insertedInfo.id = resolvedId;
  }

  return {
    file: context.file,
    requested: { line: spec.line, position: spec.position ?? "after" },
    inserted: insertedInfo,
    status: "success",
  };
}

function calculateInsertPosition(
  spec: InsertionSpec,
  lineCount: number
): number | null {
  const position = spec.position === "before" ? spec.line - 1 : spec.line;
  if (position < 0 || position > lineCount) {
    return null;
  }
  return position;
}

function calculateReferenceIndex(line: number, lineCount: number): number {
  return Math.min(Math.max(line - 1, 0), Math.max(lineCount - 1, 0));
}

async function reserveIdIfNeeded(
  spec: InsertionSpec,
  context: FileProcessingContext
): Promise<string | undefined> {
  if (!(context.options.write && context.options.idManager)) {
    return;
  }

  const metadata: WaymarkIdMetadata = {
    file: context.file,
    line: spec.line,
    type: spec.type,
    content: spec.content,
    contentHash: fingerprintContent(spec.content),
    contextHash: fingerprintContext(`${context.file}:${spec.line}`),
    sourceType: "cli",
  };
  if (spec.properties?.owner) {
    metadata.source = spec.properties.owner;
  }

  const reservedId = await context.options.idManager.reserveId(
    metadata,
    spec.id
  );
  if (reservedId) {
    context.options.logger?.debug("Reserved waymark ID", {
      id: reservedId,
      file: context.file,
      line: spec.line,
    });
  }

  return reservedId;
}

async function commitReservedIdIfNeeded(args: {
  reservedId: string | undefined;
  spec: InsertionSpec;
  formattedHeader: string;
  insertedLine: number;
  context: FileProcessingContext;
  contextWindow: string;
}): Promise<void> {
  const {
    reservedId,
    spec,
    formattedHeader,
    insertedLine,
    context,
    contextWindow,
  } = args;
  if (!(reservedId && context.options.write && context.options.idManager)) {
    return;
  }

  const metadata: WaymarkIdMetadata = {
    file: context.file,
    line: insertedLine,
    type: spec.type,
    content: formattedHeader,
    contentHash: fingerprintContent(formattedHeader),
    contextHash: fingerprintContext(contextWindow),
    sourceType: "cli",
  };
  if (spec.properties?.owner) {
    metadata.source = spec.properties.owner;
  }

  await context.options.idManager.commitReservedId(reservedId, metadata);
}

async function writeUpdatedFile(context: FileProcessingContext): Promise<void> {
  const eol = context.originalEol ?? DEFAULT_EOL;
  const text = context.lines.join(eol);
  await ensureDirectory(context.file);
  const suffix = text.endsWith(eol) ? "" : eol;
  await writeFile(context.file, text + suffix, "utf8");
}

function groupByFile(specs: InsertionSpec[]): Map<string, InsertionSpec[]> {
  const map = new Map<string, InsertionSpec[]>();
  for (const spec of specs) {
    const list = map.get(spec.file) ?? [];
    list.push(spec);
    map.set(spec.file, list);
  }
  return map;
}

function errorResult(
  file: string,
  spec: InsertionSpec,
  message: string
): InsertionResult {
  return {
    file,
    requested: { line: spec.line, position: spec.position ?? "after" },
    status: "error",
    error: message,
  };
}

type ReadLinesResult = { lines: string[]; originalEol: string } | null;

async function readLines(path: string): Promise<ReadLinesResult> {
  if (!existsSync(path)) {
    return null;
  }
  const text = await readFile(path, "utf8");
  if (text.length === 0) {
    return { lines: [], originalEol: DEFAULT_EOL };
  }
  const eol = text.includes("\r\n") ? "\r\n" : DEFAULT_EOL;
  const lines = text.split(LINE_SPLIT_REGEX);
  if (lines.length > 0 && lines.at(-1) === "") {
    lines.pop();
  }
  return { lines, originalEol: eol };
}

function detectCommentLeader(file: string): string {
  const ext = extname(file).toLowerCase();
  switch (ext) {
    case ".ts":
    case ".tsx":
    case ".js":
    case ".jsx":
    case ".c":
    case ".cpp":
    case ".rs":
    case ".java":
      return "//";
    case ".py":
    case ".sh":
    case ".rb":
    case ".yaml":
    case ".yml":
    case ".toml":
    case ".ini":
      return "#";
    case ".md":
    case ".mdx":
      return "<!--";
    default:
      return "//";
  }
}

function formatWaymark(
  spec: InsertionSpec,
  commentLeader: string,
  indentWidth: number,
  resolvedId?: string
): { header: string; continuations: string[]; id?: string } {
  const indent = indentWidth > 0 ? " ".repeat(indentWidth) : "";
  const { leader, suffix } = resolveCommentLeader(commentLeader);
  const body = buildWaymarkBody(spec, resolvedId);
  const header = `${indent}${leader} ${body}${suffix}`;
  const continuations = formatContinuationLines(spec, commentLeader, indent);

  const result: { header: string; continuations: string[]; id?: string } = {
    header,
    continuations,
  };

  if (resolvedId) {
    result.id = resolvedId;
  }

  return result;
}

function buildSignals(signals: InsertionSpec["signals"]): string {
  if (!signals) {
    return "";
  }
  let result = "";
  if (signals.raised) {
    result += "^";
  }
  if (signals.important) {
    result += "*";
  }
  return result;
}

function resolveCommentLeader(commentLeader: string): {
  leader: string;
  suffix: string;
} {
  if (commentLeader === "<!--") {
    return { leader: "<!--", suffix: " -->" };
  }
  return { leader: commentLeader, suffix: "" };
}

function buildWaymarkBody(spec: InsertionSpec, resolvedId?: string): string {
  const signals = buildSignals(spec.signals);
  const parts: string[] = [`${signals}${spec.type} ::: ${spec.content}`.trim()];

  const properties = formatProperties(spec.properties);
  if (properties) {
    parts.push(properties);
  }

  const tags = formatTagList(spec.tags);
  if (tags) {
    parts.push(tags);
  }

  const mentions = formatMentions(spec.mentions);
  if (mentions) {
    parts.push(mentions);
  }

  if (resolvedId) {
    parts.push(resolvedId);
  }

  return parts.join(" ");
}

function formatProperties(
  properties: InsertionSpec["properties"]
): string | undefined {
  if (!properties) {
    return;
  }

  const entries = Object.entries(properties);
  if (entries.length === 0) {
    return;
  }

  return entries.map(([key, value]) => `${key}:${value}`).join(" ");
}

function formatTagList(tags: InsertionSpec["tags"]): string | undefined {
  if (!tags || tags.length === 0) {
    return;
  }
  return tags.map((tag) => (tag.startsWith("#") ? tag : `#${tag}`)).join(" ");
}

function formatMentions(
  mentions: InsertionSpec["mentions"]
): string | undefined {
  if (!mentions || mentions.length === 0) {
    return;
  }
  return mentions
    .map((mention) => (mention.startsWith("@") ? mention : `@${mention}`))
    .join(" ");
}

function formatContinuationLines(
  spec: InsertionSpec,
  commentLeader: string,
  indent: string
): string[] {
  if (!spec.continuations || spec.continuations.length === 0) {
    return [];
  }

  const { leader, suffix } = resolveCommentLeader(commentLeader);
  return spec.continuations.map(
    (line) => `${indent}${leader} ${line}${suffix}`
  );
}

function buildContextWindow(lines: string[], lineIndex: number): string {
  const start = Math.max(0, lineIndex - CONTEXT_BEFORE_LINES);
  const end = Math.min(lines.length, lineIndex + CONTEXT_AFTER_LINES);
  return lines.slice(start, end).join("\n");
}

async function ensureDirectory(filePath: string): Promise<void> {
  const dir = dirname(filePath);
  if (!existsSync(dir)) {
    await mkdir(dir, { recursive: true });
  }
}

function detectIndentWidth(lines: string[], referenceIndex: number): number {
  if (
    lines.length === 0 ||
    referenceIndex < 0 ||
    referenceIndex >= lines.length
  ) {
    return 0;
  }
  const match = lines[referenceIndex]?.match(LEADING_WHITESPACE_REGEX);
  return match?.[1]?.length ?? 0;
}
