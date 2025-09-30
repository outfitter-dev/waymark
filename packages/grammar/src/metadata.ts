// tldr ::: file language and category inference for waymark records

import { extname } from "node:path";
import type { WaymarkRecord } from "./types";

// todo ::: @codex externalize comment leader detection into shared language metadata #lib/parser

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

export function inferLanguageFromFile(filePath: string | undefined): string {
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
export function inferFileCategory(
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
