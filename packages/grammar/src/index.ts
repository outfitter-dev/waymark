// tldr ::: waymark grammar parser exports

// biome-ignore lint/performance/noBarrelFile: Intentional grammar exports
export {
  BLESSED_MARKERS,
  getCanonicalType,
  getTypeCategory,
  MARKER_DEFINITIONS,
  MARKERS,
  PROPERTY_KEYS,
  SIGIL,
  SIGNALS,
} from "./constants";
export type {
  DocstringFormat,
  DocstringInfo,
  DocstringKind,
} from "./docstrings";
export { detectDocstring, extractSummary } from "./docstrings";
export type { CommentCapability, LanguageRegistry } from "./languages";
export {
  canHaveComments,
  DEFAULT_LANGUAGE_REGISTRY,
  getCommentCapability,
  getLanguageId,
} from "./languages";
export type { FileCategoryConfig, FileCategoryRegistry } from "./metadata";
export {
  buildFileCategoryRegistry,
  DEFAULT_FILE_CATEGORY_REGISTRY,
  inferFileCategory,
  inferLanguageFromFile,
} from "./metadata";
export { isValidType, parse, parseLine } from "./parser";
export {
  MENTION_REGEX,
  PROPERTY_REGEX,
  TAG_REGEX,
} from "./properties";
export type { ParseOptions, WaymarkRecord } from "./types";
