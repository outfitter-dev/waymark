// tldr ::: core waymark utilities with caching and scanning

export const version = "1.0.0-beta.1";

export type { ParseOptions, WaymarkRecord } from "@waymarks/grammar";
// biome-ignore lint/performance/noBarrelFile: Intentional re-export of grammar for convenience
export {
  BLESSED_MARKERS,
  isValidType,
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
export {
  type HistoryEntry,
  type IdIndexEntry,
  JsonIdIndex,
} from "./id-index";
export {
  fingerprintContent,
  fingerprintContext,
  WaymarkIdManager,
} from "./ids";
export type { InsertionResult, InsertionSpec, InsertOptions } from "./insert";
export { InsertionSpecSchema, insertWaymarks } from "./insert";
export type {
  NormalizeRecordOptions,
  NormalizeTypeOptions,
} from "./normalize";
export {
  normalizeCanonicals,
  normalizeMentions,
  normalizeProperties,
  normalizeRecord,
  normalizeRelations,
  normalizeTags,
  normalizeType,
} from "./normalize";
export type {
  RemovalCriteria,
  RemovalResult,
  RemovalSpec,
  RemoveOptions,
} from "./remove";
export {
  RemovalCriteriaSchema,
  RemovalSpecSchema,
  removeWaymarks,
} from "./remove";
export type { SearchQuery } from "./search";
export { searchRecords } from "./search";
export type { ScanOptions, WaymarkConfig } from "./types";
