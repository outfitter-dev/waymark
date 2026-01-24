// tldr ::: Rust docstring detection utilities

import {
  findNextNonEmptyLine,
  type LineBlock,
  stripLinePrefix,
} from "./shared";
import type { DocstringInfo, DocstringKind } from "./types";

const RUST_OWNER_REGEX = /^\s*(fn|struct|enum|impl|trait|mod)\b/;

export function detectRustDocstring(
  content: string,
  language: string
): DocstringInfo | null {
  const lines = content.split("\n");
  const block = findRustDocBlock(lines);
  if (!block) {
    return null;
  }

  const { startIndex, endIndex, prefix } = block;
  const raw = lines.slice(startIndex, endIndex + 1).join("\n");
  const contentText = stripLinePrefix(raw, new RegExp(`^\\s*${prefix}\\s?`));
  const kind = classifyRustPlacement(lines, block, prefix);

  return {
    language,
    kind,
    format: "rust",
    raw,
    content: contentText,
    startLine: startIndex + 1,
    endLine: endIndex + 1,
  };
}

type RustBlock = LineBlock & { prefix: "///" | "//!" };

function findRustDocBlock(lines: string[]): RustBlock | null {
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    if (!line) {
      continue;
    }
    const trimmed = line.trimStart();
    const prefix = rustPrefixFromLine(trimmed);
    if (!prefix) {
      continue;
    }

    let endIndex = i;
    while (endIndex + 1 < lines.length) {
      const nextLine = lines[endIndex + 1];
      if (!nextLine) {
        break;
      }
      const nextTrimmed = nextLine.trimStart();
      const nextPrefix = rustPrefixFromLine(nextTrimmed);
      if (nextPrefix === prefix) {
        endIndex += 1;
        continue;
      }
      break;
    }

    return { startIndex: i, endIndex, prefix };
  }

  return null;
}

function rustPrefixFromLine(trimmedLine: string): "///" | "//!" | null {
  if (trimmedLine.startsWith("///")) {
    return "///";
  }
  if (trimmedLine.startsWith("//!")) {
    return "//!";
  }
  return null;
}

function classifyRustPlacement(
  lines: string[],
  block: RustBlock,
  prefix: "///" | "//!"
): DocstringKind {
  const beforeLines = lines.slice(0, block.startIndex);
  const preambleOnly = beforeLines.every((line) => isRustPreambleLine(line));

  if (prefix === "//!" && preambleOnly) {
    return "file";
  }

  if (preambleOnly && prefix === "///") {
    const nextLine = findNextNonEmptyLine(
      lines.slice(block.endIndex + 1).join("\n")
    );
    if (nextLine && RUST_OWNER_REGEX.test(nextLine)) {
      return "function";
    }
  }

  const nextLine = findNextNonEmptyLine(
    lines.slice(block.endIndex + 1).join("\n")
  );
  if (nextLine && RUST_OWNER_REGEX.test(nextLine)) {
    return "function";
  }

  return prefix === "//!" ? "file" : "function";
}

function isRustPreambleLine(line: string): boolean {
  const trimmed = line.trim();
  if (trimmed.length === 0) {
    return true;
  }
  if (trimmed.startsWith("//")) {
    return true;
  }
  if (trimmed.startsWith("#![")) {
    return true;
  }
  return false;
}
