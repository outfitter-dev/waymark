#!/usr/bin/env bun

// tldr ::: generate markdown map of all waymarks by type using Bun concurrency #scripts/waymarks

import { mkdirSync } from "node:fs";
import { availableParallelism, cpus } from "node:os";
import { dirname, join } from "node:path";
import { file as bunFile, Glob, write } from "bun";

const WAYMARK_SIGIL = ":::";
const WAYMARK_DIR = ".waymark";
const OUTPUT_PATH = join(WAYMARK_DIR, "map.md");
const DEFAULT_KEEP_MARKER = "tldr";

const COMMENT_PATTERN =
  /^(\/\*+|<!--|\/\/|#|--|\*)(?:\s*)([*!]?)([A-Za-z0-9_-]*)(?:\s*:::\s*)(.*)$/u;
const TLDR_MAX_LINE_DEFAULT = 40;
const TLDR_MAX_LINE_MARKDOWN = 80;
const KIBIBYTE = 1024;
const DEFAULT_MAX_FILE_MEBIBYTES = 5;
const MAX_FILE_BYTES = DEFAULT_MAX_FILE_MEBIBYTES * KIBIBYTE * KIBIBYTE;
const MAX_WORKERS = 16;
const CPU_FALLBACK_COUNT = 4;

const LINE_BREAK_PATTERN = /\r?\n/u;
const MARKER_PREFIX_PATTERN = /^[*!]+/u;
const LIST_PREFIX_PATTERN = /^\s*(?:[-*+>]+\s+|\d+\.\s+)?/u;
const TRAILING_WHITESPACE_PATTERN = /\s+$/u;
const HTML_COMMENT_END_PATTERN = /\s*-->$/u;
const BLOCK_COMMENT_END_PATTERN = /\s*\*\/$/u;
const LEADING_DOT_SLASH_PATTERN = /^\.\//u;
const GLOB_CHAR_PATTERN = /[*?[]/u;
const HTML_COMMENT_LEADER = "<!--";
const BLOCK_COMMENT_LEADER = "/*";
const SINGLE_ASTERISK_LEADER = "*";
const NEWLINE = "\n";
const DOUBLE_QUOTE = '"';
const ESCAPE_CHAR = "\\";

const SKIP_PREFIXES = [
  "node_modules/",
  ".git/",
  ".bun/",
  ".turbo/",
  ".migrate/",
  ".waymark/cache/",
  "dist/",
  "build/",
  "coverage/",
  "tmp/",
  "temp/",
  "logs/",
];

const ignoreConfig = await loadIgnoreConfig();
const configuredKeepMarkers = Array.isArray(ignoreConfig.keepMarkers)
  ? ignoreConfig.keepMarkers
  : [];
const configuredIgnorePatterns = Array.isArray(ignoreConfig.ignore)
  ? ignoreConfig.ignore
  : [];

const keepMarkersForOutput = Array.from(
  new Set([...configuredKeepMarkers, DEFAULT_KEEP_MARKER])
);
const KEEP_MARKERS = new Set(
  keepMarkersForOutput.map((marker) => marker.toLowerCase())
);

const { literal: IGNORE_LITERALS, globs: IGNORE_GLOBS } = compileIgnorePatterns(
  configuredIgnorePatterns
);

const repoGlob = new Glob("**/*");
const files = Array.from(
  repoGlob.scanSync({ cwd: ".", absolute: false })
).filter((path) => shouldConsider(path));

const workerCount = Math.max(
  1,
  Math.min(
    MAX_WORKERS,
    typeof availableParallelism === "function"
      ? availableParallelism()
      : cpus().length || CPU_FALLBACK_COUNT
  )
);

type WaymarkEntry = {
  file: string;
  line: number;
  content: string;
  marker: string;
};

type Category = "tldr" | "todo" | "this" | "other";

const categorized: Record<Category, WaymarkEntry[]> = {
  tldr: [],
  todo: [],
  this: [],
  other: [],
};

const otherCounts = new Map<string, number>();

let fileCursor = 0;

await Promise.all(
  Array.from({ length: workerCount }, async () => {
    while (true) {
      const currentIndex = fileCursor++;
      if (currentIndex >= files.length) {
        break;
      }

      const filePath = files[currentIndex];
      if (!filePath) {
        continue;
      }
      await processFile(filePath);
    }
  })
);

for (const key of Object.keys(categorized) as Category[]) {
  categorized[key].sort((a, b) => {
    if (a.file === b.file) {
      return a.line - b.line;
    }
    return a.file.localeCompare(b.file);
  });
}

const outputLines: string[] = [];
outputLines.push(
  "<!-- tldr ::: generated map of repo waymarks #docs/rules -->"
);
outputLines.push("# Waymark Map");
outputLines.push("");
outputLines.push(`Generated on ${new Date().toISOString()}.`);
outputLines.push("");

outputLines.push("## TLDR Waymarks");
outputLines.push(...formatSection(categorized.tldr));

outputLines.push("\n## TODO Waymarks");
outputLines.push(...formatSection(categorized.todo));

outputLines.push("\n## THIS Waymarks");
outputLines.push(...formatSection(categorized.this));

outputLines.push("\n## Other Waymarks");
outputLines.push(...formatSection(categorized.other));

const sortedCounts = Array.from(otherCounts.entries()).sort((a, b) =>
  a[0].localeCompare(b[0])
);

outputLines.push("\n### Other Marker Counts");
if (sortedCounts.length === 0) {
  outputLines.push("- None");
} else {
  for (const [marker, count] of sortedCounts) {
    outputLines.push(`- ${marker}: ${count}`);
  }
}

outputLines.push("\n## Ignored");
outputLines.push(
  ...formatIgnoredSection(keepMarkersForOutput, configuredIgnorePatterns)
);

mkdirSync(dirname(OUTPUT_PATH), { recursive: true });
await write(OUTPUT_PATH, outputLines.join(NEWLINE));

function shouldConsider(path: string): boolean {
  if (SKIP_PREFIXES.some((prefix) => path.startsWith(prefix))) {
    return false;
  }
  if (path === OUTPUT_PATH) {
    return false;
  }
  return true;
}

async function processFile(relativePath: string): Promise<void> {
  try {
    const targetFile = bunFile(relativePath);
    if (!targetFile.exists()) {
      return;
    }

    if (targetFile.size === 0 || targetFile.size > MAX_FILE_BYTES) {
      return;
    }

    const text = await targetFile.text().catch(() => null);
    if (typeof text !== "string") {
      return;
    }

    if (!text.includes(WAYMARK_SIGIL)) {
      return;
    }

    const lines = text.split(LINE_BREAK_PATTERN);
    lines.forEach((rawLine, lineIndex) => {
      if (!rawLine.includes(WAYMARK_SIGIL)) {
        return;
      }

      const sanitized = sanitizeLine(rawLine);
      if (!sanitized.includes(WAYMARK_SIGIL)) {
        return;
      }

      const match = COMMENT_PATTERN.exec(sanitized);
      if (!match) {
        return;
      }

      const [, leader = "", signal = "", markerRaw = "", rest = ""] = match;
      const marker = `${signal}${markerRaw}`.trim();
      const normalized = normalizeMarker(marker);
      const isIgnoredPath = matchesIgnore(relativePath);
      const keepMarker = KEEP_MARKERS.has(normalized);
      const commentSlice = rebuildSnippet(leader, marker, rest);

      if (
        !shouldIncludeEntry({
          path: relativePath,
          lineNumber: lineIndex + 1,
          marker: normalized,
          isIgnoredPath,
          keepMarker,
        })
      ) {
        return;
      }

      const entry: WaymarkEntry = {
        file: relativePath,
        line: lineIndex + 1,
        content: commentSlice,
        marker,
      };

      switch (normalized) {
        case "tldr":
          categorized.tldr.push(entry);
          break;
        case "todo":
          categorized.todo.push(entry);
          break;
        case "this":
          categorized.this.push(entry);
          break;
        default:
          categorized.other.push(entry);
          recordOther(normalized);
          break;
      }
    });
  } catch (error) {
    console.error(`Failed to process ${relativePath}:`, error);
  }
}

function formatSection(entries: WaymarkEntry[]): string[] {
  if (entries.length === 0) {
    return ["- None found"];
  }

  return entries.map(
    (entry) => `- ${entry.file}:${entry.line} — ${entry.content}`
  );
}

function normalizeMarker(marker: string): string {
  return marker.replace(MARKER_PREFIX_PATTERN, "").toLowerCase();
}

function rebuildSnippet(leader: string, marker: string, rest: string): string {
  const tail = rest.trim();
  const markerPortion = marker.length > 0 ? `${marker} :::` : ":::";

  if (leader.startsWith(HTML_COMMENT_LEADER)) {
    const cleanedTail = tail.endsWith("-->") ? tail : `${tail} -->`;
    return `<!-- ${markerPortion} ${cleanedTail}`
      .replace(TRAILING_WHITESPACE_PATTERN, "")
      .replace(HTML_COMMENT_END_PATTERN, " -->");
  }

  if (leader.startsWith(BLOCK_COMMENT_LEADER)) {
    const cleanedTail = tail.endsWith("*/") ? tail : `${tail} */`;
    return `/* ${markerPortion} ${cleanedTail}`
      .replace(TRAILING_WHITESPACE_PATTERN, "")
      .replace(BLOCK_COMMENT_END_PATTERN, " */");
  }

  if (leader === SINGLE_ASTERISK_LEADER) {
    return `* ${markerPortion} ${tail}`.trim();
  }

  return `${leader} ${markerPortion} ${tail}`.trim();
}

type InclusionContext = {
  path: string;
  lineNumber: number;
  marker: string;
  isIgnoredPath: boolean;
  keepMarker: boolean;
};

function shouldIncludeEntry({
  path,
  lineNumber,
  marker,
  isIgnoredPath,
  keepMarker,
}: InclusionContext): boolean {
  const normalized = marker.toLowerCase();
  if (normalized === "tldr") {
    const maxLine = path.endsWith(".md")
      ? TLDR_MAX_LINE_MARKDOWN
      : TLDR_MAX_LINE_DEFAULT;
    if (lineNumber > maxLine) {
      return false;
    }
  }

  if (isIgnoredPath && !keepMarker) {
    return false;
  }

  return true;
}

function sanitizeLine(rawLine: string): string {
  return rawLine.replace(LIST_PREFIX_PATTERN, "").trim();
}

function recordOther(marker: string): void {
  const normalized = marker.toLowerCase();
  if (
    normalized === "" ||
    normalized === "tldr" ||
    normalized === "todo" ||
    normalized === "this"
  ) {
    return;
  }

  const name = marker.length > 0 ? marker : "(unlabeled)";
  otherCounts.set(name, (otherCounts.get(name) ?? 0) + 1);
}

function formatIgnoredSection(
  keepMarkers: string[],
  ignorePatterns: string[]
): string[] {
  const keepList = Array.from(new Set(keepMarkers)).sort((a, b) =>
    a.localeCompare(b)
  );
  const ignoreList = Array.from(new Set(ignorePatterns)).map((pattern) =>
    pattern.replace(LEADING_DOT_SLASH_PATTERN, "")
  );
  ignoreList.sort((a, b) => a.localeCompare(b));

  const payload = {
    keepMarkers: keepList,
    ignore: ignoreList,
  };

  const json = JSON.stringify(payload, null, 2).split("\n");
  return ["```jsonc", ...json, "```"];
}

type IgnoreConfig = {
  ignore?: string[];
  keepMarkers?: string[];
};

type CompiledIgnore = {
  literal: Set<string>;
  globs: Glob[];
};

async function loadIgnoreConfig(): Promise<IgnoreConfig> {
  const configPath = join(WAYMARK_DIR, "ignore.jsonc");
  const configFile = bunFile(configPath);
  if (!configFile.exists()) {
    return { keepMarkers: [DEFAULT_KEEP_MARKER], ignore: [] };
  }

  try {
    const raw = await configFile.text();
    const cleaned = stripJsonComments(raw);
    const parsed = JSON.parse(cleaned) as IgnoreConfig;
    return {
      keepMarkers:
        Array.isArray(parsed.keepMarkers) && parsed.keepMarkers.length > 0
          ? parsed.keepMarkers
          : [DEFAULT_KEEP_MARKER],
      ignore: Array.isArray(parsed.ignore) ? parsed.ignore : [],
    };
  } catch (error) {
    console.warn(
      `Failed to parse ${configPath}, falling back to defaults`,
      error
    );
    return { keepMarkers: [DEFAULT_KEEP_MARKER], ignore: [] };
  }
}

function stripJsonComments(input: string): string {
  let index = 0;
  let output = "";

  while (index < input.length) {
    const char = input[index];
    const next = input[index + 1];

    if (char === DOUBLE_QUOTE) {
      const { chunk, nextIndex } = readStringChunk(input, index);
      output += chunk;
      index = nextIndex;
      continue;
    }

    if (char === "/" && next === "/") {
      index = skipLineComment(input, index + 2);
      output += NEWLINE;
      continue;
    }

    if (char === "/" && next === "*") {
      index = skipBlockComment(input, index + 2);
      continue;
    }

    output += char;
    index += 1;
  }

  return output;
}

function compileIgnorePatterns(patterns: string[]): CompiledIgnore {
  const literal = new Set<string>();
  const globs: Glob[] = [];

  for (const pattern of patterns) {
    if (!pattern || typeof pattern !== "string") {
      continue;
    }

    if (hasGlob(pattern)) {
      globs.push(new Glob(pattern));
    } else {
      literal.add(pattern.replace(LEADING_DOT_SLASH_PATTERN, ""));
    }
  }

  return { literal, globs };
}

function hasGlob(pattern: string): boolean {
  return GLOB_CHAR_PATTERN.test(pattern);
}

function matchesIgnore(path: string): boolean {
  if (IGNORE_LITERALS.has(path)) {
    return true;
  }

  for (const ignoreGlob of IGNORE_GLOBS) {
    if (ignoreGlob.match(path)) {
      return true;
    }
  }

  return false;
}

type StringChunk = {
  chunk: string;
  nextIndex: number;
};

function readStringChunk(input: string, startIndex: number): StringChunk {
  let index = startIndex;
  let chunk = "";
  let escaped = false;

  while (index < input.length) {
    const current = input[index];
    chunk += current;
    index += 1;

    if (escaped) {
      escaped = false;
      continue;
    }

    if (current === ESCAPE_CHAR) {
      escaped = true;
      continue;
    }

    if (current === DOUBLE_QUOTE) {
      break;
    }
  }

  return { chunk, nextIndex: index };
}

function skipLineComment(input: string, startIndex: number): number {
  let index = startIndex;

  while (index < input.length) {
    const current = input[index];
    if (current === "\n") {
      return index + 1;
    }
    if (current === "\r") {
      return input[index + 1] === "\n" ? index + 2 : index + 1;
    }
    index += 1;
  }

  return index;
}

function skipBlockComment(input: string, startIndex: number): number {
  let index = startIndex;

  while (index < input.length - 1) {
    if (input[index] === "*" && input[index + 1] === "/") {
      return index + 2;
    }
    index += 1;
  }

  return input.length;
}
