// tldr ::: SQLite schema creation and migration helpers for waymark cache

import type { Database } from "bun:sqlite";
import { InternalError, Result } from "../errors.ts";

/**
 * Schema version for the cache database.
 * Increment when making breaking schema changes (e.g., column renames, type changes).
 */
export const CACHE_SCHEMA_VERSION = 2;

/**
 * Apply performance-oriented PRAGMA settings for the cache database.
 * @param db - SQLite database handle.
 * @returns Result indicating success or an InternalError.
 */
export function configureForPerformance(
  db: Database
): Result<void, InternalError> {
  return Result.try({
    try: () => {
      db.exec("PRAGMA foreign_keys = ON");
      db.exec("PRAGMA journal_mode = WAL");
      db.exec("PRAGMA synchronous = NORMAL");
      db.exec("PRAGMA cache_size = 8192");
      db.exec("PRAGMA temp_store = MEMORY");
      db.exec("PRAGMA mmap_size = 67108864");
      db.exec("PRAGMA page_size = 4096");
      db.exec("PRAGMA auto_vacuum = INCREMENTAL");
    },
    catch: (cause) =>
      new InternalError({
        message: `Failed to configure cache database: ${cause instanceof Error ? cause.message : String(cause)}`,
        context: {
          cause: cause instanceof Error ? cause.message : String(cause),
        },
      }),
  });
}

/**
 * Read the schema version from the cache metadata table.
 * @param db - SQLite database handle.
 * @returns Current schema version (0 when unset), or an InternalError.
 */
export function getSchemaVersion(db: Database): Result<number, InternalError> {
  return Result.try({
    try: () => {
      db.exec(`
        CREATE TABLE IF NOT EXISTS cache_metadata (
          key TEXT PRIMARY KEY,
          value INTEGER NOT NULL
        ) STRICT
      `);

      const stmt = db.prepare(
        "SELECT value FROM cache_metadata WHERE key = 'schema_version'"
      );
      const row = stmt.get() as { value: number } | null;
      return row?.value ?? 0;
    },
    catch: (cause) =>
      new InternalError({
        message: `Failed to read schema version: ${cause instanceof Error ? cause.message : String(cause)}`,
        context: {
          cause: cause instanceof Error ? cause.message : String(cause),
        },
      }),
  });
}

/**
 * Persist the schema version in the cache metadata table.
 * @param db - SQLite database handle.
 * @param version - Schema version to store.
 * @returns Result indicating success or an InternalError.
 */
export function setSchemaVersion(
  db: Database,
  version: number
): Result<void, InternalError> {
  return Result.try({
    try: () => {
      db.exec(`
        INSERT OR REPLACE INTO cache_metadata (key, value)
        VALUES ('schema_version', ${version})
      `);
    },
    catch: (cause) =>
      new InternalError({
        message: `Failed to set schema version: ${cause instanceof Error ? cause.message : String(cause)}`,
        context: {
          cause: cause instanceof Error ? cause.message : String(cause),
        },
      }),
  });
}

/**
 * Drop all cache tables to force reinitialization.
 * @param db - SQLite database handle.
 * @returns Result indicating success or an InternalError.
 */
export function invalidateCache(db: Database): Result<void, InternalError> {
  return Result.try({
    try: () => {
      db.exec("DROP TABLE IF EXISTS dependencies");
      db.exec("DROP TABLE IF EXISTS waymarkRecords");
      db.exec("DROP TABLE IF EXISTS files");
      db.exec("DROP TABLE IF EXISTS cache_metadata");
    },
    catch: (cause) =>
      new InternalError({
        message: `Failed to invalidate cache: ${cause instanceof Error ? cause.message : String(cause)}`,
        context: {
          cause: cause instanceof Error ? cause.message : String(cause),
        },
      }),
  });
}

/**
 * Create the cache schema, applying migrations as needed.
 * @param db - SQLite database handle.
 * @returns Result indicating success or an InternalError.
 */
export function createSchema(db: Database): Result<void, InternalError> {
  return Result.gen(function* () {
    // Check schema version and invalidate if mismatch
    const currentVersion = yield* getSchemaVersion(db);
    if (currentVersion !== 0 && currentVersion !== CACHE_SCHEMA_VERSION) {
      yield* invalidateCache(db);
    }

    // Create metadata table and set version
    yield* Result.try({
      try: () => {
        db.exec(`
          CREATE TABLE IF NOT EXISTS cache_metadata (
            key TEXT PRIMARY KEY,
            value INTEGER NOT NULL
          ) STRICT
        `);
      },
      catch: (cause) =>
        new InternalError({
          message: `Failed to create metadata table: ${cause instanceof Error ? cause.message : String(cause)}`,
          context: {
            cause: cause instanceof Error ? cause.message : String(cause),
          },
        }),
    });

    yield* setSchemaVersion(db, CACHE_SCHEMA_VERSION);

    yield* Result.try({
      try: () => {
        // Files table for tracking modification times
        db.exec(`
          CREATE TABLE IF NOT EXISTS files (
            path TEXT PRIMARY KEY,
            mtime INTEGER NOT NULL,
            size INTEGER NOT NULL,
            hash TEXT,
            indexedAt INTEGER DEFAULT (unixepoch())
          ) STRICT
        `);

        // Waymark records cache
        db.exec(`
          CREATE TABLE IF NOT EXISTS waymarkRecords (
            id INTEGER PRIMARY KEY,
            filePath TEXT NOT NULL,
            startLine INTEGER NOT NULL,
            endLine INTEGER NOT NULL,
            type TEXT NOT NULL,
            content TEXT NOT NULL,
            language TEXT NOT NULL,
            fileCategory TEXT NOT NULL,
            indent INTEGER NOT NULL,
            commentLeader TEXT,
            raw TEXT,
            signals TEXT,
            properties TEXT,
            relations TEXT,
            canonicals TEXT,
            mentions TEXT,
            tags TEXT,
            createdAt INTEGER DEFAULT (unixepoch()),

            FOREIGN KEY (filePath) REFERENCES files(path) ON DELETE CASCADE
          ) STRICT
        `);

        ensureWaymarkRecordColumns(db);

        // Create indices for fast searching
        db.exec(`
          CREATE INDEX IF NOT EXISTS idx_waymarks_file
          ON waymarkRecords(filePath);

          CREATE INDEX IF NOT EXISTS idx_waymarks_type
          ON waymarkRecords(type);

          CREATE INDEX IF NOT EXISTS idx_waymarks_content
          ON waymarkRecords(content);

          CREATE INDEX IF NOT EXISTS idx_waymarks_tags
          ON waymarkRecords(tags);

          CREATE INDEX IF NOT EXISTS idx_waymarks_mentions
          ON waymarkRecords(mentions);

          CREATE INDEX IF NOT EXISTS idx_waymarks_canonicals
          ON waymarkRecords(canonicals);
        `);

        // Dependency graph edges
        db.exec(`
          CREATE TABLE IF NOT EXISTS dependencies (
            fromRecordId INTEGER NOT NULL,
            toCanonical TEXT NOT NULL,
            relationType TEXT NOT NULL,

            FOREIGN KEY (fromRecordId) REFERENCES waymarkRecords(id) ON DELETE CASCADE
          ) STRICT
        `);

        db.exec(`
          CREATE INDEX IF NOT EXISTS idx_deps_from
          ON dependencies(fromRecordId);

          CREATE INDEX IF NOT EXISTS idx_deps_to
          ON dependencies(toCanonical);

          CREATE INDEX IF NOT EXISTS idx_deps_relation
          ON dependencies(relationType);
        `);
      },
      catch: (cause) =>
        new InternalError({
          message: `Failed to create cache schema: ${cause instanceof Error ? cause.message : String(cause)}`,
          context: {
            cause: cause instanceof Error ? cause.message : String(cause),
          },
        }),
    });

    return Result.ok();
  });
}

/**
 * Ensure new columns exist on the waymarkRecords table.
 * @param db - SQLite database handle.
 */
export function ensureWaymarkRecordColumns(db: Database): void {
  const existingColumns = new Set<string>();
  const pragma = db.prepare("PRAGMA table_info(waymarkRecords)");
  for (const row of pragma.all() as Array<{ name: string }>) {
    existingColumns.add(row.name);
  }

  const upgrades: Array<{ name: string; sql: string }> = [
    {
      name: "language",
      sql: "ALTER TABLE waymarkRecords ADD COLUMN language TEXT NOT NULL DEFAULT ''",
    },
    {
      name: "fileCategory",
      sql: "ALTER TABLE waymarkRecords ADD COLUMN fileCategory TEXT NOT NULL DEFAULT 'code'",
    },
    {
      name: "indent",
      sql: "ALTER TABLE waymarkRecords ADD COLUMN indent INTEGER NOT NULL DEFAULT 0",
    },
    {
      name: "commentLeader",
      sql: "ALTER TABLE waymarkRecords ADD COLUMN commentLeader TEXT",
    },
    {
      name: "raw",
      sql: "ALTER TABLE waymarkRecords ADD COLUMN raw TEXT DEFAULT ''",
    },
  ];

  for (const { name, sql } of upgrades) {
    if (!existingColumns.has(name)) {
      db.exec(sql);
    }
  }
}
