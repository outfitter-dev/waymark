// tldr ::: file language and category inference for waymark records

import { extname } from "node:path";
import { getLanguageId } from "./languages";
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

/**
 * Infer language identifier from a file path.
 * Uses the language registry as the primary source of truth,
 * falling back to extension-based logic for edge cases.
 *
 * @param filePath - File path to inspect.
 * @returns Language identifier string.
 */
export function inferLanguageFromFile(filePath: string | undefined): string {
  if (!filePath) {
    return "unknown";
  }

  // Try language registry first (single source of truth)
  const langId = getLanguageId(filePath);
  if (langId) {
    return langId;
  }

  // Fall back to existing logic for edge cases not in registry
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
/**
 * Infer a file category (code/docs/config/etc) from a file path.
 * @param filePath - File path to inspect.
 * @returns File category value.
 */
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
