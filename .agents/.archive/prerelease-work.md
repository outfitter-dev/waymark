<!-- tldr ::: comprehensive specification for v1.0.0-beta.1 prerelease work items -->

# Prerelease Work Specification

**Target Release**: v1.0.0-beta.1
**Branch**: `gt/v1.0.0-beta.1`
**Status**: Pre-release quality assurance and hardening
**Created**: 2025-10-07

## Executive Summary

Following a comprehensive code review, we have identified 7 discrete work items that must be completed before tagging v1.0.0-beta.1. All tests currently pass (191 total), and the architecture is sound. This document specifies the remaining work to ensure production readiness.

**Total Estimated Time**: ~2.5 hours
**Priority**: All items are release blockers or high-priority improvements

## Work Items Overview

| # | Item | Type | Priority | Est. Time | Agent |
|---|------|------|----------|-----------|-------|
| 1 | Package READMEs | Documentation | 🔴 Blocker | 30min | senior-engineer |
| 2 | Bun.hash.wyhash() | Performance | 🟡 High | 15min | senior-engineer |
| 3 | Zod Validation | Type Safety | 🟡 High | 45min | type-safety-enforcer |
| 4 | SQLite Path Validation | Security | 🟡 High | 20min | security-auditor |
| 5 | Pino Logging | Observability | 🟢 Med | 30min | senior-engineer |
| 6 | Signal Terminology | Documentation | 🔵 Low | 15min | senior-engineer |
| 7 | Final Integration Test | QA | 🔴 Blocker | 15min | systematic-debugger |

---

## 1. Package-Level READMEs

### Status: 🔴 BLOCKER

### Rationale

Package consumers (npm, GitHub) need discoverable documentation for each package. Without READMEs, users exploring `@waymarks/core` or `@waymarks/grammar` on npm will have no guidance on installation, usage, or API surface.

### Scope

Create minimal but complete READMEs for:

- `packages/grammar/README.md`
- `packages/core/README.md`
- `packages/cli/README.md`
- `apps/mcp/README.md` (mark as experimental)

### Template Structure

```markdown
# @waymarks/[package]

[One-sentence description]

## Installation

\`\`\`bash
bun add @waymarks/[package]
\`\`\`

## Key Exports

- `export1()` - Description
- `export2` - Description
- `ExportedType` - Description

## Example

\`\`\`typescript
import { mainExport } from '@waymarks/[package]';

// Minimal working example
\`\`\`

## Documentation

See [main README](../../README.md) for comprehensive documentation.

## License

MIT
```

### Acceptance Criteria

- [ ] All four packages have READMEs
- [ ] Each README includes installation, key exports, and example
- [ ] MCP README includes "⚠️ Experimental" disclaimer
- [ ] READMEs are committed and pushed

### Agent Assignment

**senior-engineer** with `--no-code` flag for documentation writing

---

## 2. Replace SHA-256 with Bun.hash.wyhash()

### Status: 🟡 HIGH PRIORITY

### Rationale

Current ID generation uses SHA-256 cryptographic hashing, which is 10-20x slower than necessary. IDs don't require cryptographic security—just collision resistance. Switching to Bun's built-in `wyhash` provides:

- 10-20x faster performance
- Zero dependencies (built into Bun)
- Sufficient collision resistance for short IDs

### Scope

**File**: `packages/core/src/ids.ts`
**Function**: `WaymarkIdManager.makeId()`

### Current Implementation

```typescript
private makeId(input: string, attempt: number): string {
  const hash = createHash("sha256")
    .update(input)
    .update(attempt.toString())
    .digest("hex");

  const sliceLength = Math.max(MIN_ID_SLICE_LENGTH, this.config.length);
  const base36 = BigInt("0x" + hash.slice(0, 16))
    .toString(36)
    .padStart(sliceLength, "0")
    .slice(0, sliceLength);

  return `wm:${base36}`;
}
```

### New Implementation

```typescript
private makeId(input: string, attempt: number): string {
  // Use Bun's built-in wyhash (10-20x faster than SHA-256)
  const combined = `${input}|${attempt}`;
  const hash = Bun.hash.wyhash(combined);

  const sliceLength = Math.max(MIN_ID_SLICE_LENGTH, this.config.length);
  const base36 = hash
    .toString(36)
    .padStart(sliceLength, "0")
    .slice(0, sliceLength);

  return `wm:${base36}`;
}
```

### Changes Required

1. Remove `import { createHash } from "node:crypto";`
2. Update `makeId()` method to use `Bun.hash.wyhash()`
3. Update any related tests if they assert on specific hash values
4. Add comment explaining hash choice

### Acceptance Criteria

- [ ] `makeId()` uses `Bun.hash.wyhash()` instead of SHA-256
- [ ] All existing tests pass
- [ ] ID format remains `wm:[base36]` with correct length
- [ ] Comment added explaining hash choice
- [ ] Performance improvement verified (optional: add benchmark)

### Agent Assignment

**senior-engineer** (straightforward code change)

---

## 3. Add Zod Schema Validation for JSON Inputs

### Status: 🟡 HIGH PRIORITY

### Rationale

Current JSON parsing in `insert` and `remove` commands uses `as unknown` casts without validation. This leads to:

- Runtime crashes with unclear error messages
- No compile-time safety for JSON structure
- Poor user experience when JSON is malformed

Zod is already a dependency in the MCP package, so we can use it throughout.

### Scope

**Files to update**:

- `packages/core/src/insert.ts` - `InsertionSpec` type
- `packages/core/src/remove.ts` - `RemovalCriteria` type
- `packages/cli/src/commands/insert.ts` - `loadSpecsFromSource()`
- `packages/cli/src/commands/remove.ts` - `loadCriteriaFromSource()`

### Implementation Plan

#### Step 1: Add Zod to dependencies

```bash
cd packages/core && bun add zod
cd packages/cli && bun add zod
```

#### Step 2: Define schemas in core

```typescript
// packages/core/src/insert.ts
import { z } from 'zod';

export const InsertionSpecSchema = z.object({
  file: z.string().min(1),
  line: z.number().int().positive(),
  anchor: z.enum(['line', 'before', 'after', 'top']).optional(),
  type: z.string().min(1),
  content: z.string(),
  signals: z.object({
    raised: z.boolean().optional(),
    starred: z.boolean().optional(),
  }).optional(),
  properties: z.record(z.string()).optional(),
  continuations: z.array(z.string()).optional(),
});

export type InsertionSpec = z.infer<typeof InsertionSpecSchema>;
```

```typescript
// packages/core/src/remove.ts
import { z } from 'zod';

export const RemovalCriteriaSchema = z.object({
  type: z.string().optional(),
  contains: z.string().optional(),
  tag: z.string().optional(),
  mention: z.string().optional(),
});

export type RemovalCriteria = z.infer<typeof RemovalCriteriaSchema>;
```

#### Step 3: Update CLI command parsers

```typescript
// packages/cli/src/commands/insert.ts
async function loadSpecsFromSource(path: string): Promise<InsertionSpec[]> {
  const source = path === '-'
    ? await readFromStdin()
    : await readFile(path, 'utf8');

  const parsed = JSON.parse(source);

  if (Array.isArray(parsed)) {
    return z.array(InsertionSpecSchema).parse(parsed);
  }
  if (typeof parsed === 'object' && parsed !== null) {
    return [InsertionSpecSchema.parse(parsed)];
  }

  throw new Error('Invalid JSON: expected InsertionSpec or InsertionSpec[]');
}
```

Similar for `remove.ts`.

#### Step 4: Update error handling

Zod throws `ZodError` with detailed validation messages. Add try-catch:

```typescript
try {
  const specs = await loadSpecsFromSource(fromPath);
  // ... process specs
} catch (error) {
  if (error instanceof z.ZodError) {
    logger.error('JSON validation failed:', error.format());
    process.exit(1);
  }
  throw error;
}
```

### Acceptance Criteria

- [ ] Zod added as dependency to `core` and `cli` packages
- [ ] Schema definitions exported from core
- [ ] All JSON parsing uses Zod validation
- [ ] Tests added for invalid JSON structures
- [ ] Error messages are clear and actionable
- [ ] All existing tests pass

### Agent Assignment

**type-safety-enforcer** (specializes in type safety and validation)

---

## 4. Add SQLite Path Validation in WaymarkCache

### Status: 🟡 HIGH PRIORITY

### Rationale

`WaymarkCache` accepts arbitrary `dbPath` without validation. While config files are trusted input, defense-in-depth requires validating that paths are within expected directories. This prevents:

- Path traversal attacks (`../../etc/passwd`)
- Writing to sensitive system directories
- Accidental cache creation in wrong locations

### Scope

**File**: `packages/core/src/cache/index.ts`
**Function**: `WaymarkCache.ensureCacheDirectory()`

### Current Implementation

```typescript
private ensureCacheDirectory(): void {
  if (this.dbPath === ":memory:" || this.dbPath.startsWith("file:")) {
    return;
  }

  const dir = dirname(this.dbPath);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
}
```

### New Implementation

```typescript
private ensureCacheDirectory(): void {
  // Allow special SQLite URIs
  if (this.dbPath === ":memory:" || this.dbPath.startsWith("file:")) {
    return;
  }

  // Resolve to absolute path
  const resolved = resolve(this.dbPath);

  // Determine allowed cache directory
  const cacheHome = process.env.XDG_CACHE_HOME || join(homedir(), ".cache");
  const allowedParent = resolve(cacheHome, "waymark");

  // Validate path is within allowed directory
  if (!resolved.startsWith(allowedParent)) {
    throw new Error(
      `Cache path must be within ${allowedParent}, got: ${resolved}\n` +
      `This is a security restriction to prevent writing outside cache directories.`
    );
  }

  // Create directory if needed
  const dir = dirname(resolved);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
}
```

### Additional Changes

Add import: `import { resolve } from "node:path";`

### Testing

Add test cases:

```typescript
test('WaymarkCache rejects path traversal attempts', () => {
  expect(() => {
    new WaymarkCache({ dbPath: '../../etc/waymark.db' });
  }).toThrow(/must be within/);
});

test('WaymarkCache rejects absolute paths outside cache', () => {
  expect(() => {
    new WaymarkCache({ dbPath: '/tmp/malicious.db' });
  }).toThrow(/must be within/);
});

test('WaymarkCache allows valid cache paths', () => {
  const cacheDir = process.env.XDG_CACHE_HOME || join(homedir(), '.cache');
  const validPath = join(cacheDir, 'waymark', 'test.db');

  expect(() => {
    const cache = new WaymarkCache({ dbPath: validPath });
    cache[Symbol.dispose]();
  }).not.toThrow();
});
```

### Acceptance Criteria

- [ ] Path validation added to `ensureCacheDirectory()`
- [ ] Error message is clear and explains security rationale
- [ ] Special URIs (`:memory:`, `file:`) still work
- [ ] Tests added for invalid paths
- [ ] Tests verify valid paths still work
- [ ] All existing tests pass

### Agent Assignment

**security-auditor** (specializes in security concerns)

---

## 5. Add Structured Logging with Pino to Core Operations

### Status: 🟢 MEDIUM PRIORITY

### Rationale

Core mutation operations (`insert`, `remove`, `modify`) currently have no logging. When users report issues, debugging requires re-running with manual print statements. Adding optional structured logging enables:

- Debug visibility for troubleshooting
- Audit trails for automation
- Performance monitoring
- Better error context

Pino is already configured in the CLI package; we just need to wire it through to core.

### Scope

**Files to update**:

- `packages/core/src/insert.ts`
- `packages/core/src/remove.ts`
- `packages/core/src/modify.ts` (if exists)
- `packages/cli/src/commands/insert.ts`
- `packages/cli/src/commands/remove.ts`
- `packages/cli/src/commands/modify.ts`

### Implementation Plan

#### Step 1: Define logger interface in core

```typescript
// packages/core/src/types.ts (or create logger.ts)
export type CoreLogger = {
  debug: (msg: string, meta?: Record<string, unknown>) => void;
  info: (msg: string, meta?: Record<string, unknown>) => void;
  warn: (msg: string, meta?: Record<string, unknown>) => void;
  error: (msg: string, meta?: Record<string, unknown>) => void;
};

export type CoreLoggerOptions = {
  logger?: CoreLogger;
};
```

#### Step 2: Update options types

```typescript
// packages/core/src/insert.ts
export type InsertOptions = {
  write?: boolean;
  format?: boolean;
  config?: WaymarkConfig;
  idManager?: WaymarkIdManager;
  logger?: CoreLogger;  // ← Add this
};
```

Similar for `remove.ts` and `modify.ts`.

#### Step 3: Add logging calls

```typescript
// Example in insert.ts
async function processFileGroup(
  file: string,
  specs: InsertionSpec[],
  options: InsertOptions
): Promise<InsertionResult[]> {
  options.logger?.debug('Processing file group', {
    file,
    specCount: specs.length
  });

  const lines = (await readFile(file, 'utf8')).split('\n');
  options.logger?.debug('Read file', {
    file,
    lineCount: lines.length
  });

  // ... rest of logic with strategic logger calls

  if (options.write) {
    options.logger?.info('Writing waymarks to file', {
      file,
      insertedCount: results.filter(r => r.success).length
    });
  } else {
    options.logger?.debug('Dry-run mode, skipping write', { file });
  }

  return results;
}
```

#### Step 4: Wire logger from CLI

```typescript
// packages/cli/src/commands/insert.ts
import { logger } from '../utils/logger.ts';

async function runInsertCommand(...) {
  const results = await insertWaymarks(specs, {
    write: args.write,
    config,
    idManager,
    logger: {
      debug: (msg, meta) => logger.debug(meta, msg),
      info: (msg, meta) => logger.info(meta, msg),
      warn: (msg, meta) => logger.warn(meta, msg),
      error: (msg, meta) => logger.error(meta, msg),
    },
  });
}
```

### Logging Guidelines

- **debug**: Internal state changes, file reads, iteration progress
- **info**: User-visible actions (writes, successful operations)
- **warn**: Recoverable issues, fallback behavior
- **error**: Failures, validation errors

### Acceptance Criteria

- [ ] Logger interface defined in core
- [ ] All core mutation functions accept optional logger
- [ ] Strategic logging added to key operations
- [ ] CLI wires Pino logger to core functions
- [ ] `--debug` flag enables debug-level logs
- [ ] No performance regression (logger is optional, cheap when not used)
- [ ] All existing tests pass

### Agent Assignment

**senior-engineer** (straightforward infrastructure work)

---

## 6. Standardize Signal Terminology

### Status: 🔵 LOW PRIORITY

### Rationale

Code review identified inconsistent terminology for signals:

- `^` described as "raised/in-progress" or just "raised"
- `*` described as "important" or "starred"

Standardize on simpler, consistent terms:

- `^` = **raised** (marks WIP/branch-scoped work)
- `*` = **starred** (marks important/high-priority)

### Scope

**Files to update**:

- `PRD.md` - Signal definitions section
- `README.md` - Examples and CLI usage
- `docs/waymark/SPEC.md` - Grammar specification
- `.waymark/rules/WAYMARKS.md` - Usage guidelines
- `packages/grammar/src/constants.ts` - Comments/descriptions

### Search and Replace Pattern

```bash
# Find inconsistencies
rg "raised/in-progress|in-progress" docs/ *.md
rg "important.*\*|priority.*\*" --type md

# Replace with standardized terms
# Manual review recommended to preserve context
```

### Standardized Language

- **Raised (`^`)**: "Marks waymarks as raised (work-in-progress, branch-scoped)"
- **Starred (`*`)**: "Marks waymarks as starred (important, high-priority)"
- **Combined (`^*`)**: "Raised and starred waymark"

### Acceptance Criteria

- [ ] All documentation uses "raised" for `^` signal
- [ ] All documentation uses "starred" for `*` signal
- [ ] Grammar constants updated with clear descriptions
- [ ] Examples use consistent terminology
- [ ] No contradictory signal descriptions remain

### Agent Assignment

**senior-engineer** with `--no-code` (documentation-only changes)

---

## 7. Final Integration Test

### Status: 🔴 BLOCKER (Post-Implementation)

### Rationale

After all changes are complete, perform end-to-end integration test to verify:

- All components work together
- No regressions introduced
- Real-world workflows function correctly

### Scope

Full CLI workflow testing with real files:

1. Initialize waymark config
2. Insert waymarks with IDs
3. Scan and find operations
4. Modify existing waymarks
5. Remove waymarks
6. Map and graph generation
7. Format and lint operations

### Test Script

```bash
#!/usr/bin/env bash
# .agents/scripts/integration-test.sh

set -euo pipefail

echo "=== Waymark v1.0.0-beta.1 Integration Test ==="

# Setup test directory
TEST_DIR=$(mktemp -d)
cd "$TEST_DIR"

echo "1. Initialize project"
wm init --format toml --preset minimal --force

echo "2. Create test file"
cat > sample.ts <<'EOF'
// tldr ::: sample TypeScript file for testing
export function greet(name: string): string {
  return `Hello, ${name}!`;
}
EOF

echo "3. Insert waymark"
wm insert sample.ts:3 todo "add unit tests" --write

echo "4. Scan waymarks"
wm sample.ts --json

echo "5. Map generation"
wm --map

echo "6. Modify waymark (add star)"
wm modify sample.ts:3 --star --write

echo "7. Remove waymark"
wm remove sample.ts:3 --write

echo "8. Format check"
wm format sample.ts

echo "9. Lint check"
wm lint sample.ts

echo "=== All tests passed! ==="
cd -
rm -rf "$TEST_DIR"
```

### Acceptance Criteria

- [ ] Integration test script created
- [ ] All workflow steps complete successfully
- [ ] No crashes or unclear error messages
- [ ] Output is clean and professional
- [ ] Performance is acceptable (<1s for basic operations)

### Agent Assignment

**systematic-debugger** (specializes in testing and debugging)

---

## Coordination & Execution Plan

### Phase 1: Critical Path (Parallel)

Execute in parallel where possible:

- **Task 1** (READMEs) - senior-engineer
- **Task 4** (Path validation) - security-auditor
- **Task 6** (Terminology) - senior-engineer

### Phase 2: Core Changes (Sequential)

Must complete before integration test:

- **Task 2** (Bun.hash) - senior-engineer
- **Task 3** (Zod) - type-safety-enforcer
- **Task 5** (Pino) - senior-engineer

### Phase 3: Verification

After all changes:

- **Task 7** (Integration test) - systematic-debugger

### Quality Gates

After each task:

1. Run `bun run check:all` (lint, typecheck, test)
2. Verify all tests pass
3. Commit with conventional commit message
4. Update this document with completion status

### Final Checklist

- [ ] All 7 tasks completed
- [ ] All tests passing (expect 191+ tests)
- [ ] Zero lint/type errors
- [ ] Integration test passes
- [ ] CHANGELOG.md updated
- [ ] Git branch clean (all work committed)
- [ ] Ready to tag v1.0.0-beta.1

---

## Success Metrics

**Before**: 191 tests, 0 errors, 1 blocker, 3 high-priority issues
**After**: 210+ tests, 0 errors, production-ready for beta release

**Key Improvements**:

- 📚 Complete package documentation
- ⚡ 10-20x faster ID generation
- 🛡️ Robust input validation with Zod
- 🔒 Security-hardened cache paths
- 🔍 Debug logging for troubleshooting
- 📖 Consistent terminology across docs

---

## Notes

- Keep `--write` flag behavior (safe by default)
- MCP package marked as experimental in README
- Focus on beta readiness, not perfection
- Document any deferred improvements for v1.0 final
- Maintain backwards compatibility where possible

---

**Last Updated**: 2025-10-07
**Next Review**: After Task 7 completion
