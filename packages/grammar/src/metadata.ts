// tldr ::: file language and category inference for waymark records

import { extname } from "node:path";
import { getLanguageId } from "./languages";
import type { WaymarkRecord } from "./types";

// todo ::: @codex externalize comment leader detection into shared language metadata #lib/parser

/**
 * Registry for file category classification.
 * Maps file extensions and path patterns to category types.
 */
export type FileCategoryRegistry = {
  readonly docs: { readonly extensions: ReadonlySet<string> };
  readonly config: { readonly extensions: ReadonlySet<string> };
  readonly data: { readonly extensions: ReadonlySet<string> };
  readonly test: {
    readonly suffixes: ReadonlySet<string>;
    readonly pathTokens: ReadonlySet<string>;
  };
};

// Default extension sets for file categories
const DEFAULT_DOC_EXTENSIONS = new Set([
  ".md",
  ".mdx",
  ".markdown",
  ".txt",
  ".rst",
]);
const DEFAULT_CONFIG_EXTENSIONS = new Set([
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
const DEFAULT_DATA_EXTENSIONS = new Set([
  ".csv",
  ".tsv",
  ".ndjson",
  ".jsonl",
  ".parquet",
]);
const DEFAULT_TEST_SUFFIXES = new Set([
  ".test.ts",
  ".test.tsx",
  ".test.js",
  ".test.jsx",
  ".spec.ts",
  ".spec.tsx",
  ".spec.js",
  ".spec.jsx",
]);
const DEFAULT_TEST_PATH_TOKENS = new Set([
  ".test.",
  ".spec.",
  ".stories.",
  "__tests__",
  "__mocks__",
]);

/**
 * Default file category registry with comprehensive extension and pattern mappings.
 * Covers documentation, configuration, data, and test file types.
 */
export const DEFAULT_FILE_CATEGORY_REGISTRY: FileCategoryRegistry =
  Object.freeze({
    docs: Object.freeze({ extensions: DEFAULT_DOC_EXTENSIONS }),
    config: Object.freeze({ extensions: DEFAULT_CONFIG_EXTENSIONS }),
    data: Object.freeze({ extensions: DEFAULT_DATA_EXTENSIONS }),
    test: Object.freeze({
      suffixes: DEFAULT_TEST_SUFFIXES,
      pathTokens: DEFAULT_TEST_PATH_TOKENS,
    }),
  });

/**
 * Configuration shape for file category overrides.
 * Used to customize file category inference via config files.
 */
export type FileCategoryConfig = {
  docs?: string[];
  config?: string[];
  data?: string[];
  test?: {
    suffixes?: string[];
    pathTokens?: string[];
  };
};

/**
 * Merge custom extensions into a default set, normalizing to include leading dot.
 */
function mergeExtensions(
  defaults: ReadonlySet<string>,
  custom?: string[]
): Set<string> {
  const result = new Set(defaults);
  if (custom) {
    for (const ext of custom) {
      result.add(ext.startsWith(".") ? ext : `.${ext}`);
    }
  }
  return result;
}

/**
 * Merge custom strings into a default set without modification.
 */
function mergeStrings(
  defaults: ReadonlySet<string>,
  custom?: string[]
): Set<string> {
  const result = new Set(defaults);
  if (custom) {
    for (const item of custom) {
      result.add(item);
    }
  }
  return result;
}

/**
 * Build a file category registry from config, merging with defaults.
 * Extensions provided in config are added to the default sets.
 *
 * @param config - Optional category configuration overrides.
 * @returns A complete FileCategoryRegistry merged with defaults.
 *
 * @example
 * ```typescript
 * // Add custom doc extension
 * const registry = buildFileCategoryRegistry({ docs: [".adoc"] });
 * inferFileCategory("file.adoc", registry) // => "docs"
 * ```
 */
export function buildFileCategoryRegistry(
  config?: FileCategoryConfig
): FileCategoryRegistry {
  if (!config) {
    return DEFAULT_FILE_CATEGORY_REGISTRY;
  }

  return {
    docs: { extensions: mergeExtensions(DEFAULT_DOC_EXTENSIONS, config.docs) },
    config: {
      extensions: mergeExtensions(DEFAULT_CONFIG_EXTENSIONS, config.config),
    },
    data: { extensions: mergeExtensions(DEFAULT_DATA_EXTENSIONS, config.data) },
    test: {
      suffixes: mergeStrings(DEFAULT_TEST_SUFFIXES, config.test?.suffixes),
      pathTokens: mergeStrings(
        DEFAULT_TEST_PATH_TOKENS,
        config.test?.pathTokens
      ),
    },
  };
}

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

// done ::: allow configurable overrides for file category inference #lib/parser
/**
 * Infer a file category (code/docs/config/etc) from a file path.
 * Uses the registry for category classification with code as the default fallback.
 *
 * @param filePath - File path to inspect.
 * @param registry - File category registry to use (defaults to DEFAULT_FILE_CATEGORY_REGISTRY).
 * @returns File category value.
 *
 * @example
 * ```typescript
 * inferFileCategory("README.md")           // => "docs"
 * inferFileCategory("package.json")        // => "config"
 * inferFileCategory("data.csv")            // => "data"
 * inferFileCategory("utils.test.ts")       // => "test"
 * inferFileCategory("index.ts")            // => "code"
 *
 * // With custom registry
 * const custom = { docs: { extensions: new Set([".doc"]) }, ... };
 * inferFileCategory("report.doc", custom)  // => "docs"
 * ```
 */
export function inferFileCategory(
  filePath: string | undefined,
  registry: FileCategoryRegistry = DEFAULT_FILE_CATEGORY_REGISTRY
): WaymarkRecord["fileCategory"] {
  if (!filePath) {
    return "code";
  }

  const lower = filePath.toLowerCase();
  const ext = extname(lower);

  // Check docs extensions
  if (registry.docs.extensions.has(ext)) {
    return "docs";
  }

  // Check config extensions
  if (registry.config.extensions.has(ext)) {
    return "config";
  }

  // Check data extensions
  if (registry.data.extensions.has(ext)) {
    return "data";
  }

  // Check test suffixes
  for (const suffix of registry.test.suffixes) {
    if (lower.endsWith(suffix)) {
      return "test";
    }
  }

  // Check test path tokens
  for (const token of registry.test.pathTokens) {
    if (lower.includes(token)) {
      return "test";
    }
  }

  return "code";
}
