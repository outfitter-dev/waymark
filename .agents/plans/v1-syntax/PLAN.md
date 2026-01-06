<!-- tldr ::: v1 syntax changes implementation plan with Graphite stack sequence #docs/plan -->

# Waymark v1 Syntax Changes - Implementation Plan

> Created: 2025-01-06
> Status: In Progress
> Tracking Issue: [#129](https://github.com/outfitter-dev/waymark/issues/129)

## Overview

This plan sequences 8 branches for v1 breaking syntax changes. Each branch is a **complete vertical slice** that passes CI independently. No backward compatibility.

## Summary of Changes

| Change | Before | After |
|--------|--------|-------|
| Raised signal | `^` | `~` |
| Signal order | `^*` | `~*` |
| Section marker | `this` | `about` |
| ID format | `wm:xxx` | `[[hash]]` or `[[hash\|alias]]` |
| Draft ID | n/a | `[[alias]]` |
| Relations | `ref/depends/needs/blocks/dupeof/rel` | `see/docs/from/replaces` |
| Symbol binding | n/a | `sym:` property |
| Mentions | permissive | strict (no emails/decorators) |

## Branch Sequence

| # | Branch | Size | Risk | GitHub Issue |
|---|--------|------|------|--------------|
| 1 | `syntax/types-about` | S | Low | #130 |
| 2 | `syntax/signals-tilde` | M | Medium | #130 |
| 3 | `syntax/relations-v2` | M | Medium | #132 |
| 4 | `syntax/properties-sym` | S | Low | #132 |
| 5 | `syntax/tags-mentions` | S | Low | #133 |
| 6 | `syntax/ids-bracket` | L | High | #131 |
| 7 | `syntax/continuations` | S | Low | #134 |
| 8 | `syntax/docs-v1` | M | Low | #135 |

## Dependency Graph

```text
types-about (1)
      │
      v
signals-tilde (2)
      │
      v
relations-v2 (3)
      │
      ├────────────────┐
      v                v
properties-sym (4)    tags-mentions (5)  [parallel ok]
      │                │
      └───────┬────────┘
              v
      ids-bracket (6)
              │
              v
      continuations (7)
              │
              v
        docs-v1 (8)
```

## Detailed Branch Plans

### Branch 1: `syntax/types-about`

**Summary**: Rename `this` marker to `about`.

**Files to Modify**:

- `packages/grammar/src/constants.ts` - Change marker name in `MARKER_DEFINITIONS` and `MARKERS`
- `packages/grammar/src/parser.test.ts` - Update test expectations
- `packages/grammar/src/constants.test.ts` - Update marker list assertions
- `.waymark/rules/WAYMARKS.md` - Update marker documentation
- `.waymark/rules/THIS.md` - Rename to `ABOUT.md`, update content

**Verification**:

```bash
rg 'this\s*:::' --type ts  # Find test fixtures using 'this'
rg '"this"' packages/grammar/src/constants.ts
```

**Estimated LOC**: ~50-80

---

### Branch 2: `syntax/signals-tilde`

**Summary**: Change flagged signal from `^` to `~`. Canonical order becomes `~*`.

**Files to Modify**:

Grammar:

- `packages/grammar/src/constants.ts` - Change `SIGNALS.flagged` from `"^"` to `"~"`
- `packages/grammar/src/tokenizer.ts` - Update signal detection (lines 64-67)
- `packages/grammar/src/types.ts` - Update comments
- `packages/grammar/src/parser.test.ts` - Update signal test expectations

Core:

- `packages/core/src/format.ts` - Update `buildSignalPrefix` (line 221)
- `packages/core/src/edit.ts` - Update `buildSignalPrefix` (line 528)
- `packages/core/src/insert.ts` - Update `buildSignals` (line 417)
- `packages/core/src/format.test.ts` - Update formatting tests
- `packages/core/src/edit.test.ts` - Update edit tests

CLI:

- `packages/cli/src/utils/display/formatters/enhanced.ts` - Signal display
- `packages/cli/src/utils/display/formatters/text.ts` - Signal display
- `packages/cli/src/utils/display/formatters/styles.ts` - Signal display

**Verification**:

```bash
rg '"\^"' packages/ --type ts        # Find ^ string literals
rg "'\^'" packages/ --type ts        # Find ^ char literals
rg '\\^' packages/ --type ts         # Find ^ in regexes
rg 'flagged' packages/ --type ts     # Find all flagged references
```

**Estimated LOC**: ~150-200

---

### Branch 3: `syntax/relations-v2`

**Summary**: Replace relation keys with new set.

**Before**: `ref`, `rel`, `depends`, `needs`, `blocks`, `dupeof`
**After**: `see`, `docs`, `from`, `replaces`

**Files to Modify**:

Grammar:

- `packages/grammar/src/constants.ts` - Update `PROPERTY_KEYS` set
- `packages/grammar/src/types.ts` - Update `relations` kind union (line 21)
- `packages/grammar/src/properties.ts` - Update `RELATION_KIND_MAP` (line 12)
- `packages/grammar/src/parser.test.ts` - Update relation test expectations
- `packages/grammar/src/constants.test.ts` - Update key assertions

Core:

- `packages/core/src/graph.ts` - Update `GraphEdge.relation` type
- `packages/core/src/graph.test.ts` - Update graph tests
- `packages/core/src/format.test.ts` - Update property key tests

**Type Change**:

```typescript
// Before
relations: Array<{ kind: "ref" | "rel" | "depends" | "needs" | "blocks" | "dupeof"; token: string; }>;

// After
relations: Array<{ kind: "see" | "docs" | "from" | "replaces"; token: string; }>;
```

**Estimated LOC**: ~100-150

---

### Branch 4: `syntax/properties-sym`

**Summary**: Add `sym:` property key, enforce no empty values.

**Files to Modify**:

- `packages/grammar/src/constants.ts` - Add `sym` to `PROPERTY_KEYS`
- `packages/grammar/src/properties.ts` - Add validation for empty values, add `sym` handling
- `packages/grammar/src/parser.test.ts` - Add `sym:` test cases

**Estimated LOC**: ~50-80

---

### Branch 5: `syntax/tags-mentions`

**Summary**: Stricter `@mention` rules to avoid emails and decorators.

**Current Regex** (properties.ts line 9):

```typescript
/(?:^|[^A-Za-z0-9/_-])(@[A-Za-z0-9/_-]+)/gm
```

**Should reject**:

- Email-like: `user@domain.com`
- Decorators: `@Component()`, `@Injectable`
- Scoped packages: `@scope/package`

**Files to Modify**:

- `packages/grammar/src/properties.ts` - Update `MENTION_REGEX`
- `packages/grammar/src/parser.test.ts` - Add edge case tests

**Estimated LOC**: ~40-60

---

### Branch 6: `syntax/ids-bracket`

**Summary**: Change ID format from `wm:xxx` to `[[hash]]` or `[[hash|alias]]`.

**Files to Modify**:

Core:

- `packages/core/src/ids.ts` - Update ID generation, `normalizeId`, `makeId`
- `packages/core/src/id-index.ts` - Update storage format, ID normalization
- `packages/core/src/edit.ts` - Update `ID_REGEX` (line 559), `ID_TRAIL_REGEX` (line 560)
- `packages/core/src/remove.ts` - Update ID extraction patterns
- `packages/core/src/edit.test.ts` - Update ID test expectations
- `packages/core/src/remove.test.ts` - Update removal tests

CLI:

- `packages/cli/src/commands/modify.test.ts` - Update CLI tests

**Key Changes**:

```typescript
// Before
const ID_REGEX = /\bwm:[a-z0-9-]+\b/gi;
function normalizeId(id: string): string {
  return id.startsWith("wm:") ? id : `wm:${id}`;
}

// After
const ID_REGEX = /\[\[([a-z0-9-]+)(?:\|([^\]]+))?\]\]/gi;
function normalizeId(id: string): string {
  // Handle [[hash]], [[hash|alias]], [[alias]]
}
```

**Migration Note**: Consider adding `wm migrate-ids` command for existing codebases.

**Estimated LOC**: ~200-300

**Risk**: HIGH - changes storage format, affects ID tracking

---

### Branch 7: `syntax/continuations`

**Summary**: Already implemented. Docs clarification only.

Continuation handling exists in `packages/grammar/src/content.ts`. This branch ensures documentation matches implementation.

**Files to Modify**:

- `docs/GRAMMAR.md` - Clarify continuation behavior
- `docs/waymark/SPEC.md` - Update examples

**Estimated LOC**: ~30-50

---

### Branch 8: `syntax/docs-v1`

**Summary**: Comprehensive documentation update for all v1 syntax.

**Files to Modify**:

- `README.md` - Update examples
- `docs/waymark/SPEC.md` - Full v1 syntax reference
- `docs/GRAMMAR.md` - Update grammar rules
- `.waymark/rules/WAYMARKS.md` - Update all examples
- `.waymark/rules/CONVENTIONS.md` - Update conventions
- `.waymark/rules/TLDRs.md` - Update examples
- `.waymark/rules/ABOUT.md` - New file (from THIS.md rename)
- `AGENTS.md` - Update agent guidance
- `docs/cli/commands.md` - Update CLI examples
- `docs/cli/waymark_editing.md` - Update ID/edit examples

**Verification**:

```bash
rg ':::'  # Find all waymark examples
rg 'wm:'  # Find legacy ID references
rg '\^'   # Find old flagged signal references
```

**Estimated LOC**: ~200-300

---

## Execution Strategy

Each branch will be implemented by a `baselayer:senior-dev` subagent with:

1. Clear scope from this plan
2. TDD methodology (red-green-refactor)
3. All tests passing before PR

**Workflow per branch**:

```bash
gt create syntax/<name>      # Create branch
# ... implement changes ...
bun test                     # Verify tests pass
bun check:all                # Full CI check
gt submit                    # Create PR
```

## Risk Assessment

| Branch | Risk | Mitigation |
|--------|------|------------|
| types-about | Low | Simple rename, no logic |
| signals-tilde | Medium | Comprehensive grep |
| relations-v2 | Medium | Type system catches mismatches |
| properties-sym | Low | Additive change |
| tags-mentions | Low | Edge case tests |
| ids-bracket | **High** | Thorough tests, migration path |
| continuations | Low | Docs only |
| docs-v1 | Low | Review for accuracy |

## Progress Tracking

- [ ] Branch 1: `syntax/types-about`
- [ ] Branch 2: `syntax/signals-tilde`
- [ ] Branch 3: `syntax/relations-v2`
- [ ] Branch 4: `syntax/properties-sym`
- [ ] Branch 5: `syntax/tags-mentions`
- [ ] Branch 6: `syntax/ids-bracket`
- [ ] Branch 7: `syntax/continuations`
- [ ] Branch 8: `syntax/docs-v1`
