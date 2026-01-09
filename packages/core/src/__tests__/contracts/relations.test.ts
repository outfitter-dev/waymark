// tldr ::: contract coverage for relation extraction and normalization

import { describe, expect, it } from "bun:test";
import { parse } from "@waymarks/grammar";

import { normalizeRelations } from "../../normalize.ts";

describe("relation contracts", () => {
  it("normalizes relation kinds and tokens consistently", () => {
    const source =
      "// todo ::: validate relations see:Alpha docs:Spec from:Source replaces:Beta";
    const records = parse(source, { file: "src/contracts.ts" });

    expect(records).toHaveLength(1);
    const record = records[0];
    if (!record) {
      throw new Error("Expected parsed waymark record");
    }

    const normalized = normalizeRelations(record.relations);
    expect(normalized).toEqual([
      { kind: "docs", token: "#spec" },
      { kind: "from", token: "#source" },
      { kind: "replaces", token: "#beta" },
      { kind: "see", token: "#alpha" },
    ]);
  });
});
