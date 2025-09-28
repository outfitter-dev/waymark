#!/usr/bin/env bun
// tldr ::: stdio MCP server bridging waymark CLI capabilities

import { existsSync } from "node:fs";
import { readdir, readFile, stat, writeFile } from "node:fs/promises";
import { join, relative, resolve } from "node:path";

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import {
  buildRelationGraph,
  buildWaymarkMap,
  type ConfigScope,
  formatText,
  type LoadConfigOptions,
  loadConfigFromDisk,
  parse,
  type WaymarkMap,
  type WaymarkRecord,
} from "@waymarks/core";
import { Glob } from "bun";
import { z } from "zod";

const VERSION = process.env.npm_package_version ?? "0.0.0";

const SKIP_DIRECTORY_NAMES = new Set([
  ".git",
  "node_modules",
  "dist",
  "build",
  ".turbo",
]);

const PATH_SPLIT_REGEX = /[/\\]/u;

const configOptionsSchema = z.object({
  configPath: z.string().optional(),
  scope: z.enum(["default", "project", "global"]).optional(),
});

const scanInputSchema = configOptionsSchema.extend({
  paths: z.array(z.string().min(1)).nonempty(),
  format: z.enum(["text", "json", "jsonl", "pretty"]).default("json"),
});

type ScanInput = z.infer<typeof scanInputSchema>;

const graphInputSchema = configOptionsSchema.extend({
  paths: z.array(z.string().min(1)).nonempty(),
});

const mapInputSchema = graphInputSchema;

type RenderFormat = ScanInput["format"];

type ExpandedConfig = LoadConfigOptions & { scope: ConfigScope };

const MAP_RESOURCE_URI = "waymark://map";
const TODOS_RESOURCE_URI = "waymark://todos";

const DEFAULT_TLDR_PROMPT_LINES = 200;
const MAX_TLDR_PROMPT_LINES = 2000;
const EXTENSION_REGEX = /(\.[^.]+)$/u;
const NEWLINE_SPLIT_REGEX = /\r?\n/u;
const LEADING_WHITESPACE_REGEX = /^[ \t]*/u;

const insertWaymarkInputSchema = configOptionsSchema.extend({
  filePath: z.string().min(1),
  marker: z.string().min(1),
  content: z.string().min(1),
  line: z.number().int().positive().optional(),
  signals: z
    .object({
      current: z.boolean().optional(),
      important: z.boolean().optional(),
    })
    .optional(),
});

async function main(): Promise<void> {
  const server = new McpServer({ name: "waymark-mcp", version: VERSION });

  server.registerTool(
    "waymark.scan",
    {
      title: "Scan files for waymarks",
      description:
        "Parses one or more files (or directories) and returns waymark records in the requested format.",
      inputSchema: scanInputSchema.shape,
    },
    async (input) => {
      const { paths, format, configPath, scope } = scanInputSchema.parse(input);
      const collectOptions: { configPath?: string; scope?: ConfigScope } = {};
      if (configPath) {
        collectOptions.configPath = configPath;
      }
      if (scope) {
        collectOptions.scope = scope;
      }
      const { records } = await collectRecords(paths, collectOptions);
      const rendered = renderRecords(records, format);
      return toTextResponse(rendered, mimeForFormat(format));
    }
  );

  server.registerTool(
    "waymark.map",
    {
      title: "Summarize waymarks by file and marker",
      description: "Builds a TLDR/marker summary for the provided paths.",
      inputSchema: mapInputSchema.shape,
    },
    async (input) => {
      const { paths, configPath, scope } = mapInputSchema.parse(input);
      const collectOptions: { configPath?: string; scope?: ConfigScope } = {};
      if (configPath) {
        collectOptions.configPath = configPath;
      }
      if (scope) {
        collectOptions.scope = scope;
      }
      const { records } = await collectRecords(paths, collectOptions);
      const map = buildWaymarkMap(records);
      const serialized = serializeMap(map);
      return toJsonResponse(serialized);
    }
  );

  server.registerTool(
    "waymark.graph",
    {
      title: "Generate relation graph",
      description:
        "Produces the relation edges (ref/depends/needs/etc.) extracted from the provided files.",
      inputSchema: graphInputSchema.shape,
    },
    async (input) => {
      const { paths, configPath, scope } = graphInputSchema.parse(input);
      const collectOptions: { configPath?: string; scope?: ConfigScope } = {};
      if (configPath) {
        collectOptions.configPath = configPath;
      }
      if (scope) {
        collectOptions.scope = scope;
      }
      const { records } = await collectRecords(paths, collectOptions);
      const edges = buildRelationGraph(records).edges;
      return toJsonResponse(edges);
    }
  );

  server.registerTool(
    "waymark.insert",
    {
      title: "Insert a waymark",
      description:
        "Creates a new waymark (e.g., tldr/this/todo) at the requested location and normalizes the file.",
      inputSchema: insertWaymarkInputSchema.shape,
    },
    async (input) =>
      handleInsertWaymark({
        ...insertWaymarkInputSchema.parse(input),
        server,
      })
  );

  server.registerResource(
    "waymark-map",
    MAP_RESOURCE_URI,
    {
      title: "Waymark Map",
      description: "Summary of TLDR and marker counts across the repository",
      mimeType: "application/json",
    },
    async () => {
      const { records } = await collectRecords(["."], {});
      const map = buildWaymarkMap(records);
      return {
        contents: [
          {
            uri: MAP_RESOURCE_URI,
            mimeType: "application/json",
            text: JSON.stringify(serializeMap(map), null, 2),
          },
        ],
      };
    }
  );

  server.registerResource(
    "waymark-todos",
    TODOS_RESOURCE_URI,
    {
      title: "Waymark TODOs",
      description: "All todo waymarks discovered in the repository",
      mimeType: "application/json",
    },
    async () => {
      const { records } = await collectRecords(["."], {});
      const todos = records
        .filter((record) => record.marker.toLowerCase() === "todo")
        .map((record) => ({
          file: record.file,
          line: record.startLine,
          content: record.contentText,
          raw: record.raw,
        }));

      return {
        contents: [
          {
            uri: TODOS_RESOURCE_URI,
            mimeType: "application/json",
            text: JSON.stringify(todos, null, 2),
          },
        ],
      };
    }
  );

  server.registerPrompt(
    "waymark.tldr",
    {
      title: "Draft TLDR Waymark",
      description: "Generate a concise TLDR comment for a file",
      argsSchema: {
        filePath: z.string().min(1),
        maxLines: z.string().optional(),
      },
    },
    async ({ filePath, maxLines }) => {
      const absolutePath = resolve(process.cwd(), filePath);
      const source = await readFile(absolutePath, "utf8").catch(() => "");
      const limit = maxLines ? Number.parseInt(maxLines, 10) : undefined;
      const boundedLimit = Number.isFinite(limit)
        ? clamp(Number(limit), 1, MAX_TLDR_PROMPT_LINES)
        : DEFAULT_TLDR_PROMPT_LINES;
      const snippet = truncateSource(source, boundedLimit);
      return {
        messages: [
          {
            role: "user",
            content: {
              type: "text",
              text: [
                "Write a single-sentence TLDR waymark that summarizes the file.",
                "Use active voice, cite the primary capability, and end with key technologies or domains.",
                `File path: ${normalizePathForOutput(absolutePath)}`,
                "",
                "File snippet:",
                snippet,
              ].join("\n"),
            },
          },
        ],
      };
    }
  );

  server.registerPrompt(
    "waymark.todo",
    {
      title: "Draft TODO Waymark",
      description: "Produce a focused TODO entry for follow-up work",
      argsSchema: {
        summary: z.string().min(1),
        filePath: z.string().optional(),
        context: z.string().optional(),
      },
    },
    ({ summary, filePath, context }) => {
      const lines: string[] = [
        "Write a TODO waymark content line (no marker) that captures the essential follow-up work.",
        "Keep it short, actionable, and mention owners or references if provided.",
        `Summary: ${summary}`,
      ];
      if (filePath) {
        lines.push(`File path: ${filePath}`);
      }
      if (context) {
        lines.push(`Context:\n${context}`);
      }

      return {
        messages: [
          {
            role: "user",
            content: {
              type: "text",
              text: lines.join("\n"),
            },
          },
        ],
      };
    }
  );

  const transport = new StdioServerTransport();
  await server.connect(transport);
}

async function collectRecords(
  inputs: string[],
  options: { configPath?: string; scope?: ConfigScope }
): Promise<{ records: WaymarkRecord[] }> {
  let filePaths = await expandInputPaths(inputs);
  if (filePaths.length === 0) {
    return { records: [] };
  }

  const config = await loadConfig({
    scope: options.scope ?? "default",
    ...(options.configPath ? { configPath: options.configPath } : {}),
  });

  filePaths = applySkipPaths(filePaths, config.skipPaths ?? []);

  const records: WaymarkRecord[] = [];
  await Promise.all(
    filePaths.map(async (filePath) => {
      const source = await readFile(filePath, "utf8").catch(() => null);
      if (typeof source !== "string") {
        return;
      }
      const parsed = parse(source, { file: normalizePathForOutput(filePath) });
      records.push(...parsed);
    })
  );

  return { records };
}

async function expandInputPaths(inputs: string[]): Promise<string[]> {
  if (inputs.length === 0) {
    return [];
  }

  const files = new Set<string>();
  for (const input of inputs) {
    const resolved = resolve(process.cwd(), input);
    if (!existsSync(resolved)) {
      continue;
    }
    await collectFilesRecursive(resolved, files);
  }
  return Array.from(files);
}

async function collectFilesRecursive(
  path: string,
  files: Set<string>
): Promise<void> {
  const info = await stat(path);
  if (info.isFile()) {
    files.add(path);
    return;
  }

  if (!info.isDirectory() || shouldSkipDirectory(path)) {
    return;
  }

  const entries = await readdir(path, { withFileTypes: true });
  await Promise.all(
    entries.map(async (entry) => {
      const child = join(path, entry.name);
      if (entry.isDirectory()) {
        if (SKIP_DIRECTORY_NAMES.has(entry.name)) {
          return;
        }
        await collectFilesRecursive(child, files);
      } else if (entry.isFile()) {
        files.add(child);
      }
    })
  );
}

function shouldSkipDirectory(path: string): boolean {
  const parts = path.split(PATH_SPLIT_REGEX);
  const name = parts.at(-1) ?? "";
  return SKIP_DIRECTORY_NAMES.has(name);
}

function normalizePathForOutput(path: string): string {
  const rel = relative(process.cwd(), path);
  return rel === "" || rel.startsWith("..") ? path : rel;
}

function renderRecords(records: WaymarkRecord[], format: RenderFormat): string {
  if (records.length === 0) {
    return "";
  }

  switch (format) {
    case "json":
      return JSON.stringify(records);
    case "jsonl":
      return records.map((record) => JSON.stringify(record)).join("\n");
    case "pretty":
      return JSON.stringify(records, null, 2);
    default:
      return records
        .map(
          (record) =>
            `${record.file}:${record.startLine} ${record.marker} ::: ${record.contentText}`
        )
        .join("\n");
  }
}

function serializeMap(map: WaymarkMap): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [file, summary] of map.files.entries()) {
    result[file] = {
      tldr: summary.tldr?.contentText,
      markers: Object.fromEntries(
        Array.from(summary.markers.entries()).map(([marker, details]) => [
          marker,
          details.entries.length,
        ])
      ),
    };
  }
  return result;
}

async function handleInsertWaymark(params: {
  filePath: string;
  marker: string;
  content: string;
  line?: number | undefined;
  signals?: SignalFlags | undefined;
  configPath?: string | undefined;
  scope?: ConfigScope | undefined;
  server: Pick<McpServer, "sendResourceListChanged">;
}): Promise<CallToolResult> {
  const {
    filePath,
    marker,
    content,
    line,
    signals,
    configPath,
    scope,
    server,
  } = params;

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
  const markerLower = marker.toLowerCase();

  if (
    markerLower === "tldr" &&
    existingRecords.some((record) => record.marker.toLowerCase() === "tldr")
  ) {
    throw new Error(`File ${filePath} already contains a tldr waymark.`);
  }

  const commentStyle = resolveCommentStyle(absolutePath, existingRecords);
  const insertion = insertWaymark({
    source: originalSource,
    marker,
    content,
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
    marker: markerLower,
    content,
    insertedLine: insertion.lineNumber,
  });

  server.sendResourceListChanged();

  return toJsonResponse({
    filePath: normalizedPath,
    marker: insertedRecord?.marker ?? marker,
    startLine: insertedRecord?.startLine ?? insertion.lineNumber,
    endLine: insertedRecord?.endLine ?? insertion.lineNumber,
    content: insertedRecord?.contentText ?? content,
    signals: insertedRecord?.signals,
  });
}

function loadConfig(options: {
  scope: ConfigScope;
  configPath?: string;
}): Promise<Awaited<ReturnType<typeof loadConfigFromDisk>>> {
  const loadOptions: ExpandedConfig = {
    cwd: process.cwd(),
    env: process.env,
    scope: options.scope,
    ...(options.configPath
      ? { explicitPath: resolve(process.cwd(), options.configPath) }
      : {}),
  };

  return loadConfigFromDisk(loadOptions);
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

function toTextResponse(text: string, mimeType: string): CallToolResult {
  return {
    content: [
      {
        type: "text",
        mimeType,
        text,
      },
    ],
  };
}

function mimeForFormat(format: RenderFormat): string {
  switch (format) {
    case "json":
    case "jsonl":
    case "pretty":
      return "application/json";
    default:
      return "text/plain";
  }
}

type SignalFlags = {
  current?: boolean | undefined;
  important?: boolean | undefined;
};

type CommentStyle = {
  leader: string;
  closing?: string;
};

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
  ".jsx": { leader: "//" },
  ".json": { leader: "//" },
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
  marker: string;
  content: string;
  line?: number;
  newline: string;
  commentStyle: CommentStyle;
  signals?: SignalFlags;
  markerLower: string;
};

type InsertWaymarkResult = {
  text: string;
  lineNumber: number;
};

function insertWaymark(params: InsertWaymarkParams): InsertWaymarkResult {
  const {
    source,
    marker,
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

  if (markerLower === "tldr") {
    insertIndex = computeTldrInsertionIndex(lines);
  } else if (line !== undefined) {
    const zeroBased = Math.max(0, line - 1);
    insertIndex = Math.min(zeroBased, lines.length);
  } else if (markerLower === "this") {
    throw new Error("line is required when inserting a `this` waymark");
  }

  const indentString =
    markerLower === "tldr"
      ? ""
      : determineIndentString(
          lines[Math.min(insertIndex, Math.max(lines.length - 1, 0))] ?? ""
        );

  const renderedLine = renderWaymarkLine({
    indent: indentString,
    marker,
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
  marker: string;
  content: string;
  commentStyle: CommentStyle;
  signals?: SignalFlags;
}): string {
  const { indent, marker, content, commentStyle, signals } = params;
  const signalPrefix = buildSignalPrefix(signals);
  const leaderSpace = needsSpaceAfterLeader(commentStyle.leader) ? " " : "";
  let line = `${indent}${commentStyle.leader}${leaderSpace}${signalPrefix}${marker} ::: ${content}`;
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
  if (signals.current) {
    prefix += "*";
  }
  if (signals.important) {
    prefix += "!";
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
  marker: string;
  content: string;
  insertedLine: number;
}): WaymarkRecord | undefined {
  const { records, marker, content, insertedLine } = params;
  const normalizedContent = content.trim();
  let best: WaymarkRecord | undefined;
  let bestDistance = Number.POSITIVE_INFINITY;

  for (const record of records) {
    if (record.marker.toLowerCase() !== marker) {
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

function truncateSource(source: string, maxLines: number): string {
  const lines = source.split(NEWLINE_SPLIT_REGEX);
  if (lines.length <= maxLines) {
    return source;
  }
  return `${lines.slice(0, maxLines).join("\n")}\n...`;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function applySkipPaths(paths: string[], skipPatterns: string[]): string[] {
  if (skipPatterns.length === 0) {
    return paths;
  }

  const globs = skipPatterns.map((pattern) => new Glob(pattern));
  return paths.filter((path) => {
    const rel = normalizePathForOutput(path);
    return !globs.some((glob) => glob.match(path) || glob.match(rel));
  });
}

main().catch((error) => {
  const message =
    error instanceof Error ? (error.stack ?? error.message) : String(error);
  process.stderr.write(`${message}\n`);
  process.exit(1);
});

export { handleInsertWaymark, truncateSource };
export type { SignalFlags };
