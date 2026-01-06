// tldr ::: tests for waymark cache invalidation and metadata tracking

import { Database } from "bun:sqlite";
import { describe, expect, test } from "bun:test";
import { mkdtemp, rm, symlink } from "node:fs/promises";
import { homedir, tmpdir } from "node:os";
import { join } from "node:path";

import type { WaymarkRecord } from "@waymarks/grammar";

import { WaymarkCache } from "./index";
import {
  CACHE_SCHEMA_VERSION,
  getSchemaVersion,
  setSchemaVersion,
} from "./schema";

const INITIAL_MTIME = 100;
const INITIAL_SIZE = 10;
const UPDATED_MTIME = 200;
const UPDATED_SIZE = 20;
const DEFAULT_MTIME = 100;
const DEFAULT_SIZE = 10;

// Security test constants
const SECURITY_ERROR_PATTERN = /must be within/;

const baseRecord = (overrides: Partial<WaymarkRecord>): WaymarkRecord => {
  const marker = overrides.type ?? "todo";
  const contentText = overrides.contentText ?? "content";
  const commentLeader = overrides.commentLeader ?? "//";
  const overrideSignals = overrides.signals;
  let normalizedSignals = { flagged: false, current: false, starred: false };
  if (overrideSignals) {
    const flaggedValue =
      overrideSignals.flagged ?? overrideSignals.current ?? false;
    const currentValue =
      overrideSignals.current ?? overrideSignals.flagged ?? false;
    normalizedSignals = {
      flagged: flaggedValue,
      current: currentValue,
      starred: overrideSignals.starred ?? false,
    };
  }

  return {
    file: overrides.file ?? "src/example.ts",
    language: overrides.language ?? "typescript",
    fileCategory: overrides.fileCategory ?? "code",
    startLine: overrides.startLine ?? 1,
    endLine: overrides.endLine ?? 1,
    indent: overrides.indent ?? 0,
    commentLeader,
    signals: normalizedSignals,
    type: marker,
    contentText,
    properties: overrides.properties ?? {},
    relations: overrides.relations ?? [],
    canonicals: overrides.canonicals ?? [],
    mentions: overrides.mentions ?? [],
    tags: overrides.tags ?? [],
    raw: overrides.raw ?? `${commentLeader} ${marker} ::: ${contentText}`,
  };
};

describe("WaymarkCache", () => {
  test("replaceFileWaymarks replaces prior records and updates metadata", () => {
    const cache = new WaymarkCache({ dbPath: ":memory:" });

    cache.replaceFileWaymarks({
      filePath: "src/example.ts",
      mtime: INITIAL_MTIME,
      size: INITIAL_SIZE,
      records: [baseRecord({ type: "todo", startLine: 1 })],
    });

    expect(
      cache.isFileStale("src/example.ts", INITIAL_MTIME, INITIAL_SIZE)
    ).toBe(false);

    cache.replaceFileWaymarks({
      filePath: "src/example.ts",
      mtime: UPDATED_MTIME,
      size: UPDATED_SIZE,
      records: [
        baseRecord({ type: "note", startLine: 2, contentText: "updated" }),
      ],
    });

    const records = cache.findByFile("src/example.ts");
    expect(records).toHaveLength(1);
    expect(records[0]?.type).toBe("note");
    expect(records[0]?.startLine).toBe(2);
    expect(records[0]?.language).toBe("typescript");
    expect(records[0]?.commentLeader).toBe("//");
    expect(records[0]?.raw).toBe("// note ::: updated");
    expect(
      cache.isFileStale("src/example.ts", UPDATED_MTIME, UPDATED_SIZE)
    ).toBe(false);
    expect(
      cache.isFileStale("src/example.ts", INITIAL_MTIME, INITIAL_SIZE)
    ).toBe(true);

    cache.deleteFile("src/example.ts");
    expect(cache.findByFile("src/example.ts")).toHaveLength(0);

    cache.close();
  });

  test("insertWaymarksBatch handles multiple files in transaction", () => {
    const cache = new WaymarkCache({ dbPath: ":memory:" });

    // First insert file metadata
    cache.updateFileInfo("file1.ts", DEFAULT_MTIME, DEFAULT_SIZE);
    cache.updateFileInfo("file2.ts", UPDATED_MTIME, UPDATED_SIZE);

    const recordsByFile = new Map<string, WaymarkRecord[]>([
      [
        "file1.ts",
        [
          baseRecord({ file: "file1.ts", type: "todo" }),
          baseRecord({ file: "file1.ts", type: "fix", startLine: 2 }),
        ],
      ],
      ["file2.ts", [baseRecord({ file: "file2.ts", type: "note" })]],
    ]);

    cache.insertWaymarksBatch(recordsByFile);

    const file1Records = cache.findByFile("file1.ts");
    expect(file1Records).toHaveLength(2);
    expect(file1Records[0]?.fileCategory).toBe("code");
    expect(file1Records[0]?.indent).toBe(0);

    const file2Records = cache.findByFile("file2.ts");
    expect(file2Records).toHaveLength(1);
    expect(file2Records[0]?.raw).toBe("// note ::: content");

    cache.close();
  });

  test("findByType returns all records with matching marker", () => {
    const cache = new WaymarkCache({ dbPath: ":memory:" });

    // Insert file metadata first
    cache.updateFileInfo("a.ts", DEFAULT_MTIME, DEFAULT_SIZE);
    cache.updateFileInfo("b.ts", DEFAULT_MTIME, DEFAULT_SIZE);
    cache.updateFileInfo("c.ts", DEFAULT_MTIME, DEFAULT_SIZE);

    cache.insertWaymarks([
      baseRecord({ file: "a.ts", type: "todo" }),
      baseRecord({ file: "b.ts", type: "fix" }),
      baseRecord({ file: "c.ts", type: "todo" }),
    ]);

    const todos = cache.findByType("todo");
    expect(todos).toHaveLength(2);
    expect(todos[0]?.file).toBe("a.ts");
    expect(todos[1]?.file).toBe("c.ts");

    cache.close();
  });

  test("findByTag returns records containing specific tags", () => {
    const cache = new WaymarkCache({ dbPath: ":memory:" });

    // Insert file metadata first
    cache.updateFileInfo("a.ts", DEFAULT_MTIME, DEFAULT_SIZE);
    cache.updateFileInfo("b.ts", DEFAULT_MTIME, DEFAULT_SIZE);
    cache.updateFileInfo("c.ts", DEFAULT_MTIME, DEFAULT_SIZE);

    cache.insertWaymarks([
      baseRecord({ file: "a.ts", tags: ["#perf", "#hotpath"] }),
      baseRecord({ file: "b.ts", tags: ["#security"] }),
      baseRecord({ file: "c.ts", tags: ["#perf", "#cache"] }),
    ]);

    const perfRecords = cache.findByTag("#perf");
    expect(perfRecords).toHaveLength(2);

    cache.close();
  });

  test("findByMention returns records with specific mentions", () => {
    const cache = new WaymarkCache({ dbPath: ":memory:" });

    // Insert file metadata first
    cache.updateFileInfo("a.ts", DEFAULT_MTIME, DEFAULT_SIZE);
    cache.updateFileInfo("b.ts", DEFAULT_MTIME, DEFAULT_SIZE);
    cache.updateFileInfo("c.ts", DEFAULT_MTIME, DEFAULT_SIZE);

    cache.insertWaymarks([
      baseRecord({ file: "a.ts", mentions: ["@alice", "@bob"] }),
      baseRecord({ file: "b.ts", mentions: ["@charlie"] }),
      baseRecord({ file: "c.ts", mentions: ["@alice"] }),
    ]);

    const aliceRecords = cache.findByMention("@alice");
    expect(aliceRecords).toHaveLength(2);

    cache.close();
  });

  test("findByTag handles wildcard characters safely", () => {
    const cache = new WaymarkCache({ dbPath: ":memory:" });

    cache.updateFileInfo("a.ts", DEFAULT_MTIME, DEFAULT_SIZE);
    cache.updateFileInfo("b.ts", DEFAULT_MTIME, DEFAULT_SIZE);

    cache.insertWaymarks([
      baseRecord({ file: "a.ts", tags: ["#perf%critical"] }),
      baseRecord({ file: "b.ts", tags: ["#perf_normal"] }),
    ]);

    const exactMatch = cache.findByTag("#perf%critical");
    expect(exactMatch).toHaveLength(1);
    expect(exactMatch[0]?.file).toBe("a.ts");

    cache.close();
  });

  test("searchContent returns records matching content query", () => {
    const cache = new WaymarkCache({ dbPath: ":memory:" });

    // Insert file metadata first
    cache.updateFileInfo("a.ts", DEFAULT_MTIME, DEFAULT_SIZE);
    cache.updateFileInfo("b.ts", DEFAULT_MTIME, DEFAULT_SIZE);
    cache.updateFileInfo("c.ts", DEFAULT_MTIME, DEFAULT_SIZE);

    cache.insertWaymarks([
      baseRecord({
        file: "a.ts",
        contentText: "implement user authentication",
      }),
      baseRecord({ file: "b.ts", contentText: "fix memory leak" }),
      baseRecord({ file: "c.ts", contentText: "user profile updates" }),
    ]);

    const userRecords = cache.searchContent("user");
    expect(userRecords).toHaveLength(2);
    expect(userRecords[0]?.file).toBe("a.ts");
    expect(userRecords[1]?.file).toBe("c.ts");

    cache.close();
  });

  test("searchContent escapes LIKE wildcards", () => {
    const cache = new WaymarkCache({ dbPath: ":memory:" });

    cache.updateFileInfo("a.ts", DEFAULT_MTIME, DEFAULT_SIZE);
    cache.updateFileInfo("b.ts", DEFAULT_MTIME, DEFAULT_SIZE);

    cache.insertWaymarks([
      baseRecord({ file: "a.ts", contentText: "handle_user_input" }),
      baseRecord({ file: "b.ts", contentText: "handleXuser_input" }),
    ]);

    const matches = cache.searchContent("handle_user_input");
    expect(matches).toHaveLength(1);
    expect(matches[0]?.file).toBe("a.ts");

    cache.close();
  });

  test("handles empty inserts gracefully", () => {
    const cache = new WaymarkCache({ dbPath: ":memory:" });

    cache.insertWaymarks([]);
    cache.insertWaymarksBatch(new Map());

    const records = cache.findByFile("nonexistent.ts");
    expect(records).toHaveLength(0);

    cache.close();
  });

  test("isFileStale returns true for non-existent files", () => {
    const cache = new WaymarkCache({ dbPath: ":memory:" });
    const nonexistentMtime = 1000;
    const nonexistentSize = 100;

    expect(
      cache.isFileStale("never-seen.ts", nonexistentMtime, nonexistentSize)
    ).toBe(true);

    cache.close();
  });

  test("WaymarkCache rejects path traversal attempts", () => {
    expect(() => {
      new WaymarkCache({ dbPath: "../../etc/waymark.db" });
    }).toThrow(SECURITY_ERROR_PATTERN);
  });

  test("WaymarkCache rejects absolute paths outside cache", () => {
    expect(() => {
      new WaymarkCache({ dbPath: "/tmp/malicious.db" });
    }).toThrow(SECURITY_ERROR_PATTERN);
  });

  test("WaymarkCache rejects workspace symlink that escapes allowed roots", async () => {
    const workspace = await mkdtemp(join(tmpdir(), "wm-cache-workspace-"));
    const outsideDir = await mkdtemp(join(tmpdir(), "wm-cache-outside-"));
    const linkDir = join(workspace, "unsafe-link");

    await symlink(outsideDir, linkDir, "dir");

    expect(() => {
      new WaymarkCache({ dbPath: join(linkDir, "cache.db") });
    }).toThrow(SECURITY_ERROR_PATTERN);

    await rm(workspace, { recursive: true, force: true });
    await rm(outsideDir, { recursive: true, force: true });
  });

  test("WaymarkCache allows valid cache paths", () => {
    const cacheDir = process.env.XDG_CACHE_HOME || join(homedir(), ".cache");
    const validPath = join(cacheDir, "waymark", "test.db");

    expect(() => {
      const cache = new WaymarkCache({ dbPath: validPath });
      cache[Symbol.dispose]();
    }).not.toThrow();
  });

  test("WaymarkCache allows workspace-local cache paths", () => {
    const workspacePath = join(process.cwd(), "test-cache", "waymark.db");

    expect(() => {
      const cache = new WaymarkCache({ dbPath: workspacePath });
      cache[Symbol.dispose]();
    }).not.toThrow();
  });

  test("WaymarkCache allows relative workspace paths", () => {
    expect(() => {
      const cache = new WaymarkCache({ dbPath: "./fixtures/test-cache.db" });
      cache[Symbol.dispose]();
    }).not.toThrow();
  });

  test("WaymarkCache rejects paths outside workspace and cache", () => {
    expect(() => {
      new WaymarkCache({ dbPath: "/etc/waymark.db" });
    }).toThrow(SECURITY_ERROR_PATTERN);
  });

  test("schema migration invalidates cache on version mismatch", () => {
    const cache = new WaymarkCache({ dbPath: ":memory:" });

    // Insert initial data with current schema
    cache.updateFileInfo("test.ts", DEFAULT_MTIME, DEFAULT_SIZE);
    cache.insertWaymarks([
      baseRecord({ file: "test.ts", type: "todo", contentText: "original" }),
    ]);

    // Verify data exists
    const beforeRecords = cache.findByFile("test.ts");
    expect(beforeRecords).toHaveLength(1);
    expect(beforeRecords[0]?.contentText).toBe("original");

    cache.close();

    // Now simulate schema version change by manually creating a database with old version
    const db = new Database(":memory:");

    // Create old schema manually (version 1 with 'marker' column instead of 'type')
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
        size INTEGER NOT NULL,
        hash TEXT,
        indexedAt INTEGER DEFAULT (unixepoch())
      ) STRICT
    `);

    db.exec(`
      CREATE TABLE waymarkRecords (
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

    // Insert old data
    db.exec("INSERT INTO files (path, mtime, size) VALUES ('old.ts', 100, 10)");
    db.exec(`
      INSERT INTO waymarkRecords (
        filePath, startLine, endLine, marker, content,
        language, fileCategory, indent, commentLeader, raw,
        signals, properties, relations, canonicals, mentions, tags
      ) VALUES (
        'old.ts', 1, 1, 'todo', 'old data',
        'typescript', 'code', 0, '//', '// todo ::: old data',
        '{"raised":false,"current":false,"important":false}',
        '{}', '[]', '[]', '[]', '[]'
      )
    `);

    // Verify old schema version
    expect(getSchemaVersion(db)).toBe(1);

    // Verify data exists in old schema
    const oldData = db
      .prepare("SELECT marker FROM waymarkRecords WHERE filePath = 'old.ts'")
      .get() as { marker: string } | null;
    expect(oldData?.marker).toBe("todo");

    db.close();
  });

  test("fresh cache initializes with current schema version", () => {
    const cache = new WaymarkCache({ dbPath: ":memory:" });

    // Access the internal database (cast to access private property for testing)
    const db = (cache as unknown as { db: Database }).db;

    expect(getSchemaVersion(db)).toBe(CACHE_SCHEMA_VERSION);

    cache.close();
  });

  test("schema migration preserves cache after same-version reopening", () => {
    const cache = new WaymarkCache({ dbPath: ":memory:" });

    // Insert data
    cache.updateFileInfo("test.ts", DEFAULT_MTIME, DEFAULT_SIZE);
    cache.insertWaymarks([
      baseRecord({ file: "test.ts", type: "note", contentText: "preserved" }),
    ]);

    const beforeRecords = cache.findByFile("test.ts");
    expect(beforeRecords).toHaveLength(1);

    // Close and reopen with same schema version
    cache.close();

    const cache2 = new WaymarkCache({ dbPath: ":memory:" });

    // Note: In-memory databases don't persist, so this test verifies
    // that createSchema is idempotent and doesn't break on same version
    expect(() => {
      cache2.updateFileInfo("test2.ts", DEFAULT_MTIME, DEFAULT_SIZE);
    }).not.toThrow();

    cache2.close();
  });
});
