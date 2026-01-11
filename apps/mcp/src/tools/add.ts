// tldr ::: add tool handler for waymark MCP server

import { existsSync } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import type { ConfigScope, WaymarkRecord } from "@waymarks/core";
import { formatText, parse } from "@waymarks/core";
import { MARKERS } from "@waymarks/grammar";
import type { CommentStyle, SignalFlags } from "../types";
import { addWaymarkInputSchema } from "../types";
import { loadConfig } from "../utils/config";
import { normalizePathForOutput } from "../utils/filesystem";

const EXTENSION_REGEX = /(\.[^.]+)$/u;
const NEWLINE_SPLIT_REGEX = /\r?\n/u;
const LEADING_WHITESPACE_REGEX = /^[ \t]*/u;
const ID_TRAIL_REGEX = /(\[\[[^\]]+\]\])$/i;
const WM_ID_PREFIX = "wm:";

const COMMENT_STYLE_BY_EXTENSION: Record<string, CommentStyle> = {
  ".c": { leader: "//" },
  ".cc": { leader: "//" },
  ".cpp": { leader: "//" },
  ".cs": { leader: "//" },
  ".css": { leader: "/*", closing: " */" },
  ".go": { leader: "//" },
  ".h": { leader: "//" },
  ".html": { leader: "<!--", closing: " -->" },
  ".java": { leader: "//" },
  ".js": { leader: "//" },
  ".json5": { leader: "//" },
  ".jsonc": { leader: "//" },
  ".jsx": { leader: "//" },
  ".kt": { leader: "//" },
  ".kts": { leader: "//" },
  ".md": { leader: "<!--", closing: " -->" },
  ".mdx": { leader: "<!--", closing: " -->" },
  ".php": { leader: "//" },
  ".py": { leader: "#" },
  ".rb": { leader: "#" },
  ".rs": { leader: "//" },
  ".scss": { leader: "/*", closing: " */" },
  ".sh": { leader: "#" },
  ".sql": { leader: "--" },
  ".swift": { leader: "//" },
  ".toml": { leader: "#" },
  ".ts": { leader: "//" },
  ".tsx": { leader: "//" },
  ".vue": { leader: "<!--", closing: " -->" },
  ".xml": { leader: "<!--", closing: " -->" },
  ".yaml": { leader: "#" },
  ".yml": { leader: "#" },
};

const COMMENT_STYLE_BY_LEADER: Record<string, CommentStyle> = {
  "//": { leader: "//" },
  "#": { leader: "#" },
  "--": { leader: "--" },
  "<!--": { leader: "<!--", closing: " -->" },
  "/*": { leader: "/*", closing: " */" },
};

const DEFAULT_COMMENT_STYLE: CommentStyle = { leader: "//" };

type InsertWaymarkParams = {
  source: string;
  type: string;
  content: string;
  line?: number | undefined;
  newline: string;
  commentStyle: CommentStyle;
  signals?: SignalFlags | undefined;
  markerLower: string;
};

type InsertWaymarkResult = {
  text: string;
  lineNumber: number;
};

export async function handleAdd(
  input: unknown,
  server: Pick<McpServer, "sendResourceListChanged">
): Promise<CallToolResult> {
  const params = addWaymarkInputSchema.parse(input);
  const { filePath, type, content, line, signals, id, configPath, scope } =
    params;
  const normalizedId = id ? normalizeWaymarkId(id) : undefined;
  const normalizedContent = applyIdToContent(content, normalizedId);

  const absolutePath = resolve(process.cwd(), filePath);
  if (!existsSync(absolutePath)) {
    throw new Error(`File not found: ${filePath}`);
  }

  const normalizedPath = normalizePathForOutput(absolutePath);
  const config = await loadConfig({
    scope: scope ?? "default",
    ...(configPath ? { configPath } : {}),
  });

  const originalSource = await readFile(absolutePath, "utf8");
  const newline = originalSource.includes("\r\n") ? "\r\n" : "\n";
  const existingRecords = parse(originalSource, { file: normalizedPath });
  const markerLower = type.toLowerCase();

  if (
    markerLower === MARKERS.tldr &&
    existingRecords.some((record) => record.type.toLowerCase() === MARKERS.tldr)
  ) {
    throw new Error(`File ${filePath} already contains a tldr waymark.`);
  }

  const commentStyle = resolveCommentStyle(absolutePath, existingRecords);
  const insertion = _addWaymark({
    source: originalSource,
    type,
    content: normalizedContent,
    ...(line !== undefined ? { line } : {}),
    newline,
    commentStyle,
    ...(signals ? { signals } : {}),
    markerLower,
  });

  const formatted = formatText(insertion.text, {
    file: normalizedPath,
    config,
  });

  await writeFile(absolutePath, formatted.formattedText, "utf8");

  const updatedRecords = parse(formatted.formattedText, {
    file: normalizedPath,
  });
  const insertedRecord = findInsertedRecord({
    records: updatedRecords,
    type: markerLower,
    content: normalizedContent,
    insertedLine: insertion.lineNumber,
  });

  server.sendResourceListChanged();

  return toJsonResponse({
    filePath: normalizedPath,
    type: insertedRecord?.type ?? type,
    startLine: insertedRecord?.startLine ?? insertion.lineNumber,
    endLine: insertedRecord?.endLine ?? insertion.lineNumber,
    content: insertedRecord?.contentText ?? normalizedContent,
    signals: insertedRecord?.signals,
  });
}

function _addWaymark(params: InsertWaymarkParams): InsertWaymarkResult {
  const {
    source,
    type,
    content,
    line,
    newline,
    commentStyle,
    signals,
    markerLower,
  } = params;

  const lines = source.split(NEWLINE_SPLIT_REGEX);
  const trimmedContent = content.trim();

  let insertIndex = lines.length;

  if (markerLower === MARKERS.tldr) {
    insertIndex = computeTldrInsertionIndex(lines);
  } else if (line !== undefined) {
    const zeroBased = Math.max(0, line - 1);
    insertIndex = Math.min(zeroBased, lines.length);
  } else if (markerLower === MARKERS.about) {
    throw new Error("line is required when inserting an `about` waymark");
  }

  const indentString =
    markerLower === MARKERS.tldr
      ? ""
      : determineIndentString(
          lines[Math.min(insertIndex, Math.max(lines.length - 1, 0))] ?? ""
        );

  const renderedLine = renderWaymarkLine({
    indent: indentString,
    type,
    content: trimmedContent,
    commentStyle,
    ...(signals ? { signals } : {}),
  });

  lines.splice(insertIndex, 0, renderedLine);

  let updatedText = lines.join(newline);
  if (source.endsWith("\n") && !updatedText.endsWith("\n")) {
    updatedText += newline;
  }

  return {
    text: updatedText,
    lineNumber: insertIndex + 1,
  };
}

function renderWaymarkLine(params: {
  indent: string;
  type: string;
  content: string;
  commentStyle: CommentStyle;
  signals?: SignalFlags;
}): string {
  const { indent, type, content, commentStyle, signals } = params;
  const signalPrefix = buildSignalPrefix(signals);
  const leaderSpace = needsSpaceAfterLeader(commentStyle.leader) ? " " : "";
  let line = `${indent}${commentStyle.leader}${leaderSpace}${signalPrefix}${type} ::: ${content}`;
  if (commentStyle.closing) {
    line += commentStyle.closing;
  }
  return line;
}

function buildSignalPrefix(signals?: SignalFlags): string {
  if (!signals) {
    return "";
  }
  let prefix = "";
  if (signals.flagged) {
    prefix += "~";
  }
  if (signals.starred) {
    prefix += "*";
  }
  return prefix;
}

function needsSpaceAfterLeader(leader: string): boolean {
  return leader.length > 0;
}

function computeTldrInsertionIndex(lines: string[]): number {
  if (lines.length === 0) {
    return 0;
  }

  let index = 0;
  if (lines[index]?.startsWith("#!")) {
    index += 1;
  }

  if (lines[index]?.trim() === "---") {
    let cursor = index + 1;
    while (cursor < lines.length && lines[cursor]?.trim() !== "---") {
      cursor += 1;
    }
    if (cursor < lines.length) {
      index = cursor + 1;
    }
  }

  while (index < lines.length && lines[index]?.trim() === "") {
    index += 1;
  }

  return index;
}

function determineIndentString(line: string): string {
  const match = line.match(LEADING_WHITESPACE_REGEX);
  return match ? match[0] : "";
}

function resolveCommentStyle(
  filePath: string,
  records: WaymarkRecord[]
): CommentStyle {
  for (const record of records) {
    if (record.commentLeader) {
      return commentStyleFromLeader(record.commentLeader);
    }
  }

  const lower = filePath.toLowerCase();
  const extensionMatch = lower.match(EXTENSION_REGEX);
  const ext = extensionMatch?.[1] ?? "";
  return COMMENT_STYLE_BY_EXTENSION[ext] ?? DEFAULT_COMMENT_STYLE;
}

function commentStyleFromLeader(leader: string): CommentStyle {
  return COMMENT_STYLE_BY_LEADER[leader] ?? DEFAULT_COMMENT_STYLE;
}

function findInsertedRecord(params: {
  records: WaymarkRecord[];
  type: string;
  content: string;
  insertedLine: number;
}): WaymarkRecord | undefined {
  const { records, type, content, insertedLine } = params;
  const normalizedContent = content.trim();
  let best: WaymarkRecord | undefined;
  let bestDistance = Number.POSITIVE_INFINITY;

  for (const record of records) {
    if (record.type.toLowerCase() !== type) {
      continue;
    }
    if (record.contentText.trim() !== normalizedContent) {
      continue;
    }
    const distance = Math.abs(record.startLine - insertedLine);
    if (distance < bestDistance) {
      best = record;
      bestDistance = distance;
    }
  }

  return best;
}

function toJsonResponse(value: unknown): CallToolResult {
  return {
    content: [
      {
        type: "text",
        mimeType: "application/json",
        text: JSON.stringify(value, null, 2),
      },
    ],
  };
}

function normalizeWaymarkId(id: string): string {
  const trimmed = id.trim();
  if (trimmed.length === 0) {
    throw new Error("Waymark id cannot be empty.");
  }
  const lower = trimmed.toLowerCase();
  if (lower.startsWith(WM_ID_PREFIX)) {
    throw new Error(
      "wm: ids are not supported. Use [[hash]] or [[hash|alias]]."
    );
  }
  if (trimmed.startsWith("[[") && trimmed.endsWith("]]")) {
    const inner = trimmed.slice(2, -2).trim();
    if (inner.length === 0) {
      throw new Error(`Invalid waymark id format: ${id}`);
    }
    const normalizedInner = inner.toLowerCase();
    if (normalizedInner.startsWith(WM_ID_PREFIX)) {
      throw new Error(
        "wm: ids are not supported. Use [[hash]] or [[hash|alias]]."
      );
    }
    return `[[${normalizedInner}]]`;
  }
  return `[[${lower}]]`;
}

function applyIdToContent(content: string, id?: string): string {
  const trimmed = content.trim();
  if (!id) {
    return trimmed;
  }

  const match = trimmed.match(ID_TRAIL_REGEX);
  const existingId = match?.[1];
  if (existingId) {
    const normalizedExisting = normalizeWaymarkId(existingId);
    if (normalizedExisting !== id) {
      throw new Error(
        `Content already contains a different waymark id: ${existingId}`
      );
    }
    const base = trimmed.replace(ID_TRAIL_REGEX, "").trimEnd();
    return base.length > 0
      ? `${base} ${normalizedExisting}`
      : normalizedExisting;
  }
  return trimmed.length > 0 ? `${trimmed} ${id}` : id;
}

export const addToolDefinition = {
  title: "Add a waymark",
  description:
    "Creates a new waymark (e.g., tldr/this/todo) at the requested location and normalizes the file.",
  inputSchema: addWaymarkInputSchema.shape,
} as const;

/** Wrapper to invoke the add tool handler in tests. */
export function handleAddWaymark(params: {
  filePath: string;
  type: string;
  content: string;
  id?: string | undefined;
  line?: number | undefined;
  signals?: SignalFlags | undefined;
  configPath?: string | undefined;
  scope?: ConfigScope | undefined;
  server: Pick<McpServer, "sendResourceListChanged">;
}): Promise<CallToolResult> {
  return handleAdd(params, params.server);
}
