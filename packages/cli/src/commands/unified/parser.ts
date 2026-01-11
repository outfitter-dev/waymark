// tldr ::: argument parsing for unified wm command

import { existsSync } from "node:fs";
import { createArgIterator } from "../../utils/flags/iterator";
import { handleJsonFlag } from "../../utils/flags/json";
import { handleMentionFlag } from "../../utils/flags/mention";
import { handleTagFlag } from "../../utils/flags/tag";
import { handleTldrFlag } from "../../utils/flags/tldr";
import { handleTypeFlag } from "../../utils/flags/type";
import type { ParseState } from "./flag-handlers";
import {
  handleContextFlags,
  handleGroupSortFlags,
  handleModeDisplayFlags,
  handlePaginationFlags,
} from "./flag-handlers";
import { parseQuery } from "./query-parser";
import type { UnifiedCommandOptions } from "./types";

/**
 * Create initial parse state.
 * @returns Initialized parse state object.
 */
export function createParseState(): ParseState {
  return {
    positional: [] as string[],
    types: [] as string[],
    tags: [] as string[],
    mentions: [] as string[],
    excludeTypes: [] as string[],
    excludeTags: [] as string[],
    excludeMentions: [] as string[],
    jsonState: { outputFormat: null },
    isGraphMode: false,
    flagged: undefined as boolean | undefined,
    starred: undefined as boolean | undefined,
    // Display modes
    displayMode: undefined,
    // Context display
    contextBefore: undefined as number | undefined,
    contextAfter: undefined as number | undefined,
    contextAround: undefined as number | undefined,
    // Grouping & sorting
    groupBy: undefined,
    sortBy: undefined,
    reverse: false,
    // Pagination
    limit: undefined as number | undefined,
    page: undefined as number | undefined,
    // Formatting
    compact: false,
    noColor: false,
    noWrap: false,
  };
}

/**
 * Check if a token looks like a file path
 */
function looksLikeFilePath(token: string): boolean {
  // Starts with / or ./ or ../
  if (
    token.startsWith("/") ||
    token.startsWith("./") ||
    token.startsWith("../")
  ) {
    return true;
  }

  // Contains path separators
  if (token.includes("/")) {
    return true;
  }

  // Actually exists as a file/directory
  if (existsSync(token)) {
    return true;
  }

  return false;
}

/**
 * Process a single token during argument parsing.
 * @param token - Current CLI token to process.
 * @param iterator - Iterator for remaining arguments.
 * @param state - Parse state to mutate.
 */
export function processToken(
  token: string,
  iterator: ReturnType<typeof createArgIterator>,
  state: ParseState
): void {
  // Mode and display flags
  if (handleModeDisplayFlags(token, state)) {
    return;
  }

  // Context display flags
  if (handleContextFlags(token, iterator, state)) {
    return;
  }

  // Grouping and sorting flags
  if (handleGroupSortFlags(token, iterator, state)) {
    return;
  }

  // Pagination flags
  if (handlePaginationFlags(token, iterator, state)) {
    return;
  }

  // Standard filters
  handleJsonFlag(token, state.jsonState);
  handleTldrFlag(token, state.types);
  handleTypeFlag(token, iterator, state.types);
  handleTagFlag(token, iterator, state.tags);
  handleMentionFlag(token, iterator, state.mentions);

  // Collect positional args
  if (!token.startsWith("-")) {
    // If it looks like a file path, add as positional
    if (looksLikeFilePath(token)) {
      state.positional.push(token);
    } else {
      // Otherwise, parse as a query string
      const query = parseQuery(token);

      // Merge query results into state
      state.types.push(...query.types);
      state.mentions.push(...query.mentions);
      state.tags.push(...query.tags);

      // Track exclusions separately
      state.excludeTypes.push(...query.exclusions.types);
      state.excludeTags.push(...query.exclusions.tags);
      state.excludeMentions.push(...query.exclusions.mentions);

      // Handle text terms as content search (future: could add to a textSearch field)
      // For now, we just extract structured tokens
    }
  }
}

/**
 * Build final options from parse state.
 * @param state - Collected parse state.
 * @returns Unified command options.
 */
export function buildOptions(state: ParseState): UnifiedCommandOptions {
  const options: UnifiedCommandOptions = {
    filePaths: state.positional.length > 0 ? state.positional : ["."],
    isGraphMode: state.isGraphMode,
    compact: state.compact,
    noColor: state.noColor,
    noWrap: state.noWrap,
  };
  applyOutputFormat(state, options);
  applyFilters(state, options);
  applyExclusions(state, options);
  applyDisplayOptions(state, options);
  applyContextOptions(state, options);
  applyGroupingOptions(state, options);
  applyPaginationOptions(state, options);

  return options;
}

function applyOutputFormat(
  state: ParseState,
  options: UnifiedCommandOptions
): void {
  if (state.jsonState.outputFormat) {
    options.outputFormat = state.jsonState.outputFormat;
  }
}

function applyFilters(state: ParseState, options: UnifiedCommandOptions): void {
  if (state.types.length > 0) {
    options.types = state.types;
  }
  if (state.tags.length > 0) {
    options.tags = state.tags;
  }
  if (state.mentions.length > 0) {
    options.mentions = state.mentions;
  }
  if (state.flagged !== undefined) {
    options.flagged = state.flagged;
  }
  if (state.starred !== undefined) {
    options.starred = state.starred;
  }
}

function applyExclusions(
  state: ParseState,
  options: UnifiedCommandOptions
): void {
  if (state.excludeTypes.length > 0) {
    options.excludeTypes = state.excludeTypes;
  }
  if (state.excludeTags.length > 0) {
    options.excludeTags = state.excludeTags;
  }
  if (state.excludeMentions.length > 0) {
    options.excludeMentions = state.excludeMentions;
  }
}

function applyDisplayOptions(
  state: ParseState,
  options: UnifiedCommandOptions
): void {
  if (state.displayMode !== undefined) {
    options.displayMode = state.displayMode;
  }
}

function applyContextOptions(
  state: ParseState,
  options: UnifiedCommandOptions
): void {
  if (state.contextAround !== undefined) {
    options.contextAround = state.contextAround;
  }
  if (state.contextBefore !== undefined) {
    options.contextBefore = state.contextBefore;
  }
  if (state.contextAfter !== undefined) {
    options.contextAfter = state.contextAfter;
  }
}

function applyGroupingOptions(
  state: ParseState,
  options: UnifiedCommandOptions
): void {
  if (state.groupBy !== undefined) {
    options.groupBy = state.groupBy;
  }
  if (state.sortBy !== undefined) {
    options.sortBy = state.sortBy;
  }
  if (state.reverse) {
    options.reverse = state.reverse;
  }
}

function applyPaginationOptions(
  state: ParseState,
  options: UnifiedCommandOptions
): void {
  if (state.limit !== undefined) {
    options.limit = state.limit;
  }
  if (state.page !== undefined) {
    options.page = state.page;
  }
}

/**
 * Parse CLI arguments for the unified command.
 * @param argv - Raw CLI arguments.
 * @returns Parsed unified command options.
 */
export function parseUnifiedArgs(argv: string[]): UnifiedCommandOptions {
  const state = createParseState();
  const iterator = createArgIterator(argv);

  while (iterator.hasNext()) {
    const token = iterator.next();
    if (!token) {
      continue;
    }

    processToken(token, iterator, state);
  }

  return buildOptions(state);
}
