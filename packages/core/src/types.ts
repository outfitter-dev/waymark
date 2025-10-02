// tldr ::: configuration and scanning types for waymark core

// Re-export grammar types for convenience
export type { ParseOptions, WaymarkRecord } from "@waymarks/grammar";

export type WaymarkFormatConfig = {
  spaceAroundSigil: boolean;
  normalizeCase: boolean;
  alignContinuations?: boolean;
};

export type WaymarkLintConfig = {
  duplicateProperty: "warn" | "error" | "ignore";
  unknownMarker: "warn" | "error" | "ignore";
  danglingRelation: "warn" | "error" | "ignore";
  duplicateCanonical: "warn" | "error" | "ignore";
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
  format: WaymarkFormatConfig;
  lint: WaymarkLintConfig;
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
  format?: Partial<WaymarkFormatConfig>;
  lint?: Partial<WaymarkLintConfig>;
};

import type { WaymarkRecord } from "@waymarks/grammar";

export type ScanOptions = {
  cache?: boolean;
  filter?: (record: WaymarkRecord) => boolean;
  config?: Partial<WaymarkConfig>;
};
