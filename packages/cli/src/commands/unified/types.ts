// tldr ::: type definitions for unified wm command

export type DisplayMode = "text" | "long" | "tree" | "flat" | "graph";
export type GroupBy =
  | "file"
  | "dir"
  | "type"
  | "signal"
  | "mention"
  | "tag"
  | "property"
  | "relation"
  | "none";
export type SortBy =
  | "file"
  | "line"
  | "type"
  | "signal"
  | "modified"
  | "created"
  | "added"
  | "none";

export type UnifiedCommandOptions = {
  filePaths: string[];
  // Mode detection
  isMapMode: boolean;
  isGraphMode: boolean;
  // Filters
  types?: string[];
  tags?: string[];
  mentions?: string[];
  raised?: boolean;
  starred?: boolean;
  // Exclusions
  excludeTypes?: string[];
  excludeTags?: string[];
  excludeMentions?: string[];
  // Display modes
  displayMode?: DisplayMode;
  // Context display
  contextBefore?: number;
  contextAfter?: number;
  contextAround?: number;
  // Grouping & sorting
  groupBy?: GroupBy;
  sortBy?: SortBy;
  reverse?: boolean;
  // Pagination
  limit?: number;
  page?: number;
  // Output
  json?: boolean;
  summary?: boolean;
};
