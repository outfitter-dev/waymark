<!-- tldr ::: P0 correctness blockers requiring fix before v1-rc release -->

# P0 Blockers: Correctness Issues

**Status:** Must fix before v1.0-rc.1
**Confidence:** Universal consensus from three independent reviewers

These four issues were independently identified by all reviewers as critical blockers. Each causes incorrect behavior or breaks documented contracts.

---

## P0-1: Non-Deterministic ID Generation

### Location

`packages/core/src/ids.ts:166`

### Problem

The `generateUniqueId` function includes `Date.now()` in the hash seed, making IDs non-deterministic across runs.

```typescript
// Current (broken)
const baseInput = `${metadata.file}|${metadata.line}|${metadata.type}|${metadata.content}|${Date.now()}`;
```

### Impact

- Stable references between waymarks break
- History tracking becomes unreliable
- Relational graphs have invalid edges
- Reproducible builds fail in CI
- Same waymark gets different ID on each scan

### Fix

```typescript
// Fixed - deterministic seed using content hash
const baseInput = `${metadata.file}|${metadata.line}|${metadata.type}|${metadata.contentHash}`;
```

### Collision Handling

The existing `attempt` counter in `makeId()` already handles collisions deterministically. Once `Date.now()` is removed, collisions are resolved by incrementing the attempt counter, which produces stable results.

### Required Tests

```typescript
// packages/core/src/ids.test.ts
describe("ID determinism", () => {
  it("generates identical IDs for identical metadata across runs", async () => {
    const metadata = {
      file: "src/auth.ts",
      line: 42,
      type: "todo",
      content: "implement OAuth",
      contentHash: fingerprintContent("implement OAuth"),
      contextHash: fingerprintContext("function auth() {"),
    };

    const id1 = await manager.reserveId(metadata);

    // Simulate new instance (fresh run)
    const manager2 = new WaymarkIdManager(config, index);
    const id2 = await manager2.reserveId(metadata);

    expect(id1).toBe(id2);
  });

  it("generates different IDs for different content", async () => {
    const base = { file: "src/auth.ts", line: 42, type: "todo" };
    const id1 = await manager.reserveId({ ...base, content: "implement OAuth" });
    const id2 = await manager.reserveId({ ...base, content: "add caching" });
    expect(id1).not.toBe(id2);
  });
});
```

### Verification

```bash
# Run twice, IDs should match
wm find src/ --json | jq '.[0].id' > /tmp/id1.txt
wm find src/ --json | jq '.[0].id' > /tmp/id2.txt
diff /tmp/id1.txt /tmp/id2.txt  # Should show no differences
```

---

## P0-2: ID Length Mismatch (Spec vs Default)

### Location

`packages/core/src/config.ts:53`

### Problem

Default configuration sets ID length to 8 characters, but the spec requires 7.

```typescript
// Current (wrong)
ids: {
  mode: "prompt",
  length: 8,  // Spec says 7
  ...
}
```

### Impact

- Contract violation with spec consumers
- External tools expecting 7-char IDs fail validation
- Inconsistency between documented and actual behavior

### Fix

```typescript
// packages/core/src/config.ts:51-57
ids: {
  mode: "prompt",
  length: 7,  // Match spec
  rememberUserChoice: true,
  trackHistory: true,
  assignOnRefresh: false,
},
```

### Rationale

7 characters in base36 provides 78 billion unique values (36^7), which is more than sufficient for any codebase. Shorter IDs are more readable and spec-compliant.

### Required Tests

```typescript
// packages/core/src/config.test.ts
describe("DEFAULT_CONFIG", () => {
  const SPEC_ID_LENGTH = 7; // Single source of truth

  it("uses spec-compliant ID length", () => {
    expect(DEFAULT_CONFIG.ids.length).toBe(SPEC_ID_LENGTH);
  });
});
```

### Verification

```bash
wm add test.ts 1 "todo ::: test" --json | jq '.id | length'
# Should output: 7
```

---

## P0-3: Block Comment Support Missing

### Location

`packages/grammar/src/tokenizer.ts:5`

### Problem

The tokenizer only recognizes line comment leaders, missing `/*` for block comments:

```typescript
// Current (incomplete)
const COMMENT_LEADERS = ["<!--", "//", "--", "#"] as const;
```

This causes CSS waymarks and block-comment-only languages to be silently ignored.

### Impact

- CSS waymarks produce false negatives
- Languages without line comments (pure CSS) cannot use waymarks
- Documentation claims block comment support that doesn't exist

### Fix (Phase 1: Single-line)

```typescript
// packages/grammar/src/tokenizer.ts

const LINE_COMMENT_LEADERS = ["<!--", "//", "--", "#"] as const;
const BLOCK_COMMENT_OPEN = "/*" as const;
const BLOCK_COMMENT_CLOSE = "*/" as const;

export type CommentStyle = "line" | "block";

export function findCommentLeader(text: string): { leader: string; style: CommentStyle } | null {
  // Check line comment leaders first
  for (const leader of LINE_COMMENT_LEADERS) {
    if (text.startsWith(leader)) {
      return { leader, style: "line" };
    }
  }

  // Check block comment
  if (text.startsWith(BLOCK_COMMENT_OPEN)) {
    return { leader: BLOCK_COMMENT_OPEN, style: "block" };
  }

  return null;
}

export function parseHeader(line: string): ParsedHeader | null {
  // ... existing indent/trim logic ...

  const commentInfo = findCommentLeader(trimmed);
  if (!commentInfo) return null;

  let afterLeader = trimmed.slice(commentInfo.leader.length);

  // Handle block comment: strip trailing */
  if (commentInfo.style === "block") {
    const closeIndex = afterLeader.lastIndexOf(BLOCK_COMMENT_CLOSE);
    if (closeIndex !== -1) {
      afterLeader = afterLeader.slice(0, closeIndex).trimEnd();
    }
  }

  // ... rest of parsing ...
}
```

### Required Tests

```typescript
// packages/grammar/src/tokenizer.test.ts
describe("block comment support", () => {
  it("parses single-line /* ... */ waymarks", () => {
    const result = parseHeader("/* todo ::: implement validation */");
    expect(result?.type).toBe("todo");
    expect(result?.content.trim()).toBe("implement validation");
  });

  it("parses CSS waymarks", () => {
    const result = parseHeader("/* tldr ::: button component styles */");
    expect(result?.type).toBe("tldr");
    expect(result?.commentStyle).toBe("block");
  });

  it("strips trailing */ from content", () => {
    const result = parseHeader("/* note ::: performance hotpath */");
    expect(result?.content).not.toContain("*/");
  });

  it("handles waymark with no trailing space before */", () => {
    const result = parseHeader("/* fix ::: memory leak*/");
    expect(result?.type).toBe("fix");
    expect(result?.content.trim()).toBe("memory leak");
  });
});
```

### Phase 2 (Deferred)

Multi-line block comment state tracking is deferred to post-v1.0. Single-line `/* waymark */` covers the primary use case (CSS files).

### Verification

```bash
echo '/* tldr ::: test stylesheet */' > test.css
wm find test.css --json | jq '.[0].type'
# Should output: "tldr"
rm test.css
```

---

## P0-4: Schema/Runtime Drift for Relations

### Locations

- Schema: `schemas/waymark-record.schema.json:79`
- Runtime: `packages/grammar/src/properties.ts:19-22`

### Problem

The JSON schema defines relation kinds that don't match the runtime extraction:

```json
// Schema (wrong)
"kind": {
  "enum": ["ref", "rel", "depends", "needs", "blocks", "dupeof"]
}
```

```typescript
// Runtime (correct)
const RELATION_KIND_MAP = {
  see: "see",
  docs: "docs",
  from: "from",
  replaces: "replaces"
};
```

### Impact

- External tools validating against schema reject valid output
- MCP server output fails schema validation
- Integration tests against schema are misleading

### Fix

```json
// schemas/waymark-record.schema.json:71-90
"relations": {
  "type": "array",
  "description": "Relational references to other waymarks",
  "items": {
    "type": "object",
    "required": ["kind", "token"],
    "properties": {
      "kind": {
        "enum": ["see", "docs", "from", "replaces"],
        "description": "Type of relation (v1 grammar)"
      },
      "token": {
        "type": "string",
        "pattern": "^#[a-z][A-Za-z0-9._/:%-]*$",
        "description": "Token being referenced (must start with #)"
      }
    },
    "additionalProperties": false
  }
}
```

### CI Enforcement

Create a script to prevent future drift:

```typescript
// scripts/check-spec-alignment.ts
import { RELATION_KIND_MAP } from "@waymarks/grammar";
import schema from "../schemas/waymark-record.schema.json";

const schemaKinds = new Set(
  schema.properties.relations.items.properties.kind.enum
);
const runtimeKinds = new Set(Object.values(RELATION_KIND_MAP));

const missingInSchema = [...runtimeKinds].filter(k => !schemaKinds.has(k));
const extraInSchema = [...schemaKinds].filter(k => !runtimeKinds.has(k));

if (missingInSchema.length > 0 || extraInSchema.length > 0) {
  console.error("Schema/runtime drift detected:");
  console.error("  Missing in schema:", missingInSchema);
  console.error("  Extra in schema:", extraInSchema);
  process.exit(1);
}

console.log("Spec alignment: OK");
```

Add to `package.json`:

```json
{
  "scripts": {
    "check:alignment": "bun run scripts/check-spec-alignment.ts"
  }
}
```

### Verification

```bash
# After fix, this should pass
bun run check:alignment

# Validate CLI output against schema
wm find src/ --json | npx ajv validate -s schemas/waymark-record.schema.json
```

---

## Summary

| Blocker | Fix Complexity | Risk | Impact |
|---------|---------------|------|--------|
| P0-1: Non-deterministic IDs | S (one line) | Low | Very High |
| P0-2: ID length mismatch | S (one line) | Low | High |
| P0-3: Block comment support | S (add leader + strip) | Low | High |
| P0-4: Schema/runtime drift | S (update enum) | Low | High |

**Total effort:** 4 small changes that can ship in a single PR.

These fixes address the unanimous consensus from all three reviewers and immediately elevate waymark's reliability to release-candidate quality.
