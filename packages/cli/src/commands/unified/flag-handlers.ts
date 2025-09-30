// tldr ::: flag handling utilities for unified wm command

import type { createArgIterator } from "../../utils/flags/iterator";
import {
  parseEnumValue,
  parseNonNegativeInt,
  parsePositiveInt,
} from "./parsers";
import type { GroupBy, SortBy } from "./types";

export type ParseState = {
  positional: string[];
  types: string[];
  tags: string[];
  mentions: string[];
  excludeTypes: string[];
  excludeTags: string[];
  excludeMentions: string[];
  jsonState: { json: boolean };
  summaryState: { summary: boolean };
  isMapMode: boolean;
  isGraphMode: boolean;
  raised: boolean | undefined;
  starred: boolean | undefined;
  displayMode: "text" | "long" | "tree" | "flat" | "graph" | undefined;
  contextBefore: number | undefined;
  contextAfter: number | undefined;
  contextAround: number | undefined;
  groupBy: GroupBy | undefined;
  sortBy: SortBy | undefined;
  reverse: boolean;
  limit: number | undefined;
  page: number | undefined;
};

/**
 * Handle context display flags
 */
export function handleContextFlags(
  token: string,
  iterator: ReturnType<typeof createArgIterator>,
  state: ParseState
): boolean {
  if (token === "--context" || token === "-C") {
    state.contextAround = parseNonNegativeInt(token, iterator);
    return true;
  }
  if (token === "--before-context" || token === "-B") {
    state.contextBefore = parseNonNegativeInt(token, iterator);
    return true;
  }
  if (token === "--after-context" || token === "-A") {
    state.contextAfter = parseNonNegativeInt(token, iterator);
    return true;
  }
  return false;
}

/**
 * Handle grouping and sorting flags
 */
export function handleGroupSortFlags(
  token: string,
  iterator: ReturnType<typeof createArgIterator>,
  state: ParseState
): boolean {
  if (token === "--group") {
    state.groupBy = parseEnumValue<GroupBy>(token, iterator, [
      "file",
      "dir",
      "type",
      "signal",
      "mention",
      "tag",
      "property",
      "relation",
      "none",
    ]);
    return true;
  }
  if (token === "--sort") {
    state.sortBy = parseEnumValue<SortBy>(token, iterator, [
      "file",
      "line",
      "type",
      "signal",
      "modified",
      "created",
      "added",
      "none",
    ]);
    return true;
  }
  if (token === "--reverse") {
    state.reverse = true;
    return true;
  }
  return false;
}

/**
 * Handle pagination flags
 */
export function handlePaginationFlags(
  token: string,
  iterator: ReturnType<typeof createArgIterator>,
  state: ParseState
): boolean {
  if (token === "--limit") {
    state.limit = parsePositiveInt(token, iterator);
    return true;
  }
  if (token === "--page") {
    state.page = parsePositiveInt(token, iterator);
    return true;
  }
  return false;
}

/**
 * Handle mode and display flags
 */
export function handleModeDisplayFlags(
  token: string,
  state: ParseState
): boolean {
  // Mode flags
  if (token === "--map") {
    state.isMapMode = true;
    return true;
  }
  if (token === "--graph" || token === "-g") {
    state.isGraphMode = true;
    return true;
  }

  // Display mode flags
  if (token === "--long" || token === "-l") {
    state.displayMode = "long";
    return true;
  }
  if (token === "--tree" || token === "-T") {
    state.displayMode = "tree";
    return true;
  }
  if (token === "--flat" || token === "-1") {
    state.displayMode = "flat";
    return true;
  }

  // Signal filters
  if (token === "--raised" || token === "-r") {
    state.raised = true;
    return true;
  }
  if (token === "--starred" || token === "-s") {
    state.starred = true;
    return true;
  }

  return false;
}
