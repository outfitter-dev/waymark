// tldr ::: Ruby docstring detection utilities

import {
  findNextNonEmptyLine,
  type LineBlock,
  stripLinePrefix,
} from "./shared";
import type { DocstringInfo, DocstringKind } from "./types";

const RUBY_OWNER_REGEX = /^\s*(def|class|module)\b/;
const RUBY_MAGIC_COMMENT_REGEX =
  /^#\s*(?:frozen_string_literal:|typed:|encoding:|warn_indent:|rubocop:|shareable_constant_value:|noinspection)(?:\s|$)/i;
const RUBY_DOC_PREFIX_REGEX = /^\s*#\s?/;

export function detectRubyDocstring(
  content: string,
  language: string
): DocstringInfo | null {
  const lines = content.split("\n");
  const block = findRubyDocBlock(lines);
  if (!block) {
    return null;
  }

  const { startIndex, endIndex } = block;
  const raw = lines.slice(startIndex, endIndex + 1).join("\n");
  const contentText = stripLinePrefix(raw, RUBY_DOC_PREFIX_REGEX);
  const kind = classifyRubyPlacement(lines, block);

  return {
    language,
    kind,
    format: "ruby",
    raw,
    content: contentText,
    startLine: startIndex + 1,
    endLine: endIndex + 1,
  };
}

function findRubyDocBlock(lines: string[]): LineBlock | null {
  const startIndex = findRubyDocBlockStart(lines);
  if (startIndex === null) {
    return null;
  }

  const endIndex = findRubyDocBlockEnd(lines, startIndex);
  return { startIndex, endIndex };
}

function findRubyDocBlockStart(lines: string[]): number | null {
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    if (!line) {
      continue;
    }
    const trimmed = line.trim();
    if (trimmed.length === 0 || isRubyPreambleLine(trimmed)) {
      continue;
    }
    if (isRubyDocLine(trimmed)) {
      return i;
    }
    return null;
  }

  return null;
}

function findRubyDocBlockEnd(lines: string[], startIndex: number): number {
  let endIndex = startIndex;
  while (endIndex + 1 < lines.length) {
    const nextLine = lines[endIndex + 1];
    if (!nextLine) {
      break;
    }
    const next = nextLine.trim();
    if (next.length === 0 || !isRubyDocLine(next)) {
      break;
    }
    endIndex += 1;
  }
  return endIndex;
}

function classifyRubyPlacement(
  lines: string[],
  block: LineBlock
): DocstringKind {
  const beforeLines = lines.slice(0, block.startIndex);
  const preambleOnly = beforeLines.every((line) => {
    const trimmed = line.trim();
    return (
      trimmed.length === 0 ||
      trimmed.startsWith("#!") ||
      isRubyMagicComment(trimmed) ||
      trimmed.startsWith("#")
    );
  });

  if (preambleOnly) {
    return "file";
  }

  const nextLine = findNextNonEmptyLine(
    lines.slice(block.endIndex + 1).join("\n")
  );
  if (nextLine && RUBY_OWNER_REGEX.test(nextLine)) {
    return "function";
  }

  return "function";
}

function isRubyMagicComment(trimmedLine: string): boolean {
  return RUBY_MAGIC_COMMENT_REGEX.test(trimmedLine);
}

function isRubyPreambleLine(trimmedLine: string): boolean {
  return trimmedLine.startsWith("#!") || isRubyMagicComment(trimmedLine);
}

function isRubyDocLine(trimmedLine: string): boolean {
  return (
    trimmedLine.startsWith("#") &&
    !trimmedLine.startsWith("#!") &&
    !isRubyMagicComment(trimmedLine)
  );
}
