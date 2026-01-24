// tldr ::: Python docstring detection utilities

import {
  findNextNonEmptyLine,
  findPreviousNonEmptyLine,
  getLinePrefix,
  isLinePrefixAllowed,
  lineRangeFromMatch,
  stripDelimitedDocstring,
} from "./shared";
import type { DocstringInfo, DocstringKind } from "./types";

const PYTHON_OWNER_REGEX = /^\s*(def|class)\b/;
const PYTHON_PREFIX_REGEX = /^[rubf]+$/i;

export function detectPythonDocstring(
  content: string,
  language: string
): DocstringInfo | null {
  const start = findPythonDocstringStart(content);
  if (!start) {
    return null;
  }

  const { index, delimiter } = start;
  const endIndex = content.indexOf(delimiter, index + delimiter.length);
  if (endIndex === -1) {
    return null;
  }

  const raw = content.slice(index, endIndex + delimiter.length);
  const { startLine, endLine } = lineRangeFromMatch(content, raw, index);
  const contentText = stripDelimitedDocstring(raw, delimiter);
  const kind = classifyPythonPlacement(
    content,
    index,
    endIndex + delimiter.length
  );

  return {
    language,
    kind,
    format: "python",
    raw,
    content: contentText,
    startLine,
    endLine,
  };
}

function findPythonDocstringStart(
  content: string
): { index: number; delimiter: string } | null {
  const delimiters = ['"""', "'''"];
  let searchIndex = 0;

  while (searchIndex < content.length) {
    let earliestIndex = -1;
    let delimiter = "";

    for (const candidate of delimiters) {
      const found = content.indexOf(candidate, searchIndex);
      if (found !== -1 && (earliestIndex === -1 || found < earliestIndex)) {
        earliestIndex = found;
        delimiter = candidate;
      }
    }

    if (earliestIndex === -1) {
      return null;
    }

    if (isPythonDocstringStart(content, earliestIndex)) {
      return { index: earliestIndex, delimiter };
    }

    searchIndex = earliestIndex + 1;
  }

  return null;
}

function isPythonDocstringStart(content: string, index: number): boolean {
  const prefix = getLinePrefix(content, index);
  return isLinePrefixAllowed(prefix, PYTHON_PREFIX_REGEX);
}

function classifyPythonPlacement(
  content: string,
  startIndex: number,
  endIndex: number
): DocstringKind {
  const before = content.slice(0, startIndex);
  const prefix = getLinePrefix(content, startIndex);
  const isTopLevel = prefix.trim().length === 0;

  if (isTopLevel && isPythonPreambleOnly(before)) {
    return "file";
  }

  const previousLine = findPreviousNonEmptyLine(before);
  if (previousLine && PYTHON_OWNER_REGEX.test(previousLine)) {
    return "function";
  }

  const nextLine = findNextNonEmptyLine(content.slice(endIndex));
  if (nextLine && PYTHON_OWNER_REGEX.test(nextLine)) {
    return "function";
  }

  return "function";
}

function isPythonPreambleOnly(content: string): boolean {
  const lines = content.split("\n");
  return lines.every((line) => {
    const trimmed = line.trim();
    if (trimmed.length === 0) {
      return true;
    }
    if (trimmed.startsWith("#!")) {
      return true;
    }
    if (trimmed.startsWith("#") && trimmed.includes("coding")) {
      return true;
    }
    // Recognize import statements as part of preamble
    if (trimmed.startsWith("import ") || trimmed.startsWith("from ")) {
      return true;
    }
    return false;
  });
}
