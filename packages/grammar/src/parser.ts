// tldr ::: core parser for waymark grammar syntax

import { extname } from "node:path";
import { BLESSED_MARKERS, SIGIL } from "./constants";
import type { ParseOptions, WaymarkRecord } from "./types";

const COMMENT_LEADERS = ["<!--", "//", "--", "#"] as const;
// todo ::: @codex externalize comment leader detection into shared language metadata #lib/parser

const ANY_WHITESPACE_REGEX = /\s/;
const LEADING_WHITESPACE_REGEX = /^\s*/;
const LEADING_SPACES_REGEX = /^\s+/;
const HTML_COMMENT_CLOSE_REGEX = /\s*-->\s*$/;
const CONTINUATION_PREFIX = "...";
const CONTINUATION_PREFIX_LENGTH = CONTINUATION_PREFIX.length;
const SINGLE_SPACE = " ";
const SINGLE_SPACE_LENGTH = SINGLE_SPACE.length;
const PROPERTY_REGEX =
  /(?:^|[\s])([A-Za-z][A-Za-z0-9_-]*)\s*:\s*(?:"([^"\\]*(?:\\.[^"\\]*)*)"|([^\s,]+(?:,[^\s,]+)*))/gm;
const MENTION_REGEX = /(?:^|[^A-Za-z0-9/_-])(@[A-Za-z0-9/_-]+)/gm;
const TAG_REGEX = /(?:^|[^A-Za-z0-9._/:%-])(#[A-Za-z0-9._/:%-]+)/gm;
const LINE_SPLIT_REGEX = /\r?\n/;

type SignalState = {
  current: boolean;
  important: boolean;
};

type ParsedHeader = {
  indent: number;
  commentLeader: string;
  marker: string;
  signals: SignalState;
  content: string;
};

type BuildRecordArgs = {
  options: ParseOptions;
  header: ParsedHeader;
  raw: string;
  contentText: string;
  startLine: number;
  endLine: number;
};

const RELATION_KIND_MAP: Record<
  string,
  WaymarkRecord["relations"][number]["kind"]
> = {
  ref: "ref",
  rel: "rel",
  depends: "depends",
  needs: "needs",
  blocks: "blocks",
  dupeof: "dupeof",
};

const DOC_EXTENSIONS = new Set([".md", ".mdx", ".markdown", ".txt", ".rst"]);
const CONFIG_EXTENSIONS = new Set([
  ".json",
  ".jsonc",
  ".yaml",
  ".yml",
  ".toml",
  ".ini",
  ".conf",
  ".cfg",
  ".rc",
]);
const DATA_EXTENSIONS = new Set([
  ".csv",
  ".tsv",
  ".ndjson",
  ".jsonl",
  ".parquet",
]);
const TEST_EXTENSIONS = new Set([
  ".test.ts",
  ".test.tsx",
  ".test.js",
  ".test.jsx",
  ".spec.ts",
  ".spec.tsx",
  ".spec.js",
  ".spec.jsx",
]);
const TEST_TOKEN_PATTERNS = [
  ".test.",
  ".spec.",
  ".stories.",
  "__tests__",
  "__mocks__",
];

type ContentSegment = {
  text: string;
  closes: boolean;
};

function normalizeLine(line: string): string {
  return line.endsWith("\r") ? line.slice(0, -1) : line;
}

function findCommentLeader(text: string): string | null {
  for (const leader of COMMENT_LEADERS) {
    if (text.startsWith(leader)) {
      return leader;
    }
  }
  return null;
}

function parseSignalsAndMarker(segment: string): {
  marker: string;
  signals: SignalState;
  valid: boolean;
} {
  const trimmed = segment.trim();
  if (trimmed.length === 0) {
    return {
      marker: "",
      signals: { current: false, important: false },
      valid: true,
    };
  }

  if (ANY_WHITESPACE_REGEX.test(trimmed)) {
    return {
      marker: "",
      signals: { current: false, important: false },
      valid: false,
    };
  }

  let cursor = 0;
  let current = false;
  let important = false;

  while (
    cursor < trimmed.length &&
    (trimmed[cursor] === "*" || trimmed[cursor] === "!")
  ) {
    const char = trimmed[cursor];
    if (char === "*") {
      current = true;
    } else if (char === "!") {
      important = true;
    }
    cursor += 1;
  }

  const marker = trimmed.slice(cursor);

  if (marker.includes("*") || marker.includes("!")) {
    return {
      marker: "",
      signals: { current: false, important: false },
      valid: false,
    };
  }

  return {
    marker: marker.toLowerCase(),
    signals: { current, important },
    valid: true,
  };
}

function parseHeader(line: string): ParsedHeader | null {
  const indentMatch = line.match(LEADING_WHITESPACE_REGEX);
  const indent = indentMatch ? indentMatch[0].length : 0;
  const trimmed = line.slice(indent);

  const commentLeader = findCommentLeader(trimmed);
  if (!commentLeader) {
    return null;
  }

  const afterLeader = trimmed.slice(commentLeader.length);
  const sigilIndex = afterLeader.indexOf(SIGIL);
  if (sigilIndex === -1) {
    return null;
  }

  const beforeSigil = afterLeader.slice(0, sigilIndex);
  const afterSigil = afterLeader.slice(sigilIndex + SIGIL.length);

  const { marker, signals, valid } = parseSignalsAndMarker(beforeSigil);
  if (!valid) {
    return null;
  }

  return {
    indent,
    commentLeader,
    marker,
    signals,
    content: afterSigil,
  };
}

function stripHtmlCommentClosure(
  content: string,
  commentLeader: string
): string {
  if (commentLeader === "<!--") {
    return content.replace(HTML_COMMENT_CLOSE_REGEX, "");
  }
  return content;
}

function processContentSegment(
  segment: string,
  commentLeader: string
): ContentSegment {
  let working = segment;

  working = working.replace(LEADING_SPACES_REGEX, "");
  working = stripHtmlCommentClosure(working, commentLeader);

  let closes = false;
  const closingIndex = working.lastIndexOf(SIGIL);
  if (closingIndex >= 0) {
    const afterSigil = working.slice(closingIndex + SIGIL.length).trim();
    if (afterSigil.length === 0 || afterSigil === "-->") {
      closes = true;
      working = working.slice(0, closingIndex);
    }
  }

  working = stripHtmlCommentClosure(working, commentLeader);

  return {
    text: working.trim(),
    closes,
  };
}

function parseContinuation(line: string, commentLeader: string): string | null {
  const trimmed = line.trimStart();
  if (!trimmed.startsWith(commentLeader)) {
    return null;
  }

  const afterLeader = trimmed.slice(commentLeader.length).trimStart();
  if (!afterLeader.startsWith(CONTINUATION_PREFIX)) {
    return null;
  }

  let remainder = afterLeader.slice(CONTINUATION_PREFIX_LENGTH);
  if (remainder.startsWith(SINGLE_SPACE)) {
    remainder = remainder.slice(SINGLE_SPACE_LENGTH);
  }

  return remainder;
}

function analyzeContent(content: string): {
  properties: Record<string, string>;
  relations: WaymarkRecord["relations"];
  canonicals: string[];
  mentions: string[];
  tags: string[];
} {
  const { properties, relations, canonicals } =
    extractPropertiesAndRelations(content);
  const mentions = extractMentions(content);
  const tags = extractTags(content);

  return {
    properties,
    relations,
    canonicals,
    mentions,
    tags,
  };
}

function extractPropertiesAndRelations(content: string): {
  properties: Record<string, string>;
  relations: WaymarkRecord["relations"];
  canonicals: string[];
} {
  const properties: Record<string, string> = {};
  const relations: WaymarkRecord["relations"] = [];
  const canonicalSet = new Set<string>();

  for (const match of content.matchAll(PROPERTY_REGEX)) {
    const keyRaw = match[1];
    if (!keyRaw) {
      continue;
    }

    const quotedValue = match[2];
    const unquotedValue = match[3];
    const normalizedKey = keyRaw.toLowerCase();

    const rawValue = quotedValue ?? unquotedValue ?? "";
    const value =
      quotedValue !== undefined ? unescapeQuotedValue(quotedValue) : rawValue;

    properties[normalizedKey] = value;

    const relationKind = RELATION_KIND_MAP[normalizedKey];
    if (!relationKind) {
      continue;
    }

    appendRelationTokens(relationKind, value, relations, canonicalSet);
  }

  return {
    properties,
    relations,
    canonicals: Array.from(canonicalSet),
  };
}

function extractMentions(content: string): string[] {
  const mentions = new Set<string>();

  for (const match of content.matchAll(MENTION_REGEX)) {
    const mention = match[1];
    if (mention) {
      mentions.add(mention);
    }
  }

  return Array.from(mentions);
}

function extractTags(content: string): string[] {
  const tags = new Set<string>();

  for (const match of content.matchAll(TAG_REGEX)) {
    const tag = match[1];
    if (tag) {
      tags.add(tag);
    }
  }

  return Array.from(tags);
}

function appendRelationTokens(
  relationKind: WaymarkRecord["relations"][number]["kind"],
  value: string,
  relations: WaymarkRecord["relations"],
  canonicalSet: Set<string>
): void {
  const tokens = splitRelationValues(value);
  for (const token of tokens) {
    const normalizedToken = normalizeRelationToken(token);
    if (!normalizedToken) {
      continue;
    }

    if (relationKind === "ref") {
      canonicalSet.add(normalizedToken);
    }

    relations.push({
      kind: relationKind,
      token: normalizedToken,
    });
  }
}

function unescapeQuotedValue(value: string): string {
  return value.replace(/\\(["\\])/g, "$1");
}

function splitRelationValues(value: string): string[] {
  return value
    .split(",")
    .map((token) => token.trim())
    .filter((token) => token.length > 0);
}

function normalizeRelationToken(token: string): string | null {
  if (token.length === 0) {
    return null;
  }
  return token.startsWith("#") ? token : `#${token}`;
}

function inferLanguageFromFile(filePath: string | undefined): string {
  if (!filePath) {
    return "unknown";
  }

  const lower = filePath.toLowerCase();

  if (lower.endsWith(".d.ts")) {
    return "typescript";
  }

  if (lower.endsWith(".d.tsx")) {
    return "tsx";
  }

  const extension = extname(lower);

  switch (extension) {
    case ".ts":
      return "typescript";
    case ".tsx":
      return "tsx";
    case ".js":
    case ".cjs":
    case ".mjs":
      return "javascript";
    case ".jsx":
      return "jsx";
    case ".json":
    case ".jsonc":
    case ".jsonl":
    case ".ndjson":
      return "json";
    case ".yaml":
    case ".yml":
      return "yaml";
    case ".toml":
      return "toml";
    case ".md":
    case ".mdx":
    case ".markdown":
      return "markdown";
    case ".rs":
      return "rust";
    case ".py":
      return "python";
    case ".go":
      return "go";
    case ".java":
      return "java";
    case ".kt":
      return "kotlin";
    case ".swift":
      return "swift";
    default:
      if (extension) {
        return extension.slice(1);
      }
      return "unknown";
  }
}

// todo ::: @codex allow configurable overrides for file category inference #lib/parser
function inferFileCategory(
  filePath: string | undefined
): WaymarkRecord["fileCategory"] {
  if (!filePath) {
    return "code";
  }

  const lower = filePath.toLowerCase();

  if (DOC_EXTENSIONS.has(extname(lower))) {
    return "docs";
  }

  if (CONFIG_EXTENSIONS.has(extname(lower))) {
    return "config";
  }

  if (DATA_EXTENSIONS.has(extname(lower))) {
    return "data";
  }

  for (const suffix of TEST_EXTENSIONS) {
    if (lower.endsWith(suffix)) {
      return "test";
    }
  }

  for (const token of TEST_TOKEN_PATTERNS) {
    if (lower.includes(token)) {
      return "test";
    }
  }

  return "code";
}

function buildRecord(args: BuildRecordArgs): WaymarkRecord {
  const { options, header, raw, contentText, startLine, endLine } = args;
  const file = options.file ?? "";
  const language = options.language ?? inferLanguageFromFile(file);
  const fileCategory = inferFileCategory(file);

  const { properties, relations, canonicals, mentions, tags } =
    analyzeContent(contentText);

  return {
    file,
    language,
    fileCategory,
    startLine,
    endLine,
    indent: header.indent,
    commentLeader: header.commentLeader,
    signals: header.signals,
    marker: header.marker,
    contentText: contentText.trim(),
    properties,
    relations,
    canonicals,
    mentions,
    tags,
    raw,
  };
}

export function parseLine(
  line: string,
  lineNumber: number,
  options: ParseOptions = {}
): WaymarkRecord | null {
  const normalizedLine = normalizeLine(line);
  const header = parseHeader(normalizedLine);

  if (!header) {
    return null;
  }

  const segment = processContentSegment(header.content, header.commentLeader);
  const contentText = segment.text;
  const raw = normalizedLine;

  return buildRecord({
    options,
    header,
    raw,
    contentText,
    startLine: lineNumber,
    endLine: lineNumber,
  });
}

export function parse(
  text: string,
  options: ParseOptions = {}
): WaymarkRecord[] {
  const lines = text.split(LINE_SPLIT_REGEX);
  const records: WaymarkRecord[] = [];

  for (let index = 0; index < lines.length; index += 1) {
    const rawLine = normalizeLine(lines[index] ?? "");
    if (!rawLine.includes(SIGIL)) {
      continue;
    }

    const header = parseHeader(rawLine);
    if (!header) {
      continue;
    }

    const startLine = index + 1;
    const rawLines = [rawLine];
    const contentSegments: string[] = [];

    const firstSegment = processContentSegment(
      header.content,
      header.commentLeader
    );
    contentSegments.push(firstSegment.text);
    let endLine = startLine;
    let closed = firstSegment.closes;

    while (!closed && index + 1 < lines.length) {
      const nextLine = normalizeLine(lines[index + 1] ?? "");
      const continuation = parseContinuation(nextLine, header.commentLeader);

      if (!continuation) {
        break;
      }

      index += 1;
      rawLines.push(nextLine);

      const nextSegment = processContentSegment(
        continuation,
        header.commentLeader
      );
      contentSegments.push(nextSegment.text);
      closed = nextSegment.closes;
      endLine = index + 1;
    }

    const contentText = contentSegments.join("\n").trim();
    const raw = rawLines.join("\n");

    const record = buildRecord({
      options,
      header,
      raw,
      contentText,
      startLine,
      endLine,
    });

    records.push(record);
  }

  return records;
}

export function isValidMarker(marker: string | undefined): boolean {
  if (!marker) {
    return false;
  }
  return BLESSED_MARKERS.includes(
    marker.toLowerCase() as (typeof BLESSED_MARKERS)[number]
  );
}
