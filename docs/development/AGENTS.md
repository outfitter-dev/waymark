<!-- tldr ::: guide to agent-assisted development practices and tooling choices for waymark -->

# Agent-Assisted Development

This document describes how we use AI agents to build and maintain the Waymark project, the tooling choices that enable effective agent collaboration, and the principles that guide our development process.

## Philosophy

### Agents as Collaborative Tools

We treat AI agents as capable development partners, not just code generators. Agents excel at:

- **Refactoring**: Breaking down monolithic files into focused modules
- **Testing**: Writing comprehensive test suites with good coverage
- **Documentation**: Keeping docs synchronized with code changes
- **Pattern Application**: Applying established patterns consistently across the codebase
- **Code Review**: Identifying issues, suggesting improvements, and enforcing standards

The key is providing agents with clear context, explicit rules, and well-structured codebases.

### Boundaries Enable Autonomy

Small, focused modules with clear responsibilities are easier for agents to understand and modify. When we refactored our large files (MCP server: 836 lines, parser: 789 lines, cache: 522 lines, CLI: 488 lines) into focused modules averaging ~100-150 lines each, agents could:

- Understand entire modules in their context window
- Make changes confidently without unintended side effects
- Test modifications in isolation
- Navigate the codebase by logical grouping

This isn't just good for agents—it's good engineering practice that makes the codebase more maintainable for everyone.

### Quality Gates Are Non-Negotiable

Agents work best with immediate, deterministic feedback. Our tooling stack provides:

- **Strict TypeScript**: Illegal states are unrepresentable, agents get compile-time errors
- **Fast linting**: Ultracite (Biome) catches issues in milliseconds
- **Comprehensive tests**: 98 tests provide rapid validation
- **Pre-commit hooks**: Automatic formatting prevents style drift
- **Pre-push hooks**: Full quality pipeline before code leaves local environment

When agents (or humans) make changes, they know within seconds whether those changes are valid.

## Tooling Choices

### Strict TypeScript

**Why**: Type safety eliminates entire classes of errors at compile time.

```typescript
// Good: Compiler catches misuse
type UserId = string & { __brand: 'UserId' };
function getUser(id: UserId): User { ... }

// Bad: Any string passes
function getUser(id: string): User { ... }
```

**Configuration:**

- `strict: true` in tsconfig.json
- `noUncheckedIndexedAccess: true` - array access is properly typed
- `exactOptionalPropertyTypes: true` - prevents `undefined` where not expected

**Benefits for Agents:**

- Clear contracts via types
- Immediate feedback on mistakes
- Self-documenting APIs
- Reduces need for runtime validation

### Ultracite (Biome)

**Why**: Deterministic, fast, single-tool solution for linting and formatting.

**Features:**

- Sub-second linting across entire codebase
- Auto-fixes for common issues
- Consistent style without configuration debates
- Works identically for agents and humans

**Usage:**

```bash
bun run format  # Format all files
bun run lint    # Check all packages
```

**Benefits for Agents:**

- No ambiguity about style
- Auto-fix resolves most issues automatically
- Fast feedback loop during development

### Pre-Commit Hooks (Lefthook)

**Why**: Prevent issues from entering the repository.

**Current Configuration:**

```yaml
pre-commit:
  commands:
    format:
      run: bun run format
```

**Philosophy:**

- Only block on formatting (deterministic, auto-fixable)
- Keep commits fast to maintain flow

### Pre-Push Hooks

**Why**: Comprehensive quality checks before code reaches remote.

**Current Configuration:**

```yaml
pre-push:
  commands:
    quality-gates:
      run: bun run lint && bun run typecheck && bun run test
```

**Philosophy:**

- All tests must pass
- No type errors allowed
- Linting must be clean
- Catches issues before PR creation

### Bun Runtime

**Why**: Fast, modern JavaScript runtime with excellent TypeScript support.

**Features:**

- Native TypeScript execution (no transpilation needed)
- Fast package installation
- Built-in test runner
- SQLite, Redis, Postgres drivers included

**Benefits for Agents:**

- Single runtime for everything
- Fast iteration cycles
- Comprehensive standard library reduces dependencies

### Monorepo (Turbo + Bun Workspaces)

**Why**: Organize related packages while sharing configuration.

**Structure:**

```text
packages/
  grammar/      # Core parser (minimal, stable)
  core/         # Utilities and caching
  cli/          # Command-line interface
  agents/       # Agent toolkit (future)

apps/
  mcp/          # MCP server
```

**Benefits for Agents:**

- Clear package boundaries
- Shared dependencies and tooling
- Turborepo caching speeds up builds
- Easy to understand scope of changes

## Agent Rules Structure

### Directory Organization

```text
.agents/
├── rules/
│   ├── CORE.md                    # Agent identity and core behaviors
│   ├── IMPORTANT.md               # Quick reference to key rules
│   ├── ARCHITECTURE.md            # Architectural patterns
│   ├── DEVELOPMENT.md             # Development workflow
│   ├── MONOREPO.md                # Monorepo patterns
│   ├── MCP.md                     # MCP server guidelines
│   ├── conventions/
│   │   ├── typescript.md          # TypeScript rules ("Use X, not Y")
│   │   └── bun.md                 # Bun-specific patterns
│   └── (additional domain-specific rules)
└── .archive/                      # Superseded rules
```

### Rule Organization Philosophy

**CORE.md** - Agent identity, operating principles, and expertise areas

- Defines how the agent thinks and approaches problems
- Non-negotiable engineering standards
- Response patterns and communication style

**IMPORTANT.md** - Quick reference to critical rules

- Points to other rule files
- Prevents needing to load everything at once

**Domain Rules** - Specific guidance for areas

- ARCHITECTURE.md: Module organization, patterns, anti-patterns
- MONOREPO.md: Package structure, workspace patterns
- MCP.md: MCP server implementation guidance

**Convention Rules** - Language-specific patterns

- typescript.md: "Use X, not Y" format for clarity
- bun.md: Bun-specific APIs and patterns

### Writing Effective Rules

**Format: "Use X, not Y"**

```markdown
## Type Safety

- Use discriminated unions, not enums
- Use `unknown` at boundaries, not `any`
- Use `as const`, not widened literals
```

**Why This Works:**

- Direct, actionable guidance
- No ambiguity about preferred approach
- Easy for agents to pattern match
- Searchable by keyword

**Bad:**

```markdown
Consider using discriminated unions in some cases where enums might
be used, though enums are also okay in certain situations...
```

**Good:**

```markdown
Use discriminated unions, not enums or `const enum`.
```

## Working with Agents

### Tasking Pattern

For complex, multi-step work, use specialized agents:

```typescript
// Example: Refactoring large file
Task({
  subagent_type: "senior-engineer",
  description: "Refactor parser modularity",
  prompt: `
    Split packages/grammar/src/parser.ts (789 lines) into focused modules:

    1. Plan module structure
    2. Extract tokenizer (< 200 lines)
    3. Extract content processing (< 200 lines)
    4. Extract properties (< 200 lines)
    5. Keep main orchestration thin (< 150 lines)

    Requirements:
    - All tests must pass
    - No functionality changes
    - Follow patterns from previous refactorings

    Return: Module breakdown with line counts, test results
  `
})
```

**When to Use Agents:**

- Refactoring (clear structure, testable outcome)
- Test writing (well-defined success criteria)
- Pattern application (established conventions)
- Documentation updates (source of truth available)

**When to Be Careful:**

- Architecture decisions (requires human judgment)
- Complex trade-offs (need domain expertise)
- API design (impacts users, needs careful thought)

### Prompt Engineering for This Codebase

**Effective Prompts Include:**

1. **Clear Goal**: "Refactor X into Y modules"
2. **Constraints**: "Keep files under 400 lines, preserve all tests"
3. **Context**: "Follow pattern from MCP refactoring in commit abc123"
4. **Success Criteria**: "All tests pass, typecheck clean, modules under 200 lines"
5. **Examples**: Show existing code that follows the pattern

**Example:**

```text
Refactor packages/core/src/cache/index.ts (522 lines) into focused modules.

Structure:
- cache/index.ts (orchestration, < 150 lines)
- cache/schema.ts (table creation, < 150 lines)
- cache/queries.ts (find/search, < 150 lines)
- cache/writes.ts (insert/delete, < 150 lines)
- cache/serialization.ts (record serialization, < 100 lines)

Pattern: See apps/mcp/src/ refactoring (commit efbfd9b) for registry pattern.

Success Criteria:
- All 10 cache tests pass unchanged
- typecheck clean
- Each module under 150 lines
```

### Review Process

After agent work:

1. **Run Quality Gates**

   ```bash
   bun run check:all
   ```

2. **Review Changes**
   - Are modules logically organized?
   - Are tests still passing?
   - Is code more maintainable than before?

3. **Test Manually**
   - Run a few commands to validate behavior
   - Check edge cases the tests might miss

4. **Commit with Context**

   ```bash
   gt modify -acm "refactor: split cache into focused modules

   - Extracted schema, queries, writes, serialization
   - Main index.ts now orchestration only (131 lines)
   - All tests passing, no functionality changed"
   ```

## Development Patterns

### Incremental Refactoring

**Process:**

1. **Identify Large File** (> 400 lines)

   ```bash
   find packages apps -name "*.ts" | xargs wc -l | sort -rn | head -20
   ```

2. **Plan Module Structure**
   - Map responsibilities
   - Design dependency tree
   - Define clear boundaries

3. **Task Specialized Agent**
   - Provide context from similar refactorings
   - Set clear success criteria
   - Specify module targets

4. **Review and Commit**
   - Validate all tests pass
   - Check module organization
   - Document decisions

### Test-Driven Development

Write tests first, then implementation:

```typescript
// Step 1: Write failing test
test('parseHeader extracts signals and marker', () => {
  const result = parseHeader('// ^*todo ::: fix bug');
  expect(result.marker).toBe('todo');
  expect(result.signals.raised).toBe(true);
  expect(result.signals.important).toBe(true);
});

// Step 2: Implement minimum to pass
export function parseHeader(line: string): ParsedHeader {
  // Implementation...
}

// Step 3: Refactor with tests as safety net
```

**Why This Works for Agents:**

- Clear success criteria (make test pass)
- Immediate feedback (test output)
- Prevents over-engineering
- Documents expected behavior

### Module-First Thinking

When adding new features:

1. **Don't add to existing large files**
2. **Create new focused module**
3. **Import and use from existing code**

Example:

```typescript
// Bad: Adding validation to existing 400-line file
export function process(input: string): Result {
  // ... 50 lines of validation
  // ... 100 lines of processing
}

// Good: Extract validation to module
import { validate } from './validation.ts';

export function process(input: string): Result {
  const validated = validate(input);
  // ... focused processing logic
}
```

## Example: Modular Refactoring Case Study

We refactored 4 major files totaling 2,635 lines into 31 focused modules averaging 107 lines each:

**Before:**

- MCP Server: 836 lines (all tools, resources, prompts mixed)
- Parser: 789 lines (tokenization, parsing, properties, metadata mixed)
- Cache: 522 lines (schema, queries, writes, serialization mixed)
- CLI: 488 lines (commands, options, rendering mixed)

**After:**

- MCP Server: 15 modules, largest 354 lines
- Parser: 6 modules, largest 169 lines
- Cache: 6 modules, largest 138 lines
- CLI: 4 modules, largest 210 lines

**Process:**

1. Identified responsibilities in each large file
2. Planned module structure with clear boundaries
3. Tasked specialized agent with extraction
4. Reviewed output and validated tests
5. Committed with detailed context

**Result:**

- All 98 tests passing
- No functionality changed
- Easier to navigate and modify
- Better separation of concerns
- Ready for future extension

**Key Patterns Applied:**

- Thin orchestration layer (main file delegates)
- Registry pattern (tools, resources, prompts)
- Dependency injection (pass db as parameter)
- Clear module boundaries (no circular dependencies)

## Anti-Patterns

### Don't Do These With Agents

❌ **"Fix all the things"** - Too broad, agents lose focus
✅ **"Fix type errors in parser.ts"** - Specific, measurable

❌ **"Make the code better"** - Subjective, no criteria
✅ **"Reduce cognitive complexity in parser.ts below 15"** - Objective

❌ **"Refactor everything"** - Overwhelming scope
✅ **"Refactor parser.ts into 6 focused modules following MCP pattern"** - Clear scope

❌ **Trusting output without review** - Always validate
✅ **Run tests, review changes, test manually** - Verify everything

❌ **No documentation of decisions** - Future confusion
✅ **Update docs, add commit context, note in PLAN.md** - Clear record

## Success Metrics

Our agent-assisted development is working when:

- ✅ All tests pass after agent changes
- ✅ Typecheck is clean with strict settings
- ✅ Files stay under 400 lines (preferably under 200)
- ✅ Code is more maintainable after refactoring
- ✅ Patterns are applied consistently
- ✅ Documentation stays synchronized
- ✅ Commit history tells a clear story

## Tools and Commands

```bash
# Quality checks
bun run check:all          # Full pipeline (lint, typecheck, test, waymarks)
bun run lint               # Lint all packages
bun run typecheck          # Check types
bun run test               # Run all tests
bun run format             # Format code

# Development
bun run dev                # Start development server
bun run build              # Build all packages

# Git
gt modify -acm "message"   # Amend with message
gt submit                  # Submit stack to remote

# Waymarks
bun run check:waymarks     # Validate waymarks
rg ":::"                   # Find all waymarks
waymark find --type todo # Find specific types
```

## References

- [CORE.md](../../.agents/rules/CORE.md) - Agent identity and principles
- [TypeScript Conventions](../../.agents/rules/conventions/typescript.md) - Language rules
- [ARCHITECTURE.md](./ARCHITECTURE.md) - Module organization patterns
- [SPEC.md](../waymark/SPEC.md) - Waymark specification
