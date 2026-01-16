// tldr ::: file tracking and staleness detection for waymark cache

import type { Database } from "bun:sqlite";

/**
 * Check whether cached file metadata is stale.
 * @param db - SQLite database handle.
 * @param filePath - File path to check.
 * @param mtime - Modified time in milliseconds.
 * @param size - File size in bytes.
 * @returns True if cached metadata is missing or out of date.
 */
export function isFileStale(
  db: Database,
  filePath: string,
  mtime: number,
  size: number
): boolean {
  const stmt = db.prepare(`
    SELECT mtime, size FROM files WHERE path = ?
  `);

  const cached = stmt.get(filePath) as { mtime: number; size: number } | null;
  if (!cached) {
    return true;
  }

  return cached.mtime !== mtime || cached.size !== size;
}

/**
 * Upsert cached file metadata.
 * @param db - SQLite database handle.
 * @param info - File metadata to persist.
 */
export function updateFileInfo(
  db: Database,
  info: {
    filePath: string;
    mtime: number;
    size: number;
    hash?: string | null;
  }
): void {
  const { filePath, mtime, size, hash } = info;
  const stmt = db.prepare(`
    INSERT OR REPLACE INTO files (path, mtime, size, hash)
    VALUES (?, ?, ?, ?)
  `);

  stmt.run(filePath, mtime, size, hash ?? null);
}
