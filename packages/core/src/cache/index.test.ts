// tldr ::: tests for waymark cache invalidation and metadata tracking

import { describe, expect, test } from "bun:test";

import type { WaymarkRecord } from "@waymarks/grammar";

import { WaymarkCache } from "./index";

const INITIAL_MTIME = 100;
const INITIAL_SIZE = 10;
const UPDATED_MTIME = 200;
const UPDATED_SIZE = 20;
const DEFAULT_MTIME = 100;
const DEFAULT_SIZE = 10;

const baseRecord = (overrides: Partial<WaymarkRecord>): WaymarkRecord => {
  const marker = overrides.type ?? "todo";
  const contentText = overrides.contentText ?? "content";
  const commentLeader = overrides.commentLeader ?? "//";
  const overrideSignals = overrides.signals;
  let normalizedSignals = { raised: false, current: false, important: false };
  if (overrideSignals) {
    const raisedValue =
      overrideSignals.raised ?? overrideSignals.current ?? false;
    const currentValue =
      overrideSignals.current ?? overrideSignals.raised ?? false;
    normalizedSignals = {
      raised: raisedValue,
      current: currentValue,
      important: overrideSignals.important ?? false,
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
});
