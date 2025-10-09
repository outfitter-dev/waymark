# Signal Terminology Audit: "important" vs "starred"

## Summary

The `*` signal is currently referred to as both "important" and "starred" throughout the codebase. User preference is to standardize on **"starred"** for user-facing contexts.

## Categorization

### 1. Internal Data Structures (KEEP as `important`)

These are field names in types/interfaces and should remain `important` for API stability:

- `packages/grammar/src/types.ts:15` - `important: boolean` in WaymarkSignals type
- `packages/grammar/src/tokenizer.ts:11` - `important: boolean` field
- `packages/core/src/cache/serialization.ts:61-62` - serialization field
- `packages/core/src/insert.ts:28` - InsertSignals type
- `packages/core/src/remove.ts:14` - RemoveSignals type
- All other `signals.important` property accesses in code

**Recommendation**: Keep these as `important` - they're internal API contracts.

---

### 2. CLI Flags (CHANGE to `--starred`)

Current `--important` flag should become `--starred`:

**Files to update:**

- `packages/cli/src/index.ts:836` - `.option("--important", "add * (important) signal")`
- `packages/cli/src/commands/insert.ts:182` - `"--important": (state) => { state.signals.important = true; }`
- `packages/cli/src/commands/remove.ts:84-85` - `"--important": (state) => { state.criteria.signals.important = true; }`

**Change to:**

- `.option("--starred", "add * (starred) signal")`
- Accept both `--starred` and `--important` (deprecated) for backward compatibility

---

### 3. User-Facing Documentation (CHANGE to "starred")

Help text, examples, and user documentation should say "starred":

**Files to update:**

#### Help Text & Prompts:

- `README.md:72` - "show only important (*) waymarks" → "show only starred (*) waymarks"
- `packages/cli/src/index.ts:790` - "add signal: ^ (raised) or *(important)" → "^ (raised) or* (starred)"
- `packages/cli/src/index.ts:855-856` - Examples using `--important`
- `packages/cli/src/index.ts:915` - "Match important waymarks" → "Match starred waymarks"
- `packages/cli/src/commands/help/registry.ts:194` - "Show only important (*) waymarks" → "Show only starred (*) waymarks"
- `packages/cli/src/commands/insert.prompt.ts:59` - "^ (raised) or *(important)" → "^ (raised) or* (starred)"
- `packages/cli/src/commands/insert.prompt.ts:76` - "Insert with signal (important)" → "Insert with signal (starred)"
- `packages/cli/src/commands/modify.prompt.ts:9` - "--important adds *" → "--starred adds*"
- `packages/cli/src/commands/modify.prompt.ts:18` - "--raise and --important" → "--raise and --starred"
- `packages/cli/src/commands/remove.prompt.ts:60` - "Match important (*) waymarks" → "Match starred (*) waymarks"
- `packages/cli/src/commands/unified/index.prompt.ts:18` - "*(important)" → "* (starred)"
- `packages/cli/src/commands/unified/index.prompt.ts:44` - "Only show *(important) waymarks" → "Only show* (starred) waymarks"

#### PRD & Specification:

- `PRD.md:43` - "*(important)" → "* (starred)"
- `PRD.md:76` - "*(star) — important/high priority" → "* (star) — starred/high priority"

#### Insert/Remove Command Design Doc:

- `INSERT_REMOVE_COMMAND.md:171` - "Signal flags (raised, important)" → "Signal flags (raised, starred)"
- Multiple other occurrences in examples

---

### 4. Interactive Prompts (CHANGE to "starred")

Prompts shown to users during interactive mode:

**Files to update:**

- `packages/cli/src/commands/modify.ts:454` - "Add important signal (*) ?" → "Add starred signal (*) ?"
- Variable names like `addImportant` → `addStarred` in interactive prompts

---

### 5. Output Messages (CHANGE to "starred")

Messages shown to users in command output:

**Files to update:**

- `packages/cli/src/commands/modify.ts:654-655` - "Added/Removed important signal (*)" → "Added/Removed starred signal (*)"
- `packages/cli/src/utils/display/grouping.ts:26` - `signals.push("important")` → `signals.push("starred")`
- `packages/cli/src/utils/display/formatters/long.ts:15` - "important=" display → "starred="

---

### 6. Test Files (UPDATE for consistency)

Test descriptions and assertions should match user-facing terminology:

**Files to update:**

- `packages/cli/src/commands/modify.test.ts:76` - "adds important signal" → "adds starred signal"
- `packages/cli/src/index.test.ts:697` - "important bug" comment (this is example content, keep as-is)
- Test variable names: keep internal consistency with API

---

### 7. Comments & Code Documentation (MIXED)

**Keep "important":**

- Comments explaining the internal `important` field

**Change to "starred":**

- Comments explaining user-facing behavior
- `packages/cli/src/commands/format.prompt.ts:26` - "^ (raised) before *(important)" → "^ (raised) before* (starred)"

---

## Recommended Refactoring Approach

### Phase 1: CLI Flags (Breaking Change, needs migration path)

1. Add `--starred` flag alongside `--important`
2. Mark `--important` as deprecated in help text
3. Accept both for 1-2 releases
4. Remove `--important` in v2.0

### Phase 2: User-Facing Text (Non-breaking)

1. Update all help text, prompts, and messages to say "starred"
2. Update README and documentation
3. Update output formatting to show "starred=" instead of "important="

### Phase 3: Internal Consistency (Non-breaking)

1. Keep `signals.important` field name (breaking change not worth it)
2. Add type alias: `type StarredSignal = boolean` for clarity in new code
3. Update code comments to clarify: "important field (user-facing: starred)"

---

## Files NOT to Change

**Test fixtures with "important.ts" filename:**

- `packages/cli/src/index.test.ts:209,243,302,330,335` - These are test file names, not terminology

**Unrelated usage:**

- Any use of "important" not related to the `*` signal

---

## Backward Compatibility Strategy

### Option 1: Dual Flags (Recommended)

```typescript
.option("--starred", "add * (starred) signal")
.option("--important", "[DEPRECATED] alias for --starred")
```

### Option 2: Auto-detect

Parse both `--starred` and `--important`, set the same internal `signals.important` field.

### Option 3: Hard Break

Just rename and document in CHANGELOG as breaking change for v1.0.

---

## Estimated Impact

- **Breaking changes**: CLI flag rename (`--important` → `--starred`)
- **Non-breaking changes**: All user-facing text, help, documentation
- **No change**: Internal API field names (`signals.important`)

**Recommendation**: Implement dual flags for one release cycle, then deprecate `--important`.
