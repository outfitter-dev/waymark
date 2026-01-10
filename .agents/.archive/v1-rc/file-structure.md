<!-- tldr ::: file size audit results and proposed splits for files over 400 lines -->

# File Structure Improvements

**Phase:** P4 (Post-RC)
**Priority:** Deferred - architecture improvements

This document consolidates file size audits across all packages and proposes splits for files exceeding the 400-line guideline. These are **not blocking for v1-rc** but improve maintainability.

---

## Summary by Package

| Package | Files Over 400 | Largest File | Priority |
|---------|----------------|--------------|----------|
| `packages/cli` | 10 files | `index.ts` (1576 lines) | Medium |
| `packages/core` | 6 files | `remove.ts` (681 lines) | Low |
| `packages/grammar` | 1 file | `parser.test.ts` (555 lines) | Low |
| `apps/mcp` | 1 file | `add.ts` (408 lines) | Low |

**Note:** CLI commands ARE already modularized in `packages/cli/src/commands/`. The entry file size is less critical than originally claimed.

---

## CLI Package (`packages/cli`)

### Files Over 400 Lines

| File | Lines | Split Priority |
|------|-------|----------------|
| `src/index.ts` | 1576 | Medium |
| `src/index.test.ts` | 1245 | Low |
| `src/commands/modify.ts` | 1018 | Medium |
| `src/commands/help/registry.ts` | 642 | Low (config data) |
| `src/commands/remove.ts` | 621 | Medium |
| `src/commands/doctor.ts` | 571 | Medium |
| `src/commands/add.ts` | 524 | Medium |
| `src/utils/display/formatters/enhanced.ts` | 444 | Low |
| `src/commands/lint.ts` | 434 | Low |
| `src/utils/display/formatters/wrapping.ts` | 409 | Skip |

### Proposed: `src/index.ts` Split

**Current responsibilities:**

- CLI program creation and configuration
- All command handler functions (8 handlers)
- Option flag definitions
- Help formatting and custom help builder
- Command registration

**Proposed structure:**

```text
src/
├── index.ts                    # Entry point only (~100 lines)
├── program.ts                  # createProgram() + registration (~200 lines)
├── options/
│   └── definitions.ts          # Flag arrays (~100 lines)
├── handlers/
│   ├── format.ts               # handleFormatCommand (~80 lines)
│   ├── lint.ts                 # handleLintCommand (~100 lines)
│   ├── add.ts                  # handleAddCommand (~80 lines)
│   ├── remove.ts               # handleRemoveCommand (~60 lines)
│   ├── modify.ts               # handleModifyCommand (~40 lines)
│   ├── doctor.ts               # handleDoctorCommand (~40 lines)
│   ├── unified.ts              # handleUnifiedCommand (~150 lines)
│   └── update.ts               # handleUpdateAction (~80 lines)
└── help/
    └── formatter.ts            # Help formatting (~150 lines)
```

### Proposed: `src/commands/modify.ts` Split

**Current:** 1018 lines with mixed responsibilities.

**Proposed structure:**

```text
src/commands/modify/
├── index.ts                    # Main runModifyCommand (~150 lines)
├── types.ts                    # Type definitions (~80 lines)
├── interactive/
│   ├── session.ts              # runInteractiveSession (~100 lines)
│   ├── wizard.ts               # runInteractiveWizard (~150 lines)
│   └── steps.ts                # buildInteractiveSteps (~100 lines)
├── modifications.ts            # Core logic (~200 lines)
├── output.ts                   # Formatting (~150 lines)
└── id-index.ts                 # ID index updates (~80 lines)
```

---

## Core Package (`packages/core`)

### Files Over 400 Lines

| File | Lines | Split Priority |
|------|-------|----------------|
| `remove.ts` | 681 | Medium |
| `edit.ts` | 651 | Medium |
| `config.ts` | 566 | Low |
| `insert.ts` | 533 | Low |
| `cache/index.test.ts` | 473 | Skip (test file) |
| `format.ts` | 435 | Low |

### Proposed: `remove.ts` Split

**Proposed structure:**

```text
src/removal/
├── index.ts                    # Re-exports
├── schemas.ts                  # Zod schemas (~90 lines)
├── criteria.ts                 # Matching logic (~130 lines)
└── file-context.ts             # File I/O (~80 lines)

src/remove.ts                   # Main function (~380 lines)
```

### Proposed: `edit.ts` Split

**Proposed structure:**

```text
src/edit/
├── index.ts                    # Re-exports
├── schemas.ts                  # Types (~55 lines)
├── rendering.ts                # Line building (~140 lines)
└── utils.ts                    # Helpers (~80 lines)

src/edit.ts                     # Main function (~380 lines)
```

### Proposed: `config.ts` Split

**Proposed structure:**

```text
src/config/
├── index.ts                    # Re-exports + facade
├── defaults.ts                 # DEFAULT_CONFIG (~80 lines)
├── loaders.ts                  # Disk loading (~120 lines)
├── normalization.ts            # Shape normalization (~250 lines)
└── readers.ts                  # Value readers (~80 lines)
```

---

## Grammar Package (`packages/grammar`)

### Files Over 400 Lines

| File | Lines | Split Priority |
|------|-------|----------------|
| `parser.test.ts` | 555 | Optional |

**Status:** Source files are well-organized. Only test file exceeds limit.

**Optional split:**

- `parser-line.test.ts` - `parseLine` function tests (~160 lines)
- `parser-multiline.test.ts` - `parse` function tests (~400 lines)

**Recommendation:** Keep as-is. Test co-location benefits outweigh split.

---

## MCP App (`apps/mcp`)

### Files Over 400 Lines

| File | Lines | Split Priority |
|------|-------|----------------|
| `src/tools/add.ts` | 408 | Low |

**Proposed extraction:**

```text
src/utils/
├── comment-styles.ts           # Style detection (~65 lines)
├── waymark-id.ts               # ID handling (~55 lines)
└── insertion.ts                # Line rendering (~80 lines)

src/tools/add.ts                # Main handler (~200 lines)
```

---

## Shared Patterns to Extract

Several patterns repeat across packages:

### 1. File Context Loading

Both `remove.ts` and `edit.ts` have nearly identical file loading:

```typescript
// Proposed: packages/core/src/utils/file-utils.ts
export type FileLines = {
  lines: string[];
  eol: string;
  endsWithFinalEol: boolean;
};

export function loadFileLines(path: string): Promise<FileLines | null>;
export function writeFileLines(path: string, lines: FileLines): Promise<void>;
```

### 2. Record Finding

Duplicate implementations across files:

```typescript
// Proposed: packages/core/src/utils/record-utils.ts
export function findRecordByLine(records: WaymarkRecord[], line: number): WaymarkRecord | undefined;
export function findRecordById(records: WaymarkRecord[], id: string): WaymarkRecord | undefined;
```

### 3. Signal Prefix Building

Repeated in `edit.ts` and `format.ts`:

```typescript
// Proposed: packages/core/src/utils/signals.ts
export function buildSignalPrefix(signals: { flagged?: boolean; starred?: boolean }): string {
  let prefix = "";
  if (signals.flagged) prefix += "~";
  if (signals.starred) prefix += "*";
  return prefix;
}
```

### 4. HTML Comment Handling

Scattered across `edit.ts`, `insert.ts`, and `format.ts`:

```typescript
// Proposed: packages/core/src/utils/comment-utils.ts
export function ensureHtmlClosure(line: string): string;
export function appendHtmlClosure(line: string): string;
export function stripHtmlClosure(line: string): string;
```

---

## Migration Strategy

### Phase 1: Foundation (Low Risk)

1. Create shared utilities (`file-utils.ts`, `record-utils.ts`, etc.)
2. Update existing files to import from shared utilities
3. Run full test suite after each change

### Phase 2: High Priority Splits

3. Split `remove.ts` into `removal/` subdirectory
4. Split `edit.ts` into `edit/` subdirectory
5. Run full test suite after each split

### Phase 3: Medium Priority Splits

6. Split `config.ts` into `config/` subdirectory
7. Split `insert.ts` into `insertion/` subdirectory

### Phase 4: Low Priority (Optional)

8. Split CLI `index.ts` into `handlers/` structure
9. Split `modify.ts` into `modify/` subdirectory
10. Split `format.ts` (only if it continues growing)

---

## Testing Strategy

After each split:

1. Run `bun test <package>` to verify no regressions
2. Check exports in `index.ts` are maintained
3. Verify CLI still works: `bun run packages/cli/src/index.ts find .`
4. Run `bun check:all` for type checking

---

## When to Execute

**Not blocking for v1-rc.** Execute when:

- Adding significant new functionality to a large file
- Multiple developers need to work on the same file
- Test times become slow due to large file parsing
- Navigation within IDE becomes cumbersome

**Prioritize correctness (P0) and contracts (P1) before architecture (P4).**
