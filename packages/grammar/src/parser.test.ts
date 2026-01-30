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
    expect(record?.type).toBe("todo");
    expect(record?.signals).toEqual({
      flagged: false,
      current: false,
      starred: false,
    });
    expect(record?.tags).toContain("#arch/state");
    expect(record?.language).toBe("typescript");
    expect(record?.fileCategory).toBe("code");
  });

  test("parses properties, canonicals, relations, mentions, and tags", () => {
    const record = parseLine(
      "// note ::: summary see:#docs/prd from:#core/api owner:@alice #docs/prd",
      LINE_TEN,
      { file: "docs/PRD.md" }
    );

    expect(record).not.toBeNull();
    expect(record?.properties).toEqual({
      see: "#docs/prd",
      from: "#core/api",
      owner: "@alice",
    });
    expect(record?.canonicals).toEqual(["#docs/prd"]);
    expect(record?.relations).toEqual([
      { kind: "see", token: "#docs/prd" },
      { kind: "from", token: "#core/api" },
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

  test("does not treat decorator-like patterns as mentions", () => {
    const record = parseLine(
      "// about ::: uses @Injectable pattern for DI",
      LINE_ONE,
      { file: "src/di.ts" }
    );

    expect(record).not.toBeNull();
    expect(record?.mentions).toEqual([]);
  });

  test("does not treat decorator calls as mentions", () => {
    const record = parseLine(
      "// note ::: decorated with @Component() and @Input()",
      LINE_ONE,
      { file: "src/component.ts" }
    );

    expect(record).not.toBeNull();
    expect(record?.mentions).toEqual([]);
  });

  test("does not treat lowercase decorator calls as mentions", () => {
    const record = parseLine(
      "// note ::: uses @dataclass() and @staticmethod() decorators",
      LINE_ONE,
      { file: "src/model.py" }
    );

    expect(record).not.toBeNull();
    // Both rejected due to trailing parens - regex prevents backtracking
    expect(record?.mentions).toEqual([]);
  });

  test("extracts mention after email in same content", () => {
    const record = parseLine(
      "// todo ::: email user@foo.com then @alice reviews",
      LINE_ONE,
      { file: "src/workflow.ts" }
    );

    expect(record).not.toBeNull();
    expect(record?.mentions).toEqual(["@alice"]);
  });

  test("extracts valid lowercase mentions", () => {
    const record = parseLine(
      "// todo ::: @alice and @agent should review this #task",
      LINE_ONE,
      { file: "src/review.ts" }
    );

    expect(record).not.toBeNull();
    expect(record?.mentions).toContain("@alice");
    expect(record?.mentions).toContain("@agent");
  });

  test("extracts team/group mentions with slash", () => {
    const record = parseLine(
      "// todo ::: assign to @team/frontend for implementation",
      LINE_ONE,
      { file: "src/feature.ts" }
    );

    expect(record).not.toBeNull();
    expect(record?.mentions).toEqual(["@team/frontend"]);
  });

  test("handles HTML comment waymarks", () => {
    const record = parseLine(
      "<!-- tldr ::: overview for automation workflows #docs/guide -->",
      LINE_ONE,
      { file: "docs/guide.md" }
    );

    expect(record).not.toBeNull();
    expect(record?.type).toBe("tldr");
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

    expect(record.type).toBe("tldr");
    expect(record.startLine).toBe(1);
    expect(record.endLine).toBe(2);
    expect(record.contentText).toBe(
      "authentication service managing JWT tokens\nsupports refresh and revocation"
    );
  });

  test("parses multi-line block comment continuations", () => {
    const source = [
      "/* todo ::: document block comment support",
      " * ::: keeps continuation lines aligned",
      " * ::: trims closer */",
      "const noop = true;",
    ].join("\n");

    const records = parse(source, { file: "src/styles.css" });
    expect(records).toHaveLength(1);
    const record = records[0];

    expect(record).toBeDefined();
    if (!record) {
      throw new Error("expected waymark record for block comment");
    }

    expect(record.commentLeader).toBe("/*");
    expect(record.startLine).toBe(LINE_ONE);
    expect(record.endLine).toBe(LINE_THREE);
    expect(record.contentText).toBe(
      [
        "document block comment support",
        "keeps continuation lines aligned",
        "trims closer",
      ].join("\n")
    );
  });

  test("parses property-as-marker in continuation context", () => {
    const source = [
      "// tldr  ::: payment processor entry point",
      "// see   ::: #payments/stripe",
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

    expect(record.type).toBe("tldr");
    expect(record.contentText).toBe("payment processor entry point");
    expect(record.properties).toEqual({
      see: "#payments/stripe",
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

    expect(record.type).toBe("todo");
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
      "// see   ::: #auth/session",
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

    expect(record.type).toBe("todo");
    expect(record.contentText).toBe(
      "implement user authentication\nwith OAuth 2.0 and PKCE\nsupport social logins"
    );
    expect(record.properties).toMatchObject({
      fixes: "#auth/login-bug",
      see: "#auth/session",
    });
    expect(record.relations).toContainEqual({
      kind: "see",
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

    expect(first?.type).toBe("todo");
    expect(first?.contentText).toBe("first waymark\ncontinuation of first");
    expect(first?.startLine).toBe(FirstStartLine);
    expect(first?.endLine).toBe(FirstEndLine);

    expect(second?.type).toBe("note");
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

    expect(record.type).toBe("tldr");
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
    expect(first?.type).toBe("todo");
    expect(first?.contentText).toBe("main task");

    expect(second?.type).toBe("unknownprop");
    expect(second?.contentText).toBe(
      "should be treated as regular waymark, not continuation"
    );
  });

  test("property continuations work with various comment leaders", () => {
    const source = [
      "# tldr  ::: Python module for data processing",
      "# see   ::: #data/processor",
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
      see: "#data/processor",
      owner: "@bob",
    });
  });

  test("rejects properties with space after colon (unquoted values)", () => {
    // about ::: properties require no space after colon for unquoted values
    const record = parseLine(
      "// note ::: content: value with space should not be property",
      LINE_ONE,
      { file: "src/test.ts" }
    );

    expect(record).not.toBeNull();
    expect(record?.properties).toEqual({});
    expect(record?.contentText).toBe(
      "content: value with space should not be property"
    );
  });

  test("accepts properties without space after colon", () => {
    const record = parseLine(
      "// note ::: owner:@alice status:active",
      LINE_ONE,
      { file: "src/test.ts" }
    );

    expect(record).not.toBeNull();
    expect(record?.properties).toEqual({
      owner: "@alice",
      status: "active",
    });
  });

  test("ignores property-like patterns inside backticks", () => {
    const record = parseLine(
      "// note ::: use `key:value` syntax for properties",
      LINE_ONE,
      { file: "src/test.ts" }
    );

    expect(record).not.toBeNull();
    expect(record?.properties).toEqual({});
    expect(record?.contentText).toBe("use `key:value` syntax for properties");
  });

  test("ignores multiple property patterns inside backticks", () => {
    const record = parseLine(
      "// note ::: example `owner:@bob` and `status:pending` in code",
      LINE_ONE,
      { file: "src/test.ts" }
    );

    expect(record).not.toBeNull();
    expect(record?.properties).toEqual({});
    expect(record?.contentText).toContain("`owner:@bob`");
    expect(record?.contentText).toContain("`status:pending`");
  });

  test("parses properties outside backticks but not inside", () => {
    const record = parseLine(
      "// note ::: status:active see `example:value` for syntax",
      LINE_ONE,
      { file: "src/test.ts" }
    );

    expect(record).not.toBeNull();
    expect(record?.properties).toEqual({
      status: "active",
    });
    expect(record?.contentText).toContain("`example:value`");
  });

  test("ignores reserved directive keys like wm:ignore in content", () => {
    // about ::: wm:ignore is a fence directive, not a property
    const record = parseLine(
      "<!-- tldr ::: guide for excluding waymarks using wm:ignore fences -->",
      LINE_ONE,
      { file: "docs/guide.md" }
    );

    expect(record).not.toBeNull();
    expect(record?.type).toBe("tldr");
    expect(record?.properties).toEqual({});
    expect(record?.contentText).toBe(
      "guide for excluding waymarks using wm:ignore fences"
    );
  });

  test("allows quoted properties with spaces after colon", () => {
    // about ::: quoted values can have spaces anywhere
    const record = parseLine(
      '// note ::: message:"hello world" owner:@alice',
      LINE_ONE,
      { file: "src/test.ts" }
    );

    expect(record).not.toBeNull();
    expect(record?.properties).toEqual({
      message: "hello world",
      owner: "@alice",
    });
  });

  test("parses sym: property for symbol binding", () => {
    const record = parseLine(
      "// about ::: authentication handler sym:handleAuth #auth",
      LINE_ONE,
      { file: "src/auth.ts" }
    );

    expect(record).not.toBeNull();
    expect(record?.type).toBe("about");
    expect(record?.properties).toEqual({
      sym: "handleAuth",
    });
    expect(record?.tags).toContain("#auth");
  });

  test("parses sym: as property-as-marker in continuation context", () => {
    const source = [
      "// about ::: user authentication service",
      "// sym   ::: AuthService",
      "// owner ::: @alice",
    ].join("\n");

    const records = parse(source, { file: "src/auth.ts" });
    expect(records).toHaveLength(1);
    const record = records[0];

    expect(record).toBeDefined();
    if (!record) {
      throw new Error("expected waymark record");
    }

    expect(record.type).toBe("about");
    expect(record.contentText).toBe("user authentication service");
    expect(record.properties).toEqual({
      sym: "AuthService",
      owner: "@alice",
    });
  });
});

describe("wm:ignore fence handling", () => {
  test("fence with wm:ignore skips waymarks inside", () => {
    const source = [
      "// note ::: real waymark before fence",
      "```typescript wm:ignore",
      "// todo ::: example waymark in docs",
      "// fix ::: another example",
      "```",
      "// note ::: real waymark after fence",
    ].join("\n");

    const records = parse(source, { file: "docs/guide.md" });
    expect(records).toHaveLength(2);

    expect(records[0]?.type).toBe("note");
    expect(records[0]?.contentText).toBe("real waymark before fence");

    expect(records[1]?.type).toBe("note");
    expect(records[1]?.contentText).toBe("real waymark after fence");
  });

  test("fence without wm:ignore attribute parses waymarks normally", () => {
    const source = [
      "```typescript",
      "// todo ::: this waymark should be parsed",
      "```",
    ].join("\n");

    const records = parse(source, { file: "docs/guide.md" });
    expect(records).toHaveLength(1);
    expect(records[0]?.type).toBe("todo");
  });

  test("multiple fences in sequence work correctly", () => {
    const source = [
      "```typescript wm:ignore",
      "// todo ::: ignored",
      "```",
      "// note ::: real waymark",
      "```javascript wm:ignore",
      "// fix ::: also ignored",
      "```",
      "// warn ::: another real waymark",
    ].join("\n");

    const records = parse(source, { file: "docs/guide.md" });
    expect(records).toHaveLength(2);

    expect(records[0]?.type).toBe("note");
    expect(records[1]?.type).toBe("warn");
  });

  test("unclosed fence gracefully skips remaining content", () => {
    const source = [
      "// note ::: waymark before unclosed fence",
      "```typescript wm:ignore",
      "// todo ::: this is inside unclosed fence",
      "// fix ::: so is this",
    ].join("\n");

    const records = parse(source, { file: "docs/guide.md" });
    expect(records).toHaveLength(1);
    expect(records[0]?.type).toBe("note");
    expect(records[0]?.contentText).toBe("waymark before unclosed fence");
  });

  test("wm:ignore is case insensitive", () => {
    const sources = [
      "```typescript WM:IGNORE\n// todo ::: ignored\n```",
      "```typescript WM:Ignore\n// todo ::: ignored\n```",
      "```typescript wm:Ignore\n// todo ::: ignored\n```",
    ];

    for (const source of sources) {
      const records = parse(source, { file: "docs/guide.md" });
      expect(records).toHaveLength(0);
    }
  });

  test("wm:ignore works with different backtick counts", () => {
    const source = [
      "````typescript wm:ignore",
      "// todo ::: ignored in 4-backtick fence",
      "```",
      "// still inside because only 3 backticks",
      "````",
      "// note ::: real waymark after fence",
    ].join("\n");

    const records = parse(source, { file: "docs/guide.md" });
    expect(records).toHaveLength(1);
    expect(records[0]?.type).toBe("note");
  });

  test("wm:ignore works with indented fences", () => {
    const source = [
      "  ```typescript wm:ignore",
      "  // todo ::: ignored",
      "  ```",
      "// note ::: real waymark",
    ].join("\n");

    const records = parse(source, { file: "docs/guide.md" });
    expect(records).toHaveLength(1);
    expect(records[0]?.type).toBe("note");
  });

  test("fence closing requires empty info string", () => {
    const source = [
      "```typescript wm:ignore",
      "// todo ::: ignored",
      "```typescript",
      "// still ignored because closing fence had info string",
      "```",
      "// note ::: real waymark",
    ].join("\n");

    const records = parse(source, { file: "docs/guide.md" });
    expect(records).toHaveLength(1);
    expect(records[0]?.type).toBe("note");
  });

  test("wm:ignore anywhere in info string", () => {
    const source = [
      '```typescript title="example" wm:ignore highlight={1}',
      "// todo ::: ignored",
      "```",
    ].join("\n");

    const records = parse(source, { file: "docs/guide.md" });
    expect(records).toHaveLength(0);
  });

  test("includeIgnored option parses waymarks inside wm:ignore fences", () => {
    const source = [
      "// note ::: real waymark",
      "```typescript wm:ignore",
      "// todo ::: example in docs",
      "// fix ::: another example",
      "```",
    ].join("\n");

    const withoutFlag = parse(source, { file: "docs/guide.md" });
    expect(withoutFlag).toHaveLength(1);
    expect(withoutFlag[0]?.type).toBe("note");

    const withFlag = parse(source, {
      file: "docs/guide.md",
      includeIgnored: true,
    });
    expect(withFlag).toHaveLength(3);
    expect(withFlag[0]?.type).toBe("note");
    expect(withFlag[1]?.type).toBe("todo");
    expect(withFlag[2]?.type).toBe("fix");
  });
});
