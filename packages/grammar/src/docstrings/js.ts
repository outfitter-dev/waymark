// tldr ::: JSDoc detection utilities

import {
  findNextNonEmptyLine,
  lineRangeFromMatch,
  stripBlockDocstring,
} from "./shared";
import type { DocstringInfo, DocstringKind } from "./types";

const JS_ITEM_REGEX =
  /^(export\s+)?(default\s+)?(async\s+)?(function|class|interface|type|enum|const|let|var)\b/;
const JS_FILE_TAG_REGEX = /@file(?:overview)?\b|@module\b/;
const JS_DOC_START = "/**";
const JS_DOC_END = "*/";

export function detectJsDocstring(
  content: string,
  language: string
): DocstringInfo | null {
  // Use indexOf to avoid polynomial regex complexity
  const startIndex = content.indexOf(JS_DOC_START);
  if (startIndex === -1) {
    return null;
  }

  const endIndex = content.indexOf(
    JS_DOC_END,
    startIndex + JS_DOC_START.length
  );
  if (endIndex === -1) {
    return null;
  }

  const raw = content.slice(startIndex, endIndex + 2);
  const { startLine, endLine } = lineRangeFromMatch(content, raw, startIndex);
  const contentText = stripBlockDocstring(raw, "*");
  const kind = classifyJsPlacement(
    content,
    startIndex,
    endIndex + 2,
    contentText
  );

  return {
    language,
    kind,
    format: "jsdoc",
    raw,
    content: contentText,
    startLine,
    endLine,
  };
}

function classifyJsPlacement(
  content: string,
  startIndex: number,
  endIndex: number,
  docContent: string
): DocstringKind {
  const before = content.slice(0, startIndex);
  const nextLine = findNextNonEmptyLine(content.slice(endIndex));
  const hasFileTag = JS_FILE_TAG_REGEX.test(docContent);

  if (isJsPreambleOnly(before)) {
    if (hasFileTag) {
      return "file";
    }

    if (nextLine && JS_ITEM_REGEX.test(nextLine)) {
      return "function";
    }

    return "file";
  }

  if (nextLine && JS_ITEM_REGEX.test(nextLine)) {
    return "function";
  }

  return "function";
}

function isJsPreambleOnly(content: string): boolean {
  const lines = content.split("\n");
  let inBlockComment = false;

  for (const line of lines) {
    const trimmed = line.trim();
    const result = classifyJsPreambleLine(trimmed, inBlockComment);
    if (!result.isPreamble) {
      return false;
    }
    inBlockComment = result.inBlockComment;
  }

  return true;
}

function classifyJsPreambleLine(
  trimmed: string,
  inBlockComment: boolean
): { isPreamble: boolean; inBlockComment: boolean } {
  if (trimmed.length === 0) {
    return { isPreamble: true, inBlockComment };
  }

  if (inBlockComment) {
    return { isPreamble: true, inBlockComment: !trimmed.includes(JS_DOC_END) };
  }

  if (trimmed.startsWith("#!")) {
    return { isPreamble: true, inBlockComment: false };
  }

  if (trimmed.startsWith("//")) {
    return { isPreamble: true, inBlockComment: false };
  }

  if (trimmed.startsWith("/*")) {
    return { isPreamble: true, inBlockComment: !trimmed.includes(JS_DOC_END) };
  }

  return { isPreamble: false, inBlockComment: false };
}
