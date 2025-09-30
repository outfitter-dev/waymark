// tldr ::: SQLite schema creation and migration helpers for waymark cache

import type { Database } from "bun:sqlite";

export function configureForPerformance(db: Database): void {
  db.exec("PRAGMA foreign_keys = ON");
  // Enable WAL mode for better concurrency
  db.exec("PRAGMA journal_mode = WAL");

  // Optimize for cache workloads
  db.exec("PRAGMA synchronous = NORMAL");
  db.exec("PRAGMA cache_size = 8192"); // 32MB cache
  db.exec("PRAGMA temp_store = MEMORY");
  db.exec("PRAGMA mmap_size = 67108864"); // 64MB memory mapping
  db.exec("PRAGMA page_size = 4096");
  db.exec("PRAGMA auto_vacuum = INCREMENTAL");
}

export function createSchema(db: Database): void {
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
}

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
