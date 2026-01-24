// tldr ::: safe insertion point detection for TLDR placement

import { parse } from "@waymarks/grammar";

const LINE_SPLIT_REGEX = /\r?\n/;

const SUPPORTED_LANGUAGES = new Set([
  "javascript",
  "typescript",
  "jsx",
  "tsx",
  "python",
  "ruby",
  "rust",
  "go",
  "markdown",
  "mdx",
]);

const JS_DIRECTIVE_REGEX = /^['"](use strict|use client|use server)['"]\s*;?$/;
const TS_REFERENCE_REGEX = /^\/\/\/\s*<(reference|amd-(module|dependency))\b/i;
const TS_CHECK_REGEX =
  /^(\/\/\s*@ts-(check|nocheck)\b|\/\*\s*@ts-(check|nocheck)\s*\*\/)$/i;
const PYTHON_ENCODING_REGEX =
  /^#\s*([-*_\s]*coding[:=]\s*[-\w.]+|coding\s*[:=]\s*[-\w.]+)\s*$/i;
const RUBY_MAGIC_COMMENT_REGEX =
  /^#\s*(frozen_string_literal:\s*\w+|coding[:=]\s*[-\w.]+|encoding:\s*[-\w.]+)\s*$/i;
const RUST_INNER_ATTRIBUTE_REGEX = /^#!\s*\[/;
const GO_BUILD_TAG_REGEX = /^(\/\/\s*go:build\b|\/\/\s*\+build\b)/;

/**
 * Find the best line number to insert a TLDR waymark.
 * @param content - Raw file contents.
 * @param language - Language identifier string.
 * @returns Line number (1-indexed) or -1 if unsuitable.
 */
export function findTldrInsertionPoint(
  content: string,
  language: string
): number {
  const normalizedLanguage = language.trim().toLowerCase();
  if (!SUPPORTED_LANGUAGES.has(normalizedLanguage)) {
    return -1;
  }

  if (hasExistingTldr(content)) {
    return -1;
  }

  const lines = splitLines(content);
  if (lines.length === 0) {
    return 1;
  }

  let index = 0;

  if (isShebangLine(lines[index])) {
    index += 1;
  }

  const frontMatterResult = skipFrontMatter(lines, index);
  if (frontMatterResult === -1) {
    return -1;
  }
  index = frontMatterResult;

  index = skipLanguageDirectives(lines, index, normalizedLanguage);

  return index + 1;
}

function hasExistingTldr(content: string): boolean {
  const records = parse(content);
  return records.some((record) => record.type === "tldr");
}

function splitLines(content: string): string[] {
  if (!content) {
    return [];
  }
  const lines = content.split(LINE_SPLIT_REGEX);
  if (lines.length > 0 && lines.at(-1) === "") {
    lines.pop();
  }
  return lines;
}

function isShebangLine(line: string | undefined): boolean {
  return Boolean(line?.startsWith("#!"));
}

function skipFrontMatter(lines: string[], start: number): number {
  if (start >= lines.length) {
    return start;
  }
  const trimmed = lines[start]?.trim();
  if (trimmed !== "---" && trimmed !== "+++") {
    return start;
  }
  for (let index = start + 1; index < lines.length; index += 1) {
    if (lines[index]?.trim() === trimmed) {
      return index + 1;
    }
  }
  return -1;
}

function skipLanguageDirectives(
  lines: string[],
  start: number,
  language: string
): number {
  switch (language) {
    case "javascript":
    case "typescript":
    case "jsx":
    case "tsx":
      return skipJavaScriptDirectives(lines, start);
    case "python":
      return skipPythonDirectives(lines, start);
    case "ruby":
      return skipRubyDirectives(lines, start);
    case "rust":
      return skipRustDirectives(lines, start);
    case "go":
      return skipGoDirectives(lines, start);
    default:
      return start;
  }
}

function skipJavaScriptDirectives(lines: string[], start: number): number {
  let index = start;
  while (index < lines.length) {
    const trimmed = lines[index]?.trim() ?? "";
    if (
      TS_REFERENCE_REGEX.test(trimmed) ||
      TS_CHECK_REGEX.test(trimmed) ||
      JS_DIRECTIVE_REGEX.test(trimmed)
    ) {
      index += 1;
      continue;
    }
    break;
  }
  return index;
}

function skipPythonDirectives(lines: string[], start: number): number {
  let index = start;
  if (index < lines.length && PYTHON_ENCODING_REGEX.test(lines[index] ?? "")) {
    index += 1;
  }
  return index;
}

function skipRubyDirectives(lines: string[], start: number): number {
  let index = start;
  if (index < lines.length && RUBY_MAGIC_COMMENT_REGEX.test(lines[index] ?? "")) {
    index += 1;
  }
  return index;
}

function skipRustDirectives(lines: string[], start: number): number {
  let index = start;
  while (index < lines.length) {
    const trimmed = lines[index]?.trim() ?? "";
    if (RUST_INNER_ATTRIBUTE_REGEX.test(trimmed)) {
      index += 1;
      continue;
    }
    break;
  }
  return index;
}

function skipGoDirectives(lines: string[], start: number): number {
  let index = start;
  let sawBuildTag = false;
  while (index < lines.length) {
    const trimmed = lines[index]?.trim() ?? "";
    if (GO_BUILD_TAG_REGEX.test(trimmed)) {
      sawBuildTag = true;
      index += 1;
      continue;
    }
    break;
  }
  if (sawBuildTag && index < lines.length && lines[index]?.trim() === "") {
    index += 1;
  }
  return index;
}
