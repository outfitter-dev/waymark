// tldr ::: pagination utilities for waymark records

import type { WaymarkRecord } from "@waymarks/core";
import { DEFAULT_PAGE_SIZE } from "./types";

/**
 * Apply pagination to records.
 * @param records - Records to paginate.
 * @param limit - Page size limit.
 * @param page - Page number (1-based).
 * @returns Paginated records.
 */
export function paginateRecords(
  records: WaymarkRecord[],
  limit?: number,
  page?: number
): WaymarkRecord[] {
  if (!(limit || page)) {
    return records;
  }

  const pageSize = limit || DEFAULT_PAGE_SIZE;
  const pageNumber = page || 1;
  const startIndex = (pageNumber - 1) * pageSize;
  const endIndex = startIndex + pageSize;

  return records.slice(startIndex, endIndex);
}
