// tldr ::: configuration and scanning types with Zod schemas for waymark core

import { z } from "zod";

// Re-export grammar types for convenience
export type { ParseOptions, WaymarkRecord } from "@waymarks/grammar";

/**
 * Configuration for language-specific comment handling.
 * Allows overriding or extending the default language registry.
 */
export type LanguageConfig = {
  /** Map file extension (with leading dot) to comment leaders */
  extensions?: Record<string, string[]>;
  /** Map exact basename to comment leaders */
  basenames?: Record<string, string[]>;
  /** When true, skip files with unknown extensions (default: false = try to parse) */
  skipUnknown?: boolean;
};

/**
 * Configuration for file category classification.
 * Allows overriding file extensions and patterns for category inference.
 */
export type FileCategoryConfig = {
  /** Extensions to classify as documentation (e.g., [".md", ".rst"]) */
  docs?: string[];
  /** Extensions to classify as configuration (e.g., [".json", ".yaml"]) */
  config?: string[];
  /** Extensions to classify as data files (e.g., [".csv", ".parquet"]) */
  data?: string[];
  /** Test file patterns */
  test?: {
    /** File suffixes that indicate test files (e.g., [".test.ts", ".spec.js"]) */
    suffixes?: string[];
    /** Path tokens that indicate test directories (e.g., ["__tests__", "cypress"]) */
    pathTokens?: string[];
  };
};

/** Formatting controls for rendered waymark comments. */
export type WaymarkFormatConfig = {
  spaceAroundSigil: boolean;
  normalizeCase: boolean;
  alignContinuations?: boolean;
  wrapEnabled?: boolean;
  wrapWidth?: number;
};

/** Lint severity configuration for waymark validation. */
export type WaymarkLintConfig = {
  duplicateProperty: "warn" | "error" | "ignore";
  unknownMarker: "warn" | "error" | "ignore";
  danglingRelation: "warn" | "error" | "ignore";
  duplicateCanonical: "warn" | "error" | "ignore";
};

/** Scan-time toggles for including additional markers. */
export type WaymarkScanConfig = {
  includeCodetags: boolean;
  /** Include waymarks inside wm:ignore fences (default: false). */
  includeIgnored: boolean;
};

/** Full configuration shape for waymark operations. */
export type WaymarkConfig = {
  typeCase: "lowercase" | "uppercase";
  idScope: "repo" | "file";
  allowTypes: string[];
  skipPaths: string[];
  includePaths: string[];
  respectGitignore: boolean;
  scan: WaymarkScanConfig;
  format: WaymarkFormatConfig;
  lint: WaymarkLintConfig;
  ids: WaymarkIdConfig;
  index: WaymarkIndexConfig;
  languages?: LanguageConfig;
  categories?: FileCategoryConfig;
};

/** Partial configuration shape for overrides. */
export type PartialWaymarkConfig = {
  typeCase?: "lowercase" | "uppercase";
  idScope?: "repo" | "file";
  allowTypes?: string[];
  skipPaths?: string[];
  includePaths?: string[];
  respectGitignore?: boolean;
  scan?: Partial<WaymarkScanConfig>;
  format?: Partial<WaymarkFormatConfig>;
  lint?: Partial<WaymarkLintConfig>;
  ids?: Partial<WaymarkIdConfig>;
  index?: Partial<WaymarkIndexConfig>;
  languages?: Partial<LanguageConfig>;
  categories?: Partial<FileCategoryConfig>;
};

/** Options that control scanning and filtering waymarks. */
export type ScanOptions = {
  cache?: boolean;
  filter?: (record: import("@waymarks/grammar").WaymarkRecord) => boolean;
  config?: Partial<WaymarkConfig>;
};

/** Configuration for waymark ID assignment. */
export type WaymarkIdConfig = {
  mode: "auto" | "prompt" | "off" | "manual";
  length: number;
  rememberUserChoice: boolean;
  trackHistory: boolean;
  assignOnRefresh: boolean;
};

/** Configuration for the on-disk ID index refresh behavior. */
export type WaymarkIndexConfig = {
  refreshTriggers: string[];
  autoRefreshAfterMinutes: number;
};

/** Minimal logger interface used by core utilities. */
export type CoreLogger = {
  debug: (msg: string, meta?: Record<string, unknown>) => void;
  info: (msg: string, meta?: Record<string, unknown>) => void;
  warn: (msg: string, meta?: Record<string, unknown>) => void;
  error: (msg: string, meta?: Record<string, unknown>) => void;
};

// ---------------------------------------------------------------------------
// Zod Schemas
// ---------------------------------------------------------------------------

/**
 * Rename snake_case keys to camelCase in a shallow object.
 * Leaves keys that are already camelCase untouched.
 */
function snakeToCamel(input: unknown): unknown {
  if (typeof input !== "object" || input === null || Array.isArray(input)) {
    return input;
  }
  const raw = input as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  for (const key of Object.keys(raw)) {
    const camelKey = key.replace(/_([a-z])/g, (_, c: string) =>
      c.toUpperCase()
    );
    out[camelKey] = raw[key];
  }
  return out;
}

/** Lint severity levels used in waymark configuration. */
const LintSeveritySchema = z.enum(["warn", "error", "ignore"]);

/** Zod schema for {@link WaymarkScanConfig}. Accepts snake_case aliases. */
export const WaymarkScanConfigSchema = z.preprocess(
  snakeToCamel,
  z.object({
    includeCodetags: z.boolean(),
    includeIgnored: z.boolean(),
  })
);

/** Zod schema for {@link WaymarkFormatConfig}. Accepts snake_case aliases. */
export const WaymarkFormatConfigSchema = z.preprocess(
  snakeToCamel,
  z.object({
    spaceAroundSigil: z.boolean(),
    normalizeCase: z.boolean(),
    alignContinuations: z.boolean().optional(),
    wrapEnabled: z.boolean().optional(),
    wrapWidth: z.number().int().positive().optional(),
  })
);

/** Zod schema for {@link WaymarkLintConfig}. Accepts snake_case aliases. */
export const WaymarkLintConfigSchema = z.preprocess(
  snakeToCamel,
  z.object({
    duplicateProperty: LintSeveritySchema,
    unknownMarker: LintSeveritySchema,
    danglingRelation: LintSeveritySchema,
    duplicateCanonical: LintSeveritySchema,
  })
);

/** Zod schema for {@link WaymarkIdConfig}. Accepts snake_case aliases. */
export const WaymarkIdConfigSchema = z.preprocess(
  snakeToCamel,
  z.object({
    mode: z.enum(["auto", "prompt", "off", "manual"]),
    length: z.number().int().positive(),
    rememberUserChoice: z.boolean(),
    trackHistory: z.boolean(),
    assignOnRefresh: z.boolean(),
  })
);

/** Zod schema for {@link WaymarkIndexConfig}. Accepts snake_case aliases. */
export const WaymarkIndexConfigSchema = z.preprocess(
  snakeToCamel,
  z.object({
    refreshTriggers: z.array(z.string()),
    autoRefreshAfterMinutes: z.number().min(0),
  })
);

/**
 * Normalizes extension map entries: filters non-array values and ensures
 * keys have a leading dot.
 */
function normalizeExtensionMap(
  input: unknown
): Record<string, string[]> | undefined {
  if (typeof input !== "object" || input === null || Array.isArray(input)) {
    return;
  }
  const raw = input as Record<string, unknown>;
  const out: Record<string, string[]> = {};
  for (const [ext, leaders] of Object.entries(raw)) {
    if (!Array.isArray(leaders)) {
      continue;
    }
    const filtered = leaders.filter((l): l is string => typeof l === "string");
    const key = ext.startsWith(".") ? ext : `.${ext}`;
    out[key] = filtered;
  }
  return Object.keys(out).length > 0 ? out : undefined;
}

/** Zod schema for {@link LanguageConfig}. Accepts snake_case aliases. */
export const LanguageConfigSchema = z.preprocess(
  snakeToCamel,
  z
    .object({
      extensions: z.preprocess(
        normalizeExtensionMap,
        z.record(z.string(), z.array(z.string())).optional()
      ),
      basenames: z.record(z.string(), z.array(z.string())).optional(),
      skipUnknown: z.boolean().optional(),
    })
    .strict()
    .optional()
);

/**
 * Normalizes category extension arrays: ensures entries have a leading dot.
 */
function normalizeDotArray(input: unknown): string[] | undefined {
  if (!Array.isArray(input)) {
    return;
  }
  return input
    .filter((item): item is string => typeof item === "string")
    .map((ext) => (ext.startsWith(".") ? ext : `.${ext}`));
}

/** Zod schema for {@link FileCategoryConfig}. Accepts snake_case aliases. */
export const FileCategoryConfigSchema = z.preprocess(
  snakeToCamel,
  z
    .object({
      docs: z.preprocess(normalizeDotArray, z.array(z.string()).optional()),
      config: z.preprocess(normalizeDotArray, z.array(z.string()).optional()),
      data: z.preprocess(normalizeDotArray, z.array(z.string()).optional()),
      test: z.preprocess(
        snakeToCamel,
        z
          .object({
            suffixes: z.array(z.string()).optional(),
            pathTokens: z.array(z.string()).optional(),
          })
          .optional()
      ),
    })
    .strict()
    .optional()
);

/**
 * Zod schema for the full {@link WaymarkConfig}.
 *
 * Accepts both camelCase and snake_case keys at the top level and within
 * nested objects. Use `.safeParse()` to validate unknown input from disk.
 */
export const WaymarkConfigSchema = z.preprocess(
  snakeToCamel,
  z.object({
    typeCase: z.enum(["lowercase", "uppercase"]),
    idScope: z.enum(["repo", "file"]),
    allowTypes: z.array(z.string()),
    skipPaths: z.array(z.string()),
    includePaths: z.array(z.string()),
    respectGitignore: z.boolean(),
    scan: WaymarkScanConfigSchema,
    format: WaymarkFormatConfigSchema,
    lint: WaymarkLintConfigSchema,
    ids: WaymarkIdConfigSchema,
    index: WaymarkIndexConfigSchema,
    languages: LanguageConfigSchema,
    categories: FileCategoryConfigSchema,
  })
);
