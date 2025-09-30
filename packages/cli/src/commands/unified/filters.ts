// tldr ::: filtering utilities for unified wm command

import type { WaymarkRecord } from "@waymarks/core";
import { searchRecords } from "@waymarks/core";
import type { UnifiedCommandOptions } from "./types";

/**
 * Apply filters to scanned records based on unified command options.
 */
export function applyFilters(
  records: WaymarkRecord[],
  options: UnifiedCommandOptions
): WaymarkRecord[] {
  const {
    types,
    tags,
    mentions,
    raised,
    starred,
    excludeTypes,
    excludeTags,
    excludeMentions,
  } = options;

  // Build search query
  const query: Parameters<typeof searchRecords>[1] = {};
  if (types && types.length > 0) {
    query.markers = types;
  }
  if (tags && tags.length > 0) {
    query.tags = tags;
  }
  if (mentions && mentions.length > 0) {
    query.mentions = mentions;
  }

  // Apply type/tag/mention filters via searchRecords
  let filtered = searchRecords(records, query);

  // Apply exclusions
  if (excludeTypes && excludeTypes.length > 0) {
    filtered = filtered.filter((record) => !excludeTypes.includes(record.type));
  }
  if (excludeTags && excludeTags.length > 0) {
    filtered = filtered.filter(
      (record) => !record.tags.some((tag) => excludeTags.includes(tag))
    );
  }
  if (excludeMentions && excludeMentions.length > 0) {
    filtered = filtered.filter(
      (record) =>
        !record.mentions.some((mention) => excludeMentions.includes(mention))
    );
  }

  // Apply signal filters
  if (raised !== undefined || starred !== undefined) {
    filtered = filtered.filter((record) => {
      const { signals } = record;
      if (raised && !signals.raised) {
        return false;
      }
      if (starred && !signals.important) {
        return false;
      }
      return true;
    });
  }

  return filtered;
}
