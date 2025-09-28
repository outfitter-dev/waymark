// tldr ::: core waymark utilities with caching and scanning

export const version = "0.0.0";

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

export { WaymarkCache } from "./cache";
export type { ConfigScope, LoadConfigOptions } from "./config";
export {
  DEFAULT_CONFIG,
  loadConfigFromDisk,
  resolveConfig,
} from "./config";
export type { FormatEdit, FormatOptions, FormatResult } from "./format";
export { formatText } from "./format";
export type { GraphEdge, WaymarkGraph } from "./graph";
export { buildRelationGraph } from "./graph";
export type { WaymarkMap } from "./map";
export { buildWaymarkMap } from "./map";
export type {
  NormalizeMarkerOptions,
  NormalizeRecordOptions,
} from "./normalize";
export {
  normalizeCanonicals,
  normalizeMarker,
  normalizeMentions,
  normalizeProperties,
  normalizeRecord,
  normalizeRelations,
  normalizeTags,
} from "./normalize";
export type { SearchQuery } from "./search";
export { searchRecords } from "./search";
export type { ScanOptions, WaymarkConfig } from "./types";
