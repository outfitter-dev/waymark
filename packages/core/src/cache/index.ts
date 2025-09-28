// tldr ::: SQLite cache for waymark records and dependency graphs

import { Database } from "bun:sqlite";
import { existsSync, mkdirSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import type { WaymarkRecord } from "@waymarks/grammar";

export type WaymarkCacheOptions = {
  dbPath?: string;
};

type WaymarkRow = {
  filePath: string;
  startLine: number;
  endLine: number;
  marker: string;
  content: string;
  language: string;
  fileCategory: string;
  indent: number;
  commentLeader?: string | null;
  raw?: string | null;
  signals?: string | null;
  properties?: string | null;
  relations?: string | null;
  canonicals?: string | null;
  mentions?: string | null;
  tags?: string | null;
};

export class WaymarkCache {
  private readonly db: Database;
  private readonly dbPath: string;

  constructor(options: WaymarkCacheOptions = {}) {
    this.dbPath = options.dbPath ?? this.getCacheDbPath();
    this.ensureCacheDirectory();
    this.db = new Database(this.dbPath);
    this.configureForPerformance();
    this.createSchema();
  }

  private getCacheDbPath(): string {
    const cacheDir = process.env.XDG_CACHE_HOME || join(homedir(), ".cache");
    return join(cacheDir, "waymark", "waymark-cache.db");
  }

  private ensureCacheDirectory(): void {
    if (this.dbPath === ":memory:" || this.dbPath.startsWith("file:")) {
      return;
    }

    const dir = dirname(this.dbPath);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
  }

  private configureForPerformance(): void {
    this.db.exec("PRAGMA foreign_keys = ON");
    // Enable WAL mode for better concurrency
    this.db.exec("PRAGMA journal_mode = WAL");

    // Optimize for cache workloads
    this.db.exec("PRAGMA synchronous = NORMAL");
    this.db.exec("PRAGMA cache_size = 8192"); // 32MB cache
    this.db.exec("PRAGMA temp_store = MEMORY");
    this.db.exec("PRAGMA mmap_size = 67108864"); // 64MB memory mapping
    this.db.exec("PRAGMA page_size = 4096");
    this.db.exec("PRAGMA auto_vacuum = INCREMENTAL");
  }

  private createSchema(): void {
    // Files table for tracking modification times
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS files (
        path TEXT PRIMARY KEY,
        mtime INTEGER NOT NULL,
        size INTEGER NOT NULL,
        hash TEXT,
        indexedAt INTEGER DEFAULT (unixepoch())
      ) STRICT
    `);

    // Waymark records cache
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS waymarkRecords (
        id INTEGER PRIMARY KEY,
        filePath TEXT NOT NULL,
        startLine INTEGER NOT NULL,
        endLine INTEGER NOT NULL,
        marker TEXT NOT NULL,
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

    this.ensureWaymarkRecordColumns();

    // Create indices for fast searching
    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_waymarks_file
      ON waymarkRecords(filePath);

      CREATE INDEX IF NOT EXISTS idx_waymarks_marker
      ON waymarkRecords(marker);

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
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS dependencies (
        fromRecordId INTEGER NOT NULL,
        toCanonical TEXT NOT NULL,
        relationType TEXT NOT NULL,

        FOREIGN KEY (fromRecordId) REFERENCES waymarkRecords(id) ON DELETE CASCADE
      ) STRICT
    `);

    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_deps_from
      ON dependencies(fromRecordId);

      CREATE INDEX IF NOT EXISTS idx_deps_to
      ON dependencies(toCanonical);

      CREATE INDEX IF NOT EXISTS idx_deps_relation
      ON dependencies(relationType);
    `);
  }

  private ensureWaymarkRecordColumns(): void {
    const existingColumns = new Set<string>();
    const pragma = this.db.prepare("PRAGMA table_info(waymarkRecords)");
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
        this.db.exec(sql);
      }
    }
  }

  isFileStale(filePath: string, mtime: number, size: number): boolean {
    const stmt = this.db.prepare(`
      SELECT mtime, size FROM files WHERE path = ?
    `);

    const cached = stmt.get(filePath) as { mtime: number; size: number } | null;
    if (!cached) {
      return true;
    }

    return cached.mtime !== mtime || cached.size !== size;
  }

  updateFileInfo(
    filePath: string,
    mtime: number,
    size: number,
    hash?: string | null
  ): void {
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO files (path, mtime, size, hash)
      VALUES (?, ?, ?, ?)
    `);

    stmt.run(filePath, mtime, size, hash ?? null);
  }

  insertWaymarks(records: WaymarkRecord[]): void {
    if (records.length === 0) {
      return;
    }

    const transaction = this.db.transaction((items: WaymarkRecord[]) => {
      this.insertWaymarksUnsafe(items);
    });

    transaction(records);
  }

  insertWaymarksBatch(recordsByFile: Map<string, WaymarkRecord[]>): void {
    const allRecords: WaymarkRecord[] = [];
    for (const records of recordsByFile.values()) {
      allRecords.push(...records);
    }

    if (allRecords.length === 0) {
      return;
    }

    const transaction = this.db.transaction(() => {
      this.insertWaymarksUnsafe(allRecords);
    });

    transaction();
  }

  replaceFileWaymarks(args: {
    filePath: string;
    mtime: number;
    size: number;
    hash?: string | null;
    records: WaymarkRecord[];
  }): void {
    const { filePath, mtime, size, hash, records } = args;
    const transaction = this.db.transaction(() => {
      this.deleteFileInternal(filePath);
      this.updateFileInfo(filePath, mtime, size, hash);
      if (records.length > 0) {
        this.insertWaymarksUnsafe(records);
      }
    });

    transaction();
  }

  deleteFile(filePath: string): void {
    const transaction = this.db.transaction(() => {
      this.deleteFileInternal(filePath);
    });

    transaction();
  }

  findByFile(filePath: string): WaymarkRecord[] {
    const stmt = this.db.prepare(`
      SELECT * FROM waymarkRecords
      WHERE filePath = ?
      ORDER BY startLine
    `);
    return (stmt.all(filePath) as WaymarkRow[]).map((row) =>
      this.deserializeRecord(row)
    );
  }

  findByMarker(marker: string): WaymarkRecord[] {
    const stmt = this.db.prepare(`
      SELECT * FROM waymarkRecords
      WHERE marker = ?
      ORDER BY filePath, startLine
    `);
    return (stmt.all(marker) as WaymarkRow[]).map((row) =>
      this.deserializeRecord(row)
    );
  }

  findByTag(tag: string): WaymarkRecord[] {
    const stmt = this.db.prepare(`
      SELECT * FROM waymarkRecords
      WHERE tags LIKE ? ESCAPE '\\'
      ORDER BY filePath, startLine
    `);
    return (stmt.all(jsonArrayContainsPattern(tag)) as WaymarkRow[]).map(
      (row) => this.deserializeRecord(row)
    );
  }

  findByMention(mention: string): WaymarkRecord[] {
    const stmt = this.db.prepare(`
      SELECT * FROM waymarkRecords
      WHERE mentions LIKE ? ESCAPE '\\'
      ORDER BY filePath, startLine
    `);
    return (stmt.all(jsonArrayContainsPattern(mention)) as WaymarkRow[]).map(
      (row) => this.deserializeRecord(row)
    );
  }

  findByCanonical(canonical: string): WaymarkRecord[] {
    const stmt = this.db.prepare(`
      SELECT * FROM waymarkRecords
      WHERE canonicals LIKE ? ESCAPE '\\'
      ORDER BY filePath, startLine
    `);
    return (stmt.all(jsonArrayContainsPattern(canonical)) as WaymarkRow[]).map(
      (row) => this.deserializeRecord(row)
    );
  }

  searchContent(query: string): WaymarkRecord[] {
    const stmt = this.db.prepare(`
      SELECT * FROM waymarkRecords
      WHERE content LIKE ? ESCAPE '\\'
      ORDER BY filePath, startLine
    `);
    return (stmt.all(substringLikePattern(query)) as WaymarkRow[]).map((row) =>
      this.deserializeRecord(row)
    );
  }

  private insertWaymarksUnsafe(records: WaymarkRecord[]): void {
    if (records.length === 0) {
      return;
    }

    const insertWaymark = this.db.prepare(`
      INSERT OR REPLACE INTO waymarkRecords (
        filePath, startLine, endLine, marker, content,
        language, fileCategory, indent, commentLeader, raw,
        signals, properties, relations, canonicals, mentions, tags
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    // Batch insert with prepared statement reuse for performance
    const values = records.map((record) => [
      record.file,
      record.startLine,
      record.endLine,
      record.marker,
      record.contentText,
      record.language,
      record.fileCategory,
      record.indent,
      record.commentLeader ?? null,
      record.raw,
      JSON.stringify(record.signals),
      JSON.stringify(record.properties),
      JSON.stringify(record.relations),
      JSON.stringify(record.canonicals),
      JSON.stringify(record.mentions),
      JSON.stringify(record.tags),
    ]);

    // Execute all inserts in a single transaction
    for (const row of values) {
      insertWaymark.run(...row);
    }
  }

  private deleteFileInternal(filePath: string): void {
    const deleteWaymarks = this.db.prepare(`
      DELETE FROM waymarkRecords WHERE filePath = ?
    `);
    deleteWaymarks.run(filePath);

    const deleteFileRow = this.db.prepare(`
      DELETE FROM files WHERE path = ?
    `);
    deleteFileRow.run(filePath);
  }

  private deserializeRecord(row: WaymarkRow): WaymarkRecord {
    return {
      file: row.filePath,
      startLine: row.startLine,
      endLine: row.endLine,
      marker: row.marker,
      contentText: row.content,
      signals: parseSignals(row.signals),
      properties: parseProperties(row.properties),
      relations: parseRelations(row.relations),
      canonicals: parseStringArray(row.canonicals),
      mentions: parseStringArray(row.mentions),
      tags: parseStringArray(row.tags),
      language: row.language,
      fileCategory: row.fileCategory as WaymarkRecord["fileCategory"],
      indent: row.indent,
      commentLeader: row.commentLeader ?? null,
      raw: row.raw ?? "",
    };
  }

  close(): void {
    // Run optimization before closing
    this.db.exec("PRAGMA optimize");

    // Checkpoint WAL file
    this.db.exec("PRAGMA wal_checkpoint(TRUNCATE)");

    this.db.close();
  }

  // Implement disposable pattern for automatic cleanup
  [Symbol.dispose](): void {
    this.close();
  }
}

function jsonArrayContainsPattern(value: string): string {
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return "%";
  }
  return `%"${escapeForLike(trimmed)}"%`;
}

function substringLikePattern(value: string): string {
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return "%";
  }
  return `%${escapeForLike(trimmed)}%`;
}

function escapeForLike(value: string): string {
  return value.replace(/([\\%_])/g, "\\$1");
}

function parseSignals(
  source: string | null | undefined
): WaymarkRecord["signals"] {
  const parsed = safeParse<Partial<WaymarkRecord["signals"]>>(source, {});
  return {
    current: parsed.current === undefined ? false : Boolean(parsed.current),
    important:
      parsed.important === undefined ? false : Boolean(parsed.important),
  };
}

function parseProperties(
  source: string | null | undefined
): WaymarkRecord["properties"] {
  const parsed = safeParse<Record<string, unknown>>(source, {});
  const result: Record<string, string> = {};
  for (const [key, value] of Object.entries(parsed)) {
    if (typeof value === "string") {
      result[key] = value;
    } else if (value !== undefined && value !== null) {
      result[key] = String(value);
    }
  }
  return result;
}

function parseRelations(
  source: string | null | undefined
): WaymarkRecord["relations"] {
  const parsed = safeParse<Partial<WaymarkRecord["relations"][number]>[]>(
    source,
    []
  );
  return parsed
    .filter(
      (relation): relation is WaymarkRecord["relations"][number] =>
        typeof relation?.kind === "string" &&
        typeof relation?.token === "string"
    )
    .map((relation) => ({
      kind: relation.kind,
      token: relation.token,
    }));
}

function parseStringArray(source: string | null | undefined): string[] {
  const parsed = safeParse<unknown[]>(source, []);
  return parsed.filter((value): value is string => typeof value === "string");
}

function safeParse<T>(source: string | null | undefined, fallback: T): T {
  if (!source) {
    return fallback;
  }

  try {
    return JSON.parse(source) as T;
  } catch {
    return fallback;
  }
}
