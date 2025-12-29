// tldr ::: configuration and scanning types for waymark core

// Re-export grammar types for convenience
export type { ParseOptions, WaymarkRecord } from "@waymarks/grammar";

export type WaymarkFormatConfig = {
  spaceAroundSigil: boolean;
  normalizeCase: boolean;
  alignContinuations?: boolean;
  wrapEnabled?: boolean;
  wrapWidth?: number;
};

export type WaymarkLintConfig = {
  duplicateProperty: "warn" | "error" | "ignore";
  unknownMarker: "warn" | "error" | "ignore";
  danglingRelation: "warn" | "error" | "ignore";
  duplicateCanonical: "warn" | "error" | "ignore";
};

export type WaymarkScanConfig = {
  includeCodetags: boolean;
};

export type WaymarkConfig = {
  typeCase: "lowercase" | "uppercase";
  idScope: "repo" | "file";
  protectedBranches: string[];
  signalsOnProtected: "strip" | "fail" | "allow";
  allowTypes: string[];
  skipPaths: string[];
  includePaths: string[];
  respectGitignore: boolean;
  scan: WaymarkScanConfig;
  format: WaymarkFormatConfig;
  lint: WaymarkLintConfig;
  ids: WaymarkIdConfig;
  index: WaymarkIndexConfig;
};

// Manually defined partial config to work with exactOptionalPropertyTypes
export type PartialWaymarkConfig = {
  typeCase?: "lowercase" | "uppercase";
  idScope?: "repo" | "file";
  protectedBranches?: string[];
  signalsOnProtected?: "strip" | "fail" | "allow";
  allowTypes?: string[];
  skipPaths?: string[];
  includePaths?: string[];
  respectGitignore?: boolean;
  scan?: Partial<WaymarkScanConfig>;
  format?: Partial<WaymarkFormatConfig>;
  lint?: Partial<WaymarkLintConfig>;
  ids?: Partial<WaymarkIdConfig>;
  index?: Partial<WaymarkIndexConfig>;
};

export type ScanOptions = {
  cache?: boolean;
  filter?: (record: import("@waymarks/grammar").WaymarkRecord) => boolean;
  config?: Partial<WaymarkConfig>;
};

export type WaymarkIdConfig = {
  mode: "auto" | "prompt" | "off" | "manual";
  length: number;
  rememberUserChoice: boolean;
  trackHistory: boolean;
  assignOnRefresh: boolean;
};

export type WaymarkIndexConfig = {
  refreshTriggers: string[];
  autoRefreshAfterMinutes: number;
};

export type CoreLogger = {
  debug: (msg: string, meta?: Record<string, unknown>) => void;
  info: (msg: string, meta?: Record<string, unknown>) => void;
  warn: (msg: string, meta?: Record<string, unknown>) => void;
  error: (msg: string, meta?: Record<string, unknown>) => void;
};
