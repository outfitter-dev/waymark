// tldr ::: tests for waymark record normalization functions

import { describe, expect, test } from "bun:test";
import type { WaymarkRecord } from "@waymarks/grammar";

import {
  normalizeCanonicals,
  normalizeMentions,
  normalizeProperties,
  normalizeRecord,
  normalizeRelations,
  normalizeTags,
  normalizeType,
} from "./normalize";

// Helper to create a base record for testing
function createTestRecord(
  overrides: Partial<WaymarkRecord> = {}
): WaymarkRecord {
  return {
    file: "test.ts",
    startLine: 1,
    endLine: 1,
    type: "todo",
    contentText: "test content",
    signals: { raised: false, important: false },
    properties: {},
    relations: [],
    canonicals: [],
    mentions: [],
    tags: [],
    language: "ts",
    fileCategory: "code",
    indent: 0,
    commentLeader: "//",
    raw: "// todo ::: test content",
    ...overrides,
  };
}

describe("normalizeType", () => {
  test("lowercases markers when config.normalizeCase is true", () => {
    const record = createTestRecord({ type: "TODO" });
    const normalized = normalizeType(record.type, { normalizeCase: true });
    expect(normalized).toBe("todo");
  });

  test("preserves case when config.normalizeCase is false", () => {
    const record = createTestRecord({ type: "TODO" });
    const normalized = normalizeType(record.type, { normalizeCase: false });
    expect(normalized).toBe("TODO");
  });

  test("handles mixed case markers", () => {
    const record = createTestRecord({ type: "FiXmE" });
    const normalized = normalizeType(record.type, { normalizeCase: true });
    expect(normalized).toBe("fixme");
  });
});

describe("normalizeProperties", () => {
  test("sorts property keys alphabetically", () => {
    const record = createTestRecord({
      properties: { z: "last", a: "first", m: "middle" },
    });
    const normalized = normalizeProperties(record.properties);
    const keys = Object.keys(normalized);
    expect(keys).toEqual(["a", "m", "z"]);
  });

  test("preserves property values", () => {
    const record = createTestRecord({
      properties: { owner: "@alice", priority: "high" },
    });
    const normalized = normalizeProperties(record.properties);
    expect(normalized.owner).toBe("@alice");
    expect(normalized.priority).toBe("high");
  });

  test("handles empty properties", () => {
    const record = createTestRecord({ properties: {} });
    const normalized = normalizeProperties(record.properties);
    expect(normalized).toEqual({});
  });
});

describe("normalizeRelations", () => {
  test("sorts relations by kind then token", () => {
    const record = createTestRecord({
      relations: [
        { kind: "see", token: "#beta" },
        { kind: "from", token: "#alpha" },
        { kind: "see", token: "#alpha" },
      ],
    });
    const normalized = normalizeRelations(record.relations);
    expect(normalized).toEqual([
      { kind: "from", token: "#alpha" },
      { kind: "see", token: "#alpha" },
      { kind: "see", token: "#beta" },
    ]);
  });

  test("lowercases tokens", () => {
    const record = createTestRecord({
      relations: [{ kind: "see", token: "#AUTH/Service" }],
    });
    const normalized = normalizeRelations(record.relations);
    expect(normalized[0]?.token).toBe("#auth/service");
  });
});

describe("normalizeTags", () => {
  test("sorts tags alphabetically", () => {
    const record = createTestRecord({
      tags: ["#zebra", "#alpha", "#beta"],
    });
    const normalized = normalizeTags(record.tags);
    expect(normalized).toEqual(["#alpha", "#beta", "#zebra"]);
  });

  test("removes duplicate tags", () => {
    const record = createTestRecord({
      tags: ["#test", "#test", "#unique", "#test"],
    });
    const normalized = normalizeTags(record.tags);
    expect(normalized).toEqual(["#test", "#unique"]);
  });

  test("lowercases tags", () => {
    const record = createTestRecord({
      tags: ["#UPPER", "#MiXeD", "#lower"],
    });
    const normalized = normalizeTags(record.tags);
    expect(normalized).toEqual(["#lower", "#mixed", "#upper"]);
  });
});

describe("normalizeCanonicals", () => {
  test("deduplicates and lowercases canonicals", () => {
    const canonicals = normalizeCanonicals([
      "#CANON2",
      "#canon1",
      "canon3",
      "#CANON2",
    ]);
    expect(canonicals).toEqual(["#canon1", "#canon2", "#canon3"]);
  });
});

describe("normalizeMentions", () => {
  test("trims, deduplicates, and sorts mentions", () => {
    const mentions = normalizeMentions([
      "@charlie",
      " @alice ",
      "@bob",
      "@alice",
    ]);
    expect(mentions).toEqual(["@alice", "@bob", "@charlie"]);
  });
});

describe("normalizeRecord", () => {
  test("normalizes all aspects of a record", () => {
    const record = createTestRecord({
      type: "TODO",
      properties: { z: "last", a: "first" },
      relations: [
        { kind: "see", token: "#BETA" },
        { kind: "from", token: "#ALPHA" },
      ],
      tags: ["#TAG2", "#TAG1", "#TAG1"],
      canonicals: ["#CANON2", "#CANON1"],
      mentions: ["@charlie", "@alice", "@bob"],
    });

    const normalized = normalizeRecord(record, {
      type: { normalizeCase: true },
    });

    expect(normalized.type).toBe("todo");
    expect(Object.keys(normalized.properties)).toEqual(["a", "z"]);
    expect(normalized.relations[0]?.kind).toBe("from");
    expect(normalized.relations[0]?.token).toBe("#alpha");
    expect(normalized.tags).toEqual(["#tag1", "#tag2"]);
    expect(normalized.canonicals).toEqual(["#canon1", "#canon2"]);
    expect(normalized.mentions).toEqual(["@alice", "@bob", "@charlie"]);
  });

  test("preserves non-normalized fields", () => {
    const testLineNumber = 42;
    const record = createTestRecord({
      file: "original.ts",
      startLine: testLineNumber,
      contentText: "original content",
    });

    const normalized = normalizeRecord(record);

    expect(normalized.file).toBe("original.ts");
    expect(normalized.startLine).toBe(testLineNumber);
    expect(normalized.contentText).toBe("original content");
  });
});
