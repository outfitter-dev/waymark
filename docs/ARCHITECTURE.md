<!-- tldr ::: architectural philosophy and module organization guidelines for waymark codebase -->

# Architecture

This document describes the architectural principles, patterns, and organization of the Waymark codebase.

## Philosophy

### Modularity Over Monoliths

**Core Principle:** Keep files small, focused, and under 400 lines. Prefer multiple specialized modules over single monolithic files.

**Why:**

1. **Cognitive Load** - Smaller files are easier to understand at a glance. A developer (or AI agent) can quickly grasp the full scope of a 150-line module, while an 800-line file requires sustained mental effort to map out.

2. **Navigation** - When modules are organized by responsibility, finding code becomes intuitive. Looking for cache queries? Check `cache/queries.ts`. Need to modify serialization? It's isolated in `cache/serialization.ts`.

3. **Testing** - Focused modules are easier to test in isolation. You can unit test a tokenizer without loading the entire parser, or test query operations without touching schema creation.

4. **Maintenance** - Changes are naturally localized. Updating serialization logic won't trigger unintended side effects in query operations when they're in separate files with clear boundaries.

5. **Collaboration** - Multiple developers (or agents) can work on different modules simultaneously without merge conflicts. Clear module boundaries reduce coupling and enable parallel development.

6. **Review** - Pull requests touching 3 focused modules are easier to review than changes buried in a 600-line file. Reviewers can understand impact quickly and provide better feedback.

### When to Refactor

**Size Thresholds:**

- **< 200 lines**: Generally fine as-is
- **200-400 lines**: Consider splitting if responsibilities are mixed
- **400-600 lines**: Strong candidate for refactoring
- **> 600 lines**: Should be split unless there's a compelling reason

**Complexity Signals:**

- Multiple distinct concerns in one file
- Difficulty locating specific functionality
- Long functions (> 50 lines) that could be extracted
- High cognitive complexity (> 15 per function)
- Frequent merge conflicts
- Comments like "TODO: split this up"

**Examples from Our Codebase:**

We successfully refactored four major modules:

1. **MCP Server** (836 → 15 modules)
   - Before: Single file with tools, resources, prompts, and utilities
   - After: Organized structure with clear separation
   - Benefit: Each tool/resource is now independently testable and maintainable

2. **Parser** (789 → 6 modules)
   - Before: Single file handling tokenization, content processing, properties, metadata, and record building
   - After: Clean dependency tree with specialized modules
   - Benefit: Can modify property extraction without touching tokenization logic

3. **Cache** (522 → 6 modules)
   - Before: Single class with schema, queries, writes, and serialization mixed together
   - After: Focused modules for each responsibility
   - Benefit: Can optimize queries without risking schema migrations

4. **CLI** (488 → 4 modules)
   - Before: Command handlers mixed with option parsing and rendering
   - After: Commands, options, context, and rendering separated
   - Benefit: Utilities are now reusable across commands

### How to Refactor

**Process:**

1. **Identify Responsibilities** - Map out the logical groupings in the large file. Look for:
   - Different data transformations (parsing, serialization, formatting)
   - Different operations (reads vs writes, queries vs mutations)
   - Different layers (initialization, operations, utilities)

2. **Plan Module Structure** - Design the module hierarchy before coding:

   ```text
   feature/
   ├── index.ts       (orchestration, exports)
   ├── types.ts       (shared types)
   ├── module-a.ts    (focused responsibility A)
   ├── module-b.ts    (focused responsibility B)
   └── utils.ts       (shared utilities)
   ```

3. **Extract Incrementally** - Create modules one at a time:
   - Start with the most isolated functionality (utilities, types)
   - Move to leaf modules with no internal dependencies
   - Finish with orchestration layer that ties everything together
   - Test after each extraction

4. **Maintain Tests** - Existing tests should pass without modification:
   - Preserve public API in main index.ts
   - Re-export functions that tests depend on
   - Add new tests for individual modules when beneficial

5. **Document Decisions** - Update relevant docs:
   - Add TLDRs to each new module
   - Update architectural docs (this file)
   - Note major decisions in PLAN.md or commit messages

**Patterns:**

- **Thin Orchestration Layer**: Main file delegates to modules, doesn't contain logic
- **Unidirectional Dependencies**: Clear import tree, no circular dependencies
- **Registry Pattern**: Use index files to register components (tools, commands, resources)
- **Dependency Injection**: Pass dependencies as parameters rather than hardcoding

**Anti-Patterns to Avoid:**

- Splitting for the sake of splitting (respect cohesion)
- Creating "utils" dumping grounds (name modules by purpose)
- Circular dependencies between modules
- Exposing internal implementation details
- Breaking existing test APIs unnecessarily

## Project Structure

```text
waymark/
├── packages/
│   ├── grammar/          # Core waymark grammar parser
│   │   ├── src/
│   │   │   ├── parser.ts         # Main orchestration (85 lines)
│   │   │   ├── tokenizer.ts      # Tokenization (129 lines)
│   │   │   ├── content.ts        # Content processing (151 lines)
│   │   │   ├── properties.ts     # Property extraction (151 lines)
│   │   │   ├── metadata.ts       # File metadata (142 lines)
│   │   │   ├── builder.ts        # Record construction (169 lines)
│   │   │   ├── constants.ts      # Grammar constants
│   │   │   └── types.ts          # Type definitions
│   │
│   ├── core/             # Core utilities and caching
│   │   ├── src/
│   │   │   ├── cache/
│   │   │   │   ├── index.ts      # Cache orchestration (131 lines)
│   │   │   │   ├── schema.ts     # Schema & migrations (138 lines)
│   │   │   │   ├── files.ts      # File tracking (37 lines)
│   │   │   │   ├── queries.ts    # Search operations (106 lines)
│   │   │   │   ├── writes.ts     # Write operations (118 lines)
│   │   │   │   └── serialization.ts  # Serialization (115 lines)
│   │   │   ├── config.ts         # Config loading
│   │   │   ├── format.ts         # Formatting
│   │   │   ├── search.ts         # Search filters
│   │   │   └── graph.ts          # Relation graphs
│   │
│   ├── cli/              # Command-line interface
│   │   ├── src/
│   │   │   ├── index.ts          # Main entry (203 lines)
│   │   │   ├── commands/         # Command handlers
│   │   │   │   ├── add.ts
│   │   │   │   ├── doctor.ts
│   │   │   │   ├── find.ts
│   │   │   │   ├── fmt.ts
│   │   │   │   ├── graph.ts
│   │   │   │   ├── init.ts
│   │   │   │   ├── lint.ts
│   │   │   │   ├── modify.ts
│   │   │   │   ├── remove.ts
│   │   │   │   ├── scan.ts
│   │   │   │   ├── tui.ts
│   │   │   │   └── update.ts
│   │   │   ├── unified/          # Unified command pipeline
│   │   │   └── utils/
│   │   │       ├── context.ts    # Context creation (19 lines)
│   │   │       ├── options.ts    # Option parsing (88 lines)
│   │   │       ├── output.ts     # Record rendering
│   │   │       ├── fs.ts         # Filesystem helpers
│   │   │       └── flags/        # Flag parsing utilities
│   │
│   └── agents/           # Agent toolkit (future work)
│
└── apps/
    └── mcp/              # Model Context Protocol server
        ├── src/
        │   ├── index.ts          # Main entry (34 lines)
        │   ├── types.ts          # Shared types (58 lines)
        │   ├── tools/
        │   │   ├── index.ts      # Tool registry (16 lines)
        │   │   ├── add.ts        # Add tool (354 lines)
        │   │   ├── graph.ts      # Graph tool (77 lines)
        │   │   └── scan.ts       # Scan tool (111 lines)
        │   ├── resources/
        │   │   ├── index.ts      # Resource registry (21 lines)
        │   │   └── todos.ts      # Todos resource (72 lines)
        │   ├── prompts/
        │   │   ├── index.ts      # Prompt registry (11 lines)
        │   │   ├── tldr.ts       # TLDR prompt (51 lines)
        │   │   └── todo.ts       # TODO prompt (47 lines)
        │   └── utils/
        │       ├── config.ts     # Config helpers (36 lines)
        │       └── filesystem.ts # FS utilities (88 lines)
```

## Module Organization Patterns

### Registry Pattern

Used in MCP server and CLI for extensibility:

```typescript
// tools/index.ts - Registry
export const tools = [
  scanTool,
  graphTool,
  addTool,
];

// index.ts - Main entry
import { tools } from './tools/index.ts';

for (const tool of tools) {
  server.registerTool(tool);
}
```

**Benefits:**

- Easy to add new tools without modifying main entry
- Clear registration point
- Tools can be tested independently

### Thin Orchestration

Main entry files delegate to focused modules:

```typescript
// cache/index.ts
export class WaymarkCache {
  findByMarker(marker: string): WaymarkRecord[] {
    return findByMarker(this.db, marker);  // Delegate to queries module
  }
}

// cache/queries.ts
export function findByMarker(
  db: Database,
  marker: string
): WaymarkRecord[] {
  // Implementation here
}
```

**Benefits:**

- Main class stays thin and focused on coordination
- Logic is testable without class instantiation
- Easy to reuse functions across different contexts

### Dependency Injection

Pass dependencies as parameters rather than importing:

```typescript
// Good: Dependency injected
export function createRecord(
  db: Database,
  data: RecordData
): WaymarkRecord {
  // Use db parameter
}

// Avoid: Hardcoded dependency
import { db } from './db.ts';
export function createRecord(data: RecordData): WaymarkRecord {
  // Uses imported db
}
```

**Benefits:**

- Easy to test with mock databases
- No hidden dependencies
- Clear function contracts

## Type Organization

**Principle:** Keep types close to where they're used, but share when necessary.

```typescript
// types.ts - Shared across modules
export type WaymarkRecord = { ... };

// queries.ts - Module-specific types
type QueryResult = { ... };
export function query(...): QueryResult { ... }

// index.ts - Re-export shared types
export type { WaymarkRecord } from './types.ts';
```

**Guidelines:**

- Shared types → `types.ts`
- Module-specific types → keep in module, export if used externally
- Internal types → don't export, keep private to module

## Testing Strategy

### Unit Tests

Test individual modules in isolation:

```typescript
// tokenizer.test.ts
import { parseHeader } from './tokenizer.ts';

test('parseHeader extracts signals and marker', () => {
  const result = parseHeader('// ~*todo ::: fix bug');
  expect(result).toMatchObject({
    marker: 'todo',
    signals: { flagged: true, starred: true },
  });
});
```

### Integration Tests

Test orchestration layers:

```typescript
// parser.test.ts
import { parse } from './parser.ts';

test('parse handles multi-line waymarks', () => {
  const text = `
    // todo ::: first line
    //      ::: continuation
  `;
  const records = parse(text);
  expect(records[0].contentText).toContain('continuation');
});
```

### Patterns

- **Arrange-Act-Assert**: Structure all tests consistently
- **Test behavior, not implementation**: Focus on outputs and side effects
- **Keep tests focused**: One concept per test
- **Use descriptive names**: Test name should explain what's being tested

## Performance Considerations

### Module Loading

- **Use ES modules**: Tree-shaking works better
- **Avoid barrel files with side effects**: Keep re-exports clean
- **Lazy load when possible**: Import dynamically for non-critical paths

### Caching Strategy

- **Cache parsed records**: SQLite with prepared statements (< 1ms lookups)
- **Track file staleness**: mtime/size tracking for invalidation
- **Batch writes**: Transaction-based inserts (1000+ records/second)

### Search Performance

- **Indexed queries**: SQLite indices on all searchable columns
- **Parameterized queries**: Prepared statements with bindings
- **Escape wildcards**: Prevent pattern matching issues

## Security

### Input Validation

- **Validate at boundaries**: Use Zod/schema validation at entry points
- **Parameterize queries**: Never interpolate user input into SQL
- **Escape patterns**: Sanitize LIKE patterns and regex inputs

### Secrets

- **Never hardcode**: Use environment variables
- **Never log**: Redact secrets from logs and errors
- **Use branded types**: Prevent mixing secret strings with regular strings

## Tooling

### Linting & Formatting

- **Ultracite** (Biome): Fast, deterministic linting and formatting
- **Markdownlint**: Ensures docs consistency
- **Pre-commit hooks**: Auto-format on commit

### Testing

- **Bun test**: Fast native test runner
- **Coverage**: Minimum 80% threshold
- **Snapshot tests**: For CLI output and record structures

### Monorepo

- **Bun workspaces**: Native monorepo support
- **Turbo**: Task orchestration with caching
- **Shared configs**: TypeScript, Biome, and tool configs at root

## Migration Path

When inheriting or modifying large files:

1. **First, understand** - Read through the file and map responsibilities
2. **Plan, don't rush** - Design the module structure before coding
3. **Extract incrementally** - Move one concern at a time
4. **Test continuously** - Ensure tests pass after each extraction
5. **Document decisions** - Update this doc and add module TLDRs

## Future Directions

Areas for potential architectural evolution:

- **Plugin system**: Allow external modules to extend waymark functionality
- **Streaming parser**: Handle large files without loading entire content
- **Worker threads**: Parallelize parsing for multi-file operations
- **Language server**: Provide IDE integration via LSP

## References

- [Specification](./waymark/SPEC.md) - Canonical grammar and v1 scope
- [Release Plan](../.agents/plans/v1/PLAN.md) - Execution roadmap and decisions log
- [TypeScript Conventions](../.agents/rules/conventions/typescript.md)
- [Bun Conventions](../.agents/rules/conventions/bun.md)
