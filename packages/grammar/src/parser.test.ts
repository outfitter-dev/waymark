// tldr ::: unit tests for waymark grammar parser behaviors

import { describe, expect, test } from "bun:test";

import { parse, parseLine } from "./parser";

const LINE_ONE = 1;
const LINE_THREE = 3;
const LINE_FOUR = 4;
const LINE_TEN = 10;

describe("parseLine", () => {
  test("handles single-line todo waymark", () => {
    const record = parseLine(
      "// todo ::: implement cache invalidation #arch/state",
      LINE_ONE,
      { file: "src/cache.ts" }
    );

    expect(record).not.toBeNull();
    expect(record?.marker).toBe("todo");
    expect(record?.signals).toEqual({ current: false, important: false });
    expect(record?.tags).toContain("#arch/state");
    expect(record?.language).toBe("typescript");
    expect(record?.fileCategory).toBe("code");
  });

  test("parses properties, canonicals, relations, mentions, and tags", () => {
    const record = parseLine(
      "// note ::: summary ref:#docs/prd depends:#core/api owner:@alice #docs/prd",
      LINE_TEN,
      { file: "docs/PRD.md" }
    );

    expect(record).not.toBeNull();
    expect(record?.properties).toEqual({
      ref: "#docs/prd",
      depends: "#core/api",
      owner: "@alice",
    });
    expect(record?.canonicals).toEqual(["#docs/prd"]);
    expect(record?.relations).toEqual([
      { kind: "ref", token: "#docs/prd" },
      { kind: "depends", token: "#core/api" },
    ]);
    expect(record?.mentions).toEqual(["@alice"]);
    expect(record?.tags).toContain("#docs/prd");
    expect(record?.fileCategory).toBe("docs");
  });

  test("ignores non-waymark lines", () => {
    const record = parseLine("const value = ':::';", LINE_THREE, {
      file: "src/index.ts",
    });
    expect(record).toBeNull();
  });

  test("does not treat email addresses as mentions", () => {
    const record = parseLine(
      "// note ::: contact support@example.com for help",
      LINE_FOUR,
      { file: "src/support.ts" }
    );

    expect(record).not.toBeNull();
    expect(record?.mentions).toEqual([]);
  });

  test("handles HTML comment waymarks", () => {
    const record = parseLine(
      "<!-- tldr ::: overview for automation workflows #docs/guide -->",
      LINE_ONE,
      { file: "docs/guide.md" }
    );

    expect(record).not.toBeNull();
    expect(record?.marker).toBe("tldr");
    expect(record?.tags).toEqual(["#docs/guide"]);
    expect(record?.commentLeader).toBe("<!--");
  });
});

describe("parse", () => {
  test("parses multi-line continuation blocks", () => {
    const source = [
      "// todo ::: implement streaming parser",
      "// ... keep backward compatibility",
      "// ... coordinate rollout :::",
      "const noop = true;",
    ].join("\n");

    const records = parse(source, { file: "src/parser.ts" });
    const record = records[0];

    expect(record).toBeDefined();
    if (!record) {
      throw new Error("expected waymark record for continuation block");
    }

    expect(record.startLine).toBe(LINE_ONE);
    expect(record.endLine).toBe(LINE_THREE);
    expect(record.contentText).toBe(
      [
        "implement streaming parser",
        "keep backward compatibility",
        "coordinate rollout",
      ].join("\n")
    );
  });

  test("skips continuation when prefix not present", () => {
    const source = [
      "// note ::: only first line should parse",
      "// this is a plain comment without prefix",
    ].join("\n");

    const records = parse(source, { file: "src/notes.ts" });
    expect(records).toHaveLength(1);
    const [firstRecord] = records;
    if (!firstRecord) {
      throw new Error("expected single waymark record");
    }
    expect(firstRecord.endLine).toBe(LINE_ONE);
  });
});
