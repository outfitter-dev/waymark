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

export type PartialWaymarkConfig = {
  markerCase?: WaymarkConfig["markerCase"];
  idScope?: WaymarkConfig["idScope"];
  protectedBranches?: string[];
  signalsOnProtected?: WaymarkConfig["signalsOnProtected"];
  allowMarkers?: string[];
  skipPaths?: string[];
  format?: Partial<WaymarkFormatConfig>;
  lint?: Partial<WaymarkLintConfig>;
};

export type WaymarkConfig = {
  markerCase: "lowercase" | "uppercase";
  idScope: "repo" | "file";
  protectedBranches: string[];
  signalsOnProtected: "strip" | "fail" | "allow";
  allowMarkers: string[];
  skipPaths: string[];
  format: WaymarkFormatConfig;
  lint: WaymarkLintConfig;
};

import type { WaymarkRecord } from "@waymarks/grammar";

export type ScanOptions = {
  cache?: boolean;
  filter?: (record: WaymarkRecord) => boolean;
  config?: Partial<WaymarkConfig>;
};
