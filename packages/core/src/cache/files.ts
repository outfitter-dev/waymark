// tldr ::: file tracking and staleness detection for waymark cache

import type { Database } from "bun:sqlite";
import { InternalError, Result } from "../errors.ts";

/**
 * Check whether cached file metadata is stale.
 * @param db - SQLite database handle.
 * @param filePath - File path to check.
 * @param mtime - Modified time in milliseconds.
 * @param size - File size in bytes.
 * @returns Result with true if cached metadata is missing or out of date.
 */
export function isFileStale(
  db: Database,
  filePath: string,
  mtime: number,
  size: number
): Result<boolean, InternalError> {
  return Result.try({
    try: () => {
      const stmt = db.prepare(`
        SELECT mtime, size FROM files WHERE path = ?
      `);

      const cached = stmt.get(filePath) as {
        mtime: number;
        size: number;
      } | null;
      if (!cached) {
        return true;
      }

      return cached.mtime !== mtime || cached.size !== size;
    },
    catch: (cause) =>
      new InternalError({
        message: `Failed to check file staleness: ${cause instanceof Error ? cause.message : String(cause)}`,
        context: {
          filePath,
          cause: cause instanceof Error ? cause.message : String(cause),
        },
      }),
  });
}

/**
 * Upsert cached file metadata.
 * @param db - SQLite database handle.
 * @param info - File metadata to persist.
 * @returns Result indicating success or an InternalError.
 */
export function updateFileInfo(
  db: Database,
  info: {
    filePath: string;
    mtime: number;
    size: number;
    hash?: string | null;
  }
): Result<void, InternalError> {
  return Result.try({
    try: () => {
      const { filePath, mtime, size, hash } = info;
      const stmt = db.prepare(`
        INSERT OR REPLACE INTO files (path, mtime, size, hash)
        VALUES (?, ?, ?, ?)
      `);

      stmt.run(filePath, mtime, size, hash ?? null);
    },
    catch: (cause) =>
      new InternalError({
        message: `Failed to update file info: ${cause instanceof Error ? cause.message : String(cause)}`,
        context: {
          filePath: info.filePath,
          cause: cause instanceof Error ? cause.message : String(cause),
        },
      }),
  });
}
