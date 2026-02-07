// tldr ::: SQLite cache orchestration for waymark records and dependency graphs

import { Database } from "bun:sqlite";
import { existsSync, mkdirSync, realpathSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, isAbsolute, join, relative, resolve } from "node:path";
import type { WaymarkRecord } from "@waymarks/grammar";

import { InternalError, Result } from "../errors.ts";
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

  private constructor(db: Database, dbPath: string) {
    this.db = db;
    this.dbPath = dbPath;
  }

  /**
   * Open a new cache instance, creating the database and schema as needed.
   * @param options - Cache configuration options.
   * @returns Result with the cache instance or an InternalError.
   */
  static open(
    options: WaymarkCacheOptions = {}
  ): Result<WaymarkCache, InternalError> {
    return Result.gen(function* () {
      const dbPath = options.dbPath ?? getDefaultCacheDbPath();

      yield* ensureCacheDirectory(dbPath);

      const db = yield* Result.try({
        try: () => new Database(dbPath),
        catch: (cause) =>
          new InternalError({
            message: `Failed to open cache database: ${cause instanceof Error ? cause.message : String(cause)}`,
            context: {
              dbPath,
              cause: cause instanceof Error ? cause.message : String(cause),
            },
          }),
      });

      yield* configureForPerformance(db);
      yield* createSchema(db);

      return Result.ok(new WaymarkCache(db, dbPath));
    });
  }

  /**
   * Check whether cached file metadata is stale versus current stats.
   * @param filePath - File path to check.
   * @param mtime - Modified time in milliseconds.
   * @param size - File size in bytes.
   * @returns Result with true when cached metadata is stale or missing.
   */
  isFileStale(
    filePath: string,
    mtime: number,
    size: number
  ): Result<boolean, InternalError> {
    return isFileStale(this.db, filePath, mtime, size);
  }

  /**
   * Persist file metadata in the cache index.
   * @param filePath - File path to update.
   * @param mtime - Modified time in milliseconds.
   * @param size - File size in bytes.
   * @param hash - Optional content hash.
   * @returns Result indicating success or an InternalError.
   */
  updateFileInfo(
    filePath: string,
    mtime: number,
    size: number,
    hash?: string | null
  ): Result<void, InternalError> {
    const info =
      hash === undefined
        ? { filePath, mtime, size }
        : { filePath, mtime, size, hash };
    return updateFileInfo(this.db, info);
  }

  /**
   * Insert records into the cache.
   * @param records - Waymark records to insert.
   * @returns Result indicating success or an InternalError.
   */
  insertWaymarks(records: WaymarkRecord[]): Result<void, InternalError> {
    return insertWaymarks(this.db, records);
  }

  /**
   * Insert records in a batched transaction grouped by file.
   * @param recordsByFile - Map of file paths to waymark records.
   * @returns Result indicating success or an InternalError.
   */
  insertWaymarksBatch(
    recordsByFile: Map<string, WaymarkRecord[]>
  ): Result<void, InternalError> {
    return insertWaymarksBatch(this.db, recordsByFile);
  }

  /**
   * Replace cached records for a single file.
   * @param args - File metadata and records to replace in the cache.
   * @returns Result indicating success or an InternalError.
   */
  replaceFileWaymarks(args: {
    filePath: string;
    mtime: number;
    size: number;
    hash?: string | null;
    records: WaymarkRecord[];
  }): Result<void, InternalError> {
    return replaceFileWaymarks(this.db, args);
  }

  /**
   * Remove cached records for the given file path.
   * @param filePath - File path to remove.
   * @returns Result indicating success or an InternalError.
   */
  deleteFile(filePath: string): Result<void, InternalError> {
    return deleteFile(this.db, filePath);
  }

  /**
   * Retrieve cached records for a specific file.
   * @param filePath - File path to look up.
   * @returns Result with cached waymark records for the file.
   */
  findByFile(filePath: string): Result<WaymarkRecord[], InternalError> {
    return findByFile(this.db, filePath);
  }

  /**
   * Retrieve cached records filtered by marker type.
   * @param marker - Marker type to filter by.
   * @returns Result with cached records matching the marker.
   */
  findByType(marker: string): Result<WaymarkRecord[], InternalError> {
    return findByType(this.db, marker);
  }

  /**
   * Retrieve cached records that include the given tag.
   * @param tag - Tag to filter by.
   * @returns Result with cached records containing the tag.
   */
  findByTag(tag: string): Result<WaymarkRecord[], InternalError> {
    return findByTag(this.db, tag);
  }

  /**
   * Retrieve cached records that include the given mention.
   * @param mention - Mention to filter by.
   * @returns Result with cached records containing the mention.
   */
  findByMention(mention: string): Result<WaymarkRecord[], InternalError> {
    return findByMention(this.db, mention);
  }

  /**
   * Retrieve cached records that reference a canonical token.
   * @param canonical - Canonical token to match.
   * @returns Result with cached records referencing the canonical token.
   */
  findByCanonical(canonical: string): Result<WaymarkRecord[], InternalError> {
    return findByCanonical(this.db, canonical);
  }

  /**
   * Search cached records by content text.
   * @param query - Search query text.
   * @returns Result with cached records matching the query.
   */
  searchContent(query: string): Result<WaymarkRecord[], InternalError> {
    return searchContent(this.db, query);
  }

  /**
   * Flush and close the underlying SQLite connection.
   * @returns Result indicating success or an InternalError.
   */
  close(): Result<void, InternalError> {
    return Result.try({
      try: () => {
        // Run optimization before closing
        this.db.exec("PRAGMA optimize");
        // Checkpoint WAL file
        this.db.exec("PRAGMA wal_checkpoint(TRUNCATE)");
        this.db.close();
      },
      catch: (cause) =>
        new InternalError({
          message: `Failed to close cache database: ${cause instanceof Error ? cause.message : String(cause)}`,
          context: {
            dbPath: this.dbPath,
            cause: cause instanceof Error ? cause.message : String(cause),
          },
        }),
    });
  }

  /** Dispose the cache by closing the database connection. */
  [Symbol.dispose](): void {
    // Best-effort close; ignore errors during disposal
    this.close();
  }
}

function getDefaultCacheDbPath(): string {
  const cacheDir = process.env.XDG_CACHE_HOME || join(homedir(), ".cache");
  return join(cacheDir, "waymark", "waymark-cache.db");
}

function ensureCacheDirectory(dbPath: string): Result<void, InternalError> {
  // Allow special SQLite URIs
  if (dbPath === ":memory:" || dbPath.startsWith("file:")) {
    return Result.ok();
  }

  // Resolve to absolute path
  const resolved = resolve(dbPath);

  // Determine allowed parent directories
  const cacheHome = process.env.XDG_CACHE_HOME || join(homedir(), ".cache");
  const allowedParents = [
    resolve(cacheHome, "waymark"),
    resolve(process.cwd()),
  ];
  const allowedRealParents = expandAllowedParents(allowedParents);

  const securityResult = ensurePathWithinAllowed(
    resolved,
    allowedParents,
    allowedRealParents
  );
  if (securityResult.isErr()) {
    return securityResult;
  }

  // Create directory if needed
  return Result.try({
    try: () => {
      const dir = dirname(resolved);
      if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true });
      }
    },
    catch: (cause) =>
      new InternalError({
        message: `Failed to create cache directory: ${cause instanceof Error ? cause.message : String(cause)}`,
        context: {
          dbPath,
          cause: cause instanceof Error ? cause.message : String(cause),
        },
      }),
  });
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
): Result<void, InternalError> {
  const absolute = resolve(target);
  if (!isWithinAllowedParents(absolute, allowedParents)) {
    return makeSecurityError(absolute, allowedDisplayParents);
  }

  const existingAncestor = findExistingAncestor(absolute);
  if (!existingAncestor) {
    return Result.ok();
  }

  const ancestorReal = tryRealpathSync(existingAncestor);
  if (ancestorReal && !isWithinAllowedParents(ancestorReal, allowedParents)) {
    return makeSecurityError(ancestorReal, allowedDisplayParents);
  }

  return Result.ok();
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

function makeSecurityError(
  pathValue: string,
  allowedParents: string[]
): Result<never, InternalError> {
  return Result.err(
    new InternalError({
      message:
        `Cache path must be within ${allowedParents.join(" or ")}, got: ${pathValue}\n` +
        "This is a security restriction to prevent writing outside cache directories.",
      context: { path: pathValue, allowedParents },
    })
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
