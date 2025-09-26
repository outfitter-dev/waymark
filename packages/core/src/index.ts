// tldr ::: core waymark utilities with caching and scanning

export const version = "0.0.0";

// Re-export specific grammar exports
export type { ParseOptions, WaymarkRecord } from "@waymarks/grammar";
// biome-ignore lint/performance/noBarrelFile: Intentional re-export of grammar for convenience
export {
  BLESSED_MARKERS,
  isValidMarker,
  parse,
  parseLine,
  SIGIL,
  SIGNALS,
} from "@waymarks/grammar";
// Export cache functionality
export { WaymarkCache } from "./cache";
// Export core types
export type { ScanOptions, WaymarkConfig } from "./types";
