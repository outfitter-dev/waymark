// tldr ::: docstring detection and summary extraction utilities

import { detectJsDocstring } from "./js";
import { detectPythonDocstring } from "./python";
import { detectRubyDocstring } from "./ruby";
import { detectRustDocstring } from "./rust";
import type { DocstringInfo } from "./types";

export type { DocstringFormat, DocstringInfo, DocstringKind } from "./types";

const JS_LANGUAGES = new Set([
  "javascript",
  "typescript",
  "js",
  "ts",
  "jsx",
  "tsx",
]);
const PYTHON_LANGUAGES = new Set(["python", "py"]);
const RUBY_LANGUAGES = new Set(["ruby", "rb"]);
const RUST_LANGUAGES = new Set(["rust", "rs"]);

export function detectDocstring(
  content: string,
  language: string
): DocstringInfo | null {
  const normalized = language.toLowerCase();
  if (JS_LANGUAGES.has(normalized)) {
    return detectJsDocstring(content, normalized);
  }
  if (PYTHON_LANGUAGES.has(normalized)) {
    return detectPythonDocstring(content, normalized);
  }
  if (RUBY_LANGUAGES.has(normalized)) {
    return detectRubyDocstring(content, normalized);
  }
  if (RUST_LANGUAGES.has(normalized)) {
    return detectRustDocstring(content, normalized);
  }
  return null;
}

export function extractSummary(docstring: DocstringInfo): string {
  const lines = docstring.content.split("\n").map((line) => line.trim());

  const summaryLines: string[] = [];
  let started = false;

  for (const line of lines) {
    if (!started && line.length === 0) {
      continue;
    }

    if (line.length === 0) {
      break;
    }

    if (line.startsWith("@")) {
      break;
    }

    started = true;
    summaryLines.push(line);
  }

  return summaryLines.join(" ").trim();
}
