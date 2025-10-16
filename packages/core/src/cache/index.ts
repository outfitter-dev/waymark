// tldr ::: SQLite cache orchestration for waymark records and dependency graphs

import { Database } from "bun:sqlite";
import { existsSync, mkdirSync } from "node:fs";
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

export type WaymarkCacheOptions = {
  dbPath?: string;
};

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

    // Validate path is within one of the allowed directories
    const isInsideAllowed = allowedParents.some((parent) => {
      const rel = relative(parent, resolved);
      return rel && !rel.startsWith("..") && !isAbsolute(rel);
    });

    if (!isInsideAllowed) {
      throw new Error(
        `Cache path must be within ${allowedParents.join(" or ")}, got: ${resolved}\n` +
          "This is a security restriction to prevent writing outside cache directories."
      );
    }

    // Create directory if needed
    const dir = dirname(resolved);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
  }

  isFileStale(filePath: string, mtime: number, size: number): boolean {
    return isFileStale(this.db, filePath, mtime, size);
  }

  updateFileInfo(
    filePath: string,
    mtime: number,
    size: number,
    hash?: string | null
  ): void {
    updateFileInfo(this.db, filePath, mtime, size, hash);
  }

  insertWaymarks(records: WaymarkRecord[]): void {
    insertWaymarks(this.db, records);
  }

  insertWaymarksBatch(recordsByFile: Map<string, WaymarkRecord[]>): void {
    insertWaymarksBatch(this.db, recordsByFile);
  }

  replaceFileWaymarks(args: {
    filePath: string;
    mtime: number;
    size: number;
    hash?: string | null;
    records: WaymarkRecord[];
  }): void {
    replaceFileWaymarks(this.db, args);
  }

  deleteFile(filePath: string): void {
    deleteFile(this.db, filePath);
  }

  findByFile(filePath: string): WaymarkRecord[] {
    return findByFile(this.db, filePath);
  }

  findByType(marker: string): WaymarkRecord[] {
    return findByType(this.db, marker);
  }

  findByTag(tag: string): WaymarkRecord[] {
    return findByTag(this.db, tag);
  }

  findByMention(mention: string): WaymarkRecord[] {
    return findByMention(this.db, mention);
  }

  findByCanonical(canonical: string): WaymarkRecord[] {
    return findByCanonical(this.db, canonical);
  }

  searchContent(query: string): WaymarkRecord[] {
    return searchContent(this.db, query);
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
