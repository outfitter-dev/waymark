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
    expect(record?.signals).toEqual({
      raised: false,
      current: false,
      important: false,
    });
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
      "//      ::: keep backward compatibility",
      "//      ::: coordinate rollout",
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

  test("parses markerless ::: as text continuation", () => {
    const source = [
      "// tldr ::: authentication service managing JWT tokens",
      "//      ::: supports refresh and revocation",
    ].join("\n");

    const records = parse(source, { file: "src/auth.ts" });
    expect(records).toHaveLength(1);
    const record = records[0];

    expect(record).toBeDefined();
    if (!record) {
      throw new Error("expected waymark record");
    }

    expect(record.marker).toBe("tldr");
    expect(record.startLine).toBe(1);
    expect(record.endLine).toBe(2);
    expect(record.contentText).toBe(
      "authentication service managing JWT tokens\nsupports refresh and revocation"
    );
  });

  test("parses property-as-marker in continuation context", () => {
    const source = [
      "// tldr  ::: payment processor entry point",
      "// ref   ::: #payments/stripe",
      "// owner ::: @alice",
      "// since ::: 2025-01-01",
    ].join("\n");

    const ExpectedStartLine = 1;
    const ExpectedEndLine = 4;

    const records = parse(source, { file: "src/payments.ts" });
    expect(records).toHaveLength(1);
    const record = records[0];

    expect(record).toBeDefined();
    if (!record) {
      throw new Error("expected waymark record");
    }

    expect(record.marker).toBe("tldr");
    expect(record.contentText).toBe("payment processor entry point");
    expect(record.properties).toEqual({
      ref: "#payments/stripe",
      owner: "@alice",
      since: "2025-01-01",
    });
    expect(record.canonicals).toContain("#payments/stripe");
    expect(record.startLine).toBe(ExpectedStartLine);
    expect(record.endLine).toBe(ExpectedEndLine);
  });

  test("doesn't treat markerless ::: as continuation outside waymark context", () => {
    const source = [
      "const x = 1;",
      "//      ::: this should not parse",
      "// todo ::: actual waymark",
    ].join("\n");

    const ExpectedStartLine = 3;
    const ExpectedEndLine = 3;

    const records = parse(source, { file: "src/test.ts" });
    expect(records).toHaveLength(1);
    const record = records[0];

    expect(record).toBeDefined();
    if (!record) {
      throw new Error("expected waymark record");
    }

    expect(record.marker).toBe("todo");
    expect(record.contentText).toBe("actual waymark");
    expect(record.startLine).toBe(ExpectedStartLine);
    expect(record.endLine).toBe(ExpectedEndLine);
  });

  test("handles mixed text and property continuations", () => {
    const source = [
      "// todo  ::: implement user authentication",
      "//       ::: with OAuth 2.0 and PKCE",
      "// fixes ::: #auth/login-bug",
      "//       ::: support social logins",
      "// rel   ::: #auth/session",
    ].join("\n");

    const ExpectedStartLine = 1;
    const ExpectedEndLine = 5;

    const records = parse(source, { file: "src/auth.ts" });
    expect(records).toHaveLength(1);
    const record = records[0];

    expect(record).toBeDefined();
    if (!record) {
      throw new Error("expected waymark record");
    }

    expect(record.marker).toBe("todo");
    expect(record.contentText).toBe(
      "implement user authentication\nwith OAuth 2.0 and PKCE\nsupport social logins"
    );
    expect(record.properties).toMatchObject({
      fixes: "#auth/login-bug",
      rel: "#auth/session",
    });
    expect(record.relations).toContainEqual({
      kind: "rel",
      token: "#auth/session",
    });
    expect(record.startLine).toBe(ExpectedStartLine);
    expect(record.endLine).toBe(ExpectedEndLine);
  });

  test("stops continuation at next waymark", () => {
    const source = [
      "// todo ::: first waymark",
      "//      ::: continuation of first",
      "// note ::: second waymark",
      "//      ::: continuation of second",
    ].join("\n");

    const FirstStartLine = 1;
    const FirstEndLine = 2;
    const SecondStartLine = 3;
    const SecondEndLine = 4;

    const records = parse(source, { file: "src/test.ts" });
    expect(records).toHaveLength(2);

    const [first, second] = records;

    expect(first?.marker).toBe("todo");
    expect(first?.contentText).toBe("first waymark\ncontinuation of first");
    expect(first?.startLine).toBe(FirstStartLine);
    expect(first?.endLine).toBe(FirstEndLine);

    expect(second?.marker).toBe("note");
    expect(second?.contentText).toBe("second waymark\ncontinuation of second");
    expect(second?.startLine).toBe(SecondStartLine);
    expect(second?.endLine).toBe(SecondEndLine);
  });

  test("handles closing ::: correctly", () => {
    const source = [
      "// todo ::: multi-line task",
      "//      ::: with more details",
      "//      ::: and explicit close :::",
      "// Some other comment",
    ].join("\n");

    const ExpectedEndLine = 3;

    const records = parse(source, { file: "src/test.ts" });
    expect(records).toHaveLength(1);
    const record = records[0];

    expect(record).toBeDefined();
    if (!record) {
      throw new Error("expected waymark record");
    }

    expect(record.contentText).toBe(
      "multi-line task\nwith more details\nand explicit close"
    );
    expect(record.endLine).toBe(ExpectedEndLine);
  });

  test("handles HTML comment continuations", () => {
    const source = [
      "<!-- tldr ::: comprehensive guide for waymarks",
      "<!--      ::: covering all syntax features -->",
    ].join("\n");

    const records = parse(source, { file: "docs/guide.md" });
    expect(records).toHaveLength(1);
    const record = records[0];

    expect(record).toBeDefined();
    if (!record) {
      throw new Error("expected waymark record");
    }

    expect(record.marker).toBe("tldr");
    expect(record.contentText).toBe(
      "comprehensive guide for waymarks\ncovering all syntax features"
    );
    expect(record.commentLeader).toBe("<!--");
  });

  test("ignores unknown properties in property-as-marker context", () => {
    const source = [
      "// todo     ::: main task",
      "// unknownprop ::: should be treated as regular waymark, not continuation",
    ].join("\n");

    const records = parse(source, { file: "src/test.ts" });
    // Should parse as two separate waymarks since unknownprop is not a known property
    expect(records).toHaveLength(2);

    const [first, second] = records;
    expect(first?.marker).toBe("todo");
    expect(first?.contentText).toBe("main task");

    expect(second?.marker).toBe("unknownprop");
    expect(second?.contentText).toBe(
      "should be treated as regular waymark, not continuation"
    );
  });

  test("property continuations work with various comment leaders", () => {
    const source = [
      "# tldr  ::: Python module for data processing",
      "# ref   ::: #data/processor",
      "# owner ::: @bob",
    ].join("\n");

    const records = parse(source, { file: "processor.py" });
    expect(records).toHaveLength(1);
    const record = records[0];

    expect(record).toBeDefined();
    if (!record) {
      throw new Error("expected waymark record");
    }

    expect(record.commentLeader).toBe("#");
    expect(record.properties).toMatchObject({
      ref: "#data/processor",
      owner: "@bob",
    });
  });
});
