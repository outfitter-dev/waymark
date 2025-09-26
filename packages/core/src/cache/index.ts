// tldr ::: SQLite cache for waymark records and dependency graphs

import { Database } from "bun:sqlite";
import { existsSync, mkdirSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import type { WaymarkRecord } from "@waymarks/grammar";

export class WaymarkCache {
  private readonly db: Database;
  private readonly dbPath: string;

  constructor() {
    this.dbPath = this.getCacheDbPath();
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
    const dir = join(this.dbPath, "..");
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
  }

  private configureForPerformance(): void {
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

    // Create indices
    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_waymarks_file
      ON waymarkRecords(filePath);

      CREATE INDEX IF NOT EXISTS idx_waymarks_marker
      ON waymarkRecords(marker);
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
    `);
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

  updateFileInfo(filePath: string, mtime: number, size: number): void {
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO files (path, mtime, size)
      VALUES (?, ?, ?)
    `);

    stmt.run(filePath, mtime, size);
  }

  insertWaymarks(records: WaymarkRecord[]): void {
    const insertWaymark = this.db.prepare(`
      INSERT OR REPLACE INTO waymarkRecords (
        filePath, startLine, endLine, marker, content,
        signals, properties, relations, canonicals, mentions, tags
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const transaction = this.db.transaction((items: WaymarkRecord[]) => {
      for (const record of items) {
        insertWaymark.run(
          record.file,
          record.startLine,
          record.endLine,
          record.marker,
          record.contentText,
          JSON.stringify(record.signals),
          JSON.stringify(record.properties),
          JSON.stringify(record.relations),
          JSON.stringify(record.canonicals),
          JSON.stringify(record.mentions),
          JSON.stringify(record.tags)
        );
      }
    });

    transaction(records);
  }

  findByFile(filePath: string): WaymarkRecord[] {
    const stmt = this.db.prepare(`
      SELECT * FROM waymarkRecords
      WHERE filePath = ?
      ORDER BY startLine
    `);

    type DbRow = {
      filePath: string;
      startLine: number;
      endLine: number;
      marker: string;
      content: string;
      signals?: string | null;
      properties?: string | null;
      relations?: string | null;
      canonicals?: string | null;
      mentions?: string | null;
      tags?: string | null;
    };

    return (stmt.all(filePath) as DbRow[]).map(this.deserializeRecord);
  }

  private deserializeRecord(row: {
    filePath: string;
    startLine: number;
    endLine: number;
    marker: string;
    content: string;
    signals?: string | null;
    properties?: string | null;
    relations?: string | null;
    canonicals?: string | null;
    mentions?: string | null;
    tags?: string | null;
  }): WaymarkRecord {
    return {
      file: row.filePath,
      startLine: row.startLine,
      endLine: row.endLine,
      marker: row.marker,
      contentText: row.content,
      signals: JSON.parse(row.signals || "{}"),
      properties: JSON.parse(row.properties || "{}"),
      relations: JSON.parse(row.relations || "[]"),
      canonicals: JSON.parse(row.canonicals || "[]"),
      mentions: JSON.parse(row.mentions || "[]"),
      tags: JSON.parse(row.tags || "[]"),
      language: "", // todo ::: determine from file extension
      fileCategory: "code", // todo ::: categorize files
      indent: 0,
      commentLeader: "//",
      raw: "",
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
