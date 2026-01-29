// tldr ::: configuration and scanning types for waymark core

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
