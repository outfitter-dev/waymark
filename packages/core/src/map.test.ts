// tldr ::: tests for waymark map aggregation helpers

import { expect, test } from "bun:test";

import type { WaymarkRecord } from "@waymarks/grammar";

import { buildWaymarkMap } from "./map";

const record = (overrides: Partial<WaymarkRecord>): WaymarkRecord => ({
  file: "src/a.ts",
  language: "typescript",
  fileCategory: "code",
  startLine: 1,
  endLine: 1,
  indent: 0,
  commentLeader: "//",
  signals: { current: false, important: false },
  marker: "todo",
  contentText: "content",
  properties: {},
  relations: [],
  canonicals: [],
  mentions: [],
  tags: [],
  raw: "// todo ::: content",
  ...overrides,
});

test("groups records by file and marker", () => {
  const records = [
    record({ marker: "tldr", file: "src/a.ts" }),
    record({ marker: "todo", file: "src/a.ts" }),
    record({ marker: "todo", file: "src/b.ts" }),
  ];

  const map = buildWaymarkMap(records);
  expect(map.files.size).toBe(2);
  const summary = map.files.get("src/a.ts");
  expect(summary?.tldr?.marker).toBe("tldr");
  expect(summary?.markers.get("todo")?.entries.length).toBe(1);
});
