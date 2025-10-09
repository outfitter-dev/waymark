// tldr ::: tests for cache schema versioning and migration logic

import { Database } from "bun:sqlite";
import { describe, expect, test } from "bun:test";

import {
  CACHE_SCHEMA_VERSION,
  createSchema,
  getSchemaVersion,
  invalidateCache,
  setSchemaVersion,
} from "./schema";

describe("Cache Schema Versioning", () => {
  test("getSchemaVersion returns 0 for fresh database", () => {
    const db = new Database(":memory:");
    expect(getSchemaVersion(db)).toBe(0);
    db.close();
  });

  test("setSchemaVersion stores version in metadata table", () => {
    const db = new Database(":memory:");

    // Create metadata table
    db.exec(`
      CREATE TABLE cache_metadata (
        key TEXT PRIMARY KEY,
        value INTEGER NOT NULL
      ) STRICT
    `);

    const TestVersion = 42;
    setSchemaVersion(db, TestVersion);
    expect(getSchemaVersion(db)).toBe(TestVersion);

    db.close();
  });

  test("setSchemaVersion updates existing version", () => {
    const db = new Database(":memory:");

    db.exec(`
      CREATE TABLE cache_metadata (
        key TEXT PRIMARY KEY,
        value INTEGER NOT NULL
      ) STRICT
    `);

    setSchemaVersion(db, 1);
    expect(getSchemaVersion(db)).toBe(1);

    setSchemaVersion(db, 2);
    expect(getSchemaVersion(db)).toBe(2);

    db.close();
  });

  test("invalidateCache drops all tables", () => {
    const db = new Database(":memory:");

    // Create all cache tables
    db.exec(`
      CREATE TABLE cache_metadata (
        key TEXT PRIMARY KEY,
        value INTEGER NOT NULL
      ) STRICT
    `);

    db.exec(`
      CREATE TABLE files (
        path TEXT PRIMARY KEY,
        mtime INTEGER NOT NULL,
        size INTEGER NOT NULL
      ) STRICT
    `);

    db.exec(`
      CREATE TABLE waymarkRecords (
        id INTEGER PRIMARY KEY,
        filePath TEXT NOT NULL,
        type TEXT NOT NULL
      ) STRICT
    `);

    db.exec(`
      CREATE TABLE dependencies (
        fromRecordId INTEGER NOT NULL,
        toCanonical TEXT NOT NULL
      ) STRICT
    `);

    // Insert some data
    db.exec(
      "INSERT INTO files (path, mtime, size) VALUES ('test.ts', 100, 10)"
    );
    setSchemaVersion(db, 1);

    // Verify tables exist
    const beforeTables = db
      .prepare(
        "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name"
      )
      .all() as Array<{ name: string }>;
    expect(beforeTables.length).toBeGreaterThan(0);

    // Invalidate cache
    invalidateCache(db);

    // Verify all tables are dropped
    const afterTables = db
      .prepare(
        "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'"
      )
      .all() as Array<{ name: string }>;
    expect(afterTables).toHaveLength(0);

    db.close();
  });

  test("createSchema initializes fresh database with current version", () => {
    const db = new Database(":memory:");

    createSchema(db);

    expect(getSchemaVersion(db)).toBe(CACHE_SCHEMA_VERSION);

    // Verify all tables exist
    const tables = db
      .prepare(
        "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name"
      )
      .all() as Array<{ name: string }>;

    const tableNames = tables.map((t) => t.name);
    expect(tableNames).toContain("cache_metadata");
    expect(tableNames).toContain("files");
    expect(tableNames).toContain("waymarkRecords");
    expect(tableNames).toContain("dependencies");

    db.close();
  });

  test("createSchema is idempotent for same version", () => {
    const db = new Database(":memory:");

    // Create schema multiple times
    createSchema(db);
    createSchema(db);
    createSchema(db);

    expect(getSchemaVersion(db)).toBe(CACHE_SCHEMA_VERSION);

    db.close();
  });

  test("createSchema invalidates cache on version mismatch", () => {
    const db = new Database(":memory:");

    // Create old schema with version 1
    db.exec(`
      CREATE TABLE cache_metadata (
        key TEXT PRIMARY KEY,
        value INTEGER NOT NULL
      ) STRICT
    `);
    setSchemaVersion(db, 1);

    db.exec(`
      CREATE TABLE files (
        path TEXT PRIMARY KEY,
        mtime INTEGER NOT NULL,
        size INTEGER NOT NULL
      ) STRICT
    `);

    db.exec(`
      CREATE TABLE waymarkRecords (
        id INTEGER PRIMARY KEY,
        filePath TEXT NOT NULL,
        marker TEXT NOT NULL
      ) STRICT
    `);

    // Insert old data
    db.exec("INSERT INTO files (path, mtime, size) VALUES ('old.ts', 100, 10)");

    // Verify old schema exists
    expect(getSchemaVersion(db)).toBe(1);
    const oldFiles = db.prepare("SELECT * FROM files").all();
    expect(oldFiles).toHaveLength(1);

    // Create new schema (should invalidate)
    createSchema(db);

    // Verify version updated
    expect(getSchemaVersion(db)).toBe(CACHE_SCHEMA_VERSION);

    // Verify old data is gone (cache invalidated)
    const newFiles = db.prepare("SELECT * FROM files").all();
    expect(newFiles).toHaveLength(0);

    // Verify new schema has 'type' column instead of 'marker'
    const columns = db
      .prepare("PRAGMA table_info(waymarkRecords)")
      .all() as Array<{ name: string }>;
    const columnNames = columns.map((c) => c.name);
    expect(columnNames).toContain("type");
    expect(columnNames).not.toContain("marker");

    db.close();
  });

  test("createSchema preserves data when version matches", () => {
    const db = new Database(":memory:");

    // Create schema with current version
    createSchema(db);

    // Insert data
    db.exec(
      "INSERT INTO files (path, mtime, size) VALUES ('test.ts', 100, 10)"
    );

    const beforeFiles = db.prepare("SELECT * FROM files").all();
    expect(beforeFiles).toHaveLength(1);

    // Call createSchema again
    createSchema(db);

    // Verify data still exists
    const afterFiles = db.prepare("SELECT * FROM files").all();
    expect(afterFiles).toHaveLength(1);
    expect(getSchemaVersion(db)).toBe(CACHE_SCHEMA_VERSION);

    db.close();
  });
});
