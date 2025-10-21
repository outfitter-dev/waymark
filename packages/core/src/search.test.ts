// tldr ::: tests for waymark search helpers

import { expect, test } from "bun:test";

import type { WaymarkRecord } from "@waymarks/grammar";

import { searchRecords } from "./search";

const sampleRecord = (overrides: Partial<WaymarkRecord>): WaymarkRecord => ({
  file: "src/file.ts",
  language: "typescript",
  fileCategory: "code",
  startLine: 1,
  endLine: 1,
  indent: 0,
  commentLeader: "//",
  signals: { raised: false, important: false },
  type: "todo",
  contentText: "example content",
  properties: {},
  relations: [],
  canonicals: [],
  mentions: [],
  tags: [],
  raw: "// todo ::: example content",
  ...overrides,
});

test("filters by type and tag", () => {
  const records = [
    sampleRecord({ type: "todo", tags: ["#docs"] }),
    sampleRecord({ type: "note", tags: ["#arch"] }),
  ];

  const result = searchRecords(records, { markers: ["todo"], tags: ["#docs"] });
  expect(result).toHaveLength(1);
  expect(result[0]?.type).toBe("todo");
});

test("filters by mentions and text", () => {
  const records = [
    sampleRecord({
      type: "todo",
      contentText: "add more tests",
      mentions: ["@agent"],
    }),
    sampleRecord({
      type: "todo",
      contentText: "refactor parser",
      mentions: ["@codex"],
    }),
  ];

  const result = searchRecords(records, {
    mentions: ["@codex"],
    text: "refactor",
  });

  expect(result).toHaveLength(1);
  expect(result[0]?.contentText).toBe("refactor parser");
});
