// tldr ::: shared types for display formatting utilities

import type { UnifiedCommandOptions } from "../../commands/unified/types";

export type DisplayOptions = Pick<
  UnifiedCommandOptions,
  | "displayMode"
  | "contextBefore"
  | "contextAfter"
  | "contextAround"
  | "groupBy"
  | "sortBy"
  | "reverse"
  | "limit"
  | "page"
  | "compact"
  | "noColor"
  | "noWrap"
>;

export const DEFAULT_PAGE_SIZE = 50;
