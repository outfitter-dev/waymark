// tldr ::: SQLite cache orchestration for waymark records and dependency graphs

import { Database } from "bun:sqlite";
import { existsSync, mkdirSync, realpathSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, isAbsolute, join, relative, resolve } from "node:path";
import type { WaymarkRecord } from "@waymarks/grammar";

import { isFileStale, updateFileInfo } from "./files.ts";
import {
  findByCanonical,
  findByFile,
  findByMention,
  findByTag,
  findByType,
  searchContent,
} from "./queries.ts";
import { configureForPerformance, createSchema } from "./schema.ts";
import {
  deleteFile,
  insertWaymarks,
  insertWaymarksBatch,
  replaceFileWaymarks,
} from "./writes.ts";

/** Options for configuring the on-disk waymark cache. */
export type WaymarkCacheOptions = {
  dbPath?: string;
};

/** SQLite-backed cache for storing waymark records and query indexes. */
export class WaymarkCache {
  private readonly db: Database;
  private readonly dbPath: string;

  constructor(options: WaymarkCacheOptions = {}) {
    this.dbPath = options.dbPath ?? this.getCacheDbPath();
    this.ensureCacheDirectory();
    this.db = new Database(this.dbPath);
    configureForPerformance(this.db);
    createSchema(this.db);
  }

  private getCacheDbPath(): string {
    const cacheDir = process.env.XDG_CACHE_HOME || join(homedir(), ".cache");
    return join(cacheDir, "waymark", "waymark-cache.db");
  }

  private ensureCacheDirectory(): void {
    // Allow special SQLite URIs
    if (this.dbPath === ":memory:" || this.dbPath.startsWith("file:")) {
      return;
    }

    // Resolve to absolute path
    const resolved = resolve(this.dbPath);

    // Determine allowed parent directories
    const cacheHome = process.env.XDG_CACHE_HOME || join(homedir(), ".cache");
    const allowedParents = [
      resolve(cacheHome, "waymark"),
      resolve(process.cwd()),
    ];
    const allowedRealParents = expandAllowedParents(allowedParents);

    ensurePathWithinAllowed(resolved, allowedParents, allowedRealParents);

    // Create directory if needed
    const dir = dirname(resolved);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
  }

  /**
   * Check whether cached file metadata is stale versus current stats.
   * @param filePath - File path to check.
   * @param mtime - Modified time in milliseconds.
   * @param size - File size in bytes.
   * @returns True when cached metadata is stale or missing.
   */
  isFileStale(filePath: string, mtime: number, size: number): boolean {
    return isFileStale(this.db, filePath, mtime, size);
  }

  /**
   * Persist file metadata in the cache index.
   * @param filePath - File path to update.
   * @param mtime - Modified time in milliseconds.
   * @param size - File size in bytes.
   * @param hash - Optional content hash.
   */
  updateFileInfo(
    filePath: string,
    mtime: number,
    size: number,
    hash?: string | null
  ): void {
    const info =
      hash === undefined
        ? { filePath, mtime, size }
        : { filePath, mtime, size, hash };
    updateFileInfo(this.db, info);
  }

  /**
   * Insert records into the cache.
   * @param records - Waymark records to insert.
   */
  insertWaymarks(records: WaymarkRecord[]): void {
    insertWaymarks(this.db, records);
  }

  /**
   * Insert records in a batched transaction grouped by file.
   * @param recordsByFile - Map of file paths to waymark records.
   */
  insertWaymarksBatch(recordsByFile: Map<string, WaymarkRecord[]>): void {
    insertWaymarksBatch(this.db, recordsByFile);
  }

  /**
   * Replace cached records for a single file.
   * @param args - File metadata and records to replace in the cache.
   */
  replaceFileWaymarks(args: {
    filePath: string;
    mtime: number;
    size: number;
    hash?: string | null;
    records: WaymarkRecord[];
  }): void {
    replaceFileWaymarks(this.db, args);
  }

  /**
   * Remove cached records for the given file path.
   * @param filePath - File path to remove.
   */
  deleteFile(filePath: string): void {
    deleteFile(this.db, filePath);
  }

  /**
   * Retrieve cached records for a specific file.
   * @param filePath - File path to look up.
   * @returns Cached waymark records for the file.
   */
  findByFile(filePath: string): WaymarkRecord[] {
    return findByFile(this.db, filePath);
  }

  /**
   * Retrieve cached records filtered by marker type.
   * @param marker - Marker type to filter by.
   * @returns Cached records matching the marker.
   */
  findByType(marker: string): WaymarkRecord[] {
    return findByType(this.db, marker);
  }

  /**
   * Retrieve cached records that include the given tag.
   * @param tag - Tag to filter by.
   * @returns Cached records containing the tag.
   */
  findByTag(tag: string): WaymarkRecord[] {
    return findByTag(this.db, tag);
  }

  /**
   * Retrieve cached records that include the given mention.
   * @param mention - Mention to filter by.
   * @returns Cached records containing the mention.
   */
  findByMention(mention: string): WaymarkRecord[] {
    return findByMention(this.db, mention);
  }

  /**
   * Retrieve cached records that reference a canonical token.
   * @param canonical - Canonical token to match.
   * @returns Cached records referencing the canonical token.
   */
  findByCanonical(canonical: string): WaymarkRecord[] {
    return findByCanonical(this.db, canonical);
  }

  /**
   * Search cached records by content text.
   * @param query - Search query text.
   * @returns Cached records matching the query.
   */
  searchContent(query: string): WaymarkRecord[] {
    return searchContent(this.db, query);
  }

  /** Flush and close the underlying SQLite connection. */
  close(): void {
    // Run optimization before closing
    this.db.exec("PRAGMA optimize");

    // Checkpoint WAL file
    this.db.exec("PRAGMA wal_checkpoint(TRUNCATE)");

    this.db.close();
  }

  // Implement disposable pattern for automatic cleanup
  /** Dispose the cache by closing the database connection. */
  [Symbol.dispose](): void {
    this.close();
  }
}

function expandAllowedParents(parents: string[]): string[] {
  const seen = new Set<string>();
  for (const parent of parents) {
    const absolute = resolve(parent);
    seen.add(absolute);
    const real = tryRealpathSync(absolute);
    if (real) {
      seen.add(real);
    }
  }
  return Array.from(seen);
}

function ensurePathWithinAllowed(
  target: string,
  allowedDisplayParents: string[],
  allowedParents: string[]
): void {
  const absolute = resolve(target);
  if (!isWithinAllowedParents(absolute, allowedParents)) {
    throwSecurityError(absolute, allowedDisplayParents);
  }

  const existingAncestor = findExistingAncestor(absolute);
  if (!existingAncestor) {
    return;
  }

  const ancestorReal = tryRealpathSync(existingAncestor);
  if (ancestorReal && !isWithinAllowedParents(ancestorReal, allowedParents)) {
    throwSecurityError(ancestorReal, allowedDisplayParents);
  }
}

function findExistingAncestor(pathValue: string): string | null {
  let current = resolve(pathValue);
  while (!existsSync(current)) {
    const parent = dirname(current);
    if (parent === current) {
      return null;
    }
    current = parent;
  }
  return current;
}

function isWithinAllowedParents(candidate: string, parents: string[]): boolean {
  return parents.some((parent) => {
    const rel = relative(parent, candidate);
    return rel === "" || !(rel.startsWith("..") || isAbsolute(rel));
  });
}

function throwSecurityError(
  pathValue: string,
  allowedParents: string[]
): never {
  throw new Error(
    `Cache path must be within ${allowedParents.join(" or ")}, got: ${pathValue}\n` +
      "This is a security restriction to prevent writing outside cache directories."
  );
}

function tryRealpathSync(pathValue: string): string | null {
  try {
    return realpathSync(pathValue);
  } catch (error) {
    if (isEnoent(error)) {
      return null;
    }
    throw error;
  }
}

function isEnoent(error: unknown): error is NodeJS.ErrnoException {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as NodeJS.ErrnoException).code === "ENOENT"
  );
}
