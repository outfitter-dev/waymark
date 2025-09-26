// tldr ::: configuration and scanning types for waymark core

// Re-export grammar types for convenience
export type { ParseOptions, WaymarkRecord } from "@waymarks/grammar";

export type WaymarkConfig = {
  markerCase: "lowercase" | "uppercase";
  idScope: "repo" | "file";
  protectedBranches: string[];
  signalsOnProtected: "strip" | "fail" | "allow";
  allowMarkers: string[];
  skipPaths: string[];
  format: {
    spaceAroundSigil: boolean;
    normalizeCase: boolean;
  };
  lint: {
    duplicateProperty: "warn" | "error" | "ignore";
    unknownMarker: "warn" | "error" | "ignore";
    danglingRelation: "warn" | "error" | "ignore";
    duplicateCanonical: "warn" | "error" | "ignore";
  };
};

import type { WaymarkRecord } from "@waymarks/grammar";

export type ScanOptions = {
  cache?: boolean;
  filter?: (record: WaymarkRecord) => boolean;
  config?: Partial<WaymarkConfig>;
};
