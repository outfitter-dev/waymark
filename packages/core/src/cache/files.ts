// tldr ::: file tracking and staleness detection for waymark cache

import type { Database } from "bun:sqlite";

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

// biome-ignore lint/nursery/useMaxParams: straightforward file metadata params
export function updateFileInfo(
  db: Database,
  filePath: string,
  mtime: number,
  size: number,
  hash?: string | null
): void {
  const stmt = db.prepare(`
    INSERT OR REPLACE INTO files (path, mtime, size, hash)
    VALUES (?, ?, ?, ?)
  `);

  stmt.run(filePath, mtime, size, hash ?? null);
}
