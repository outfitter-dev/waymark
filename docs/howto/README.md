<!-- tldr ::: practical usage examples and opinionated guides for waymark workflows #docs/howto -->

# How-To Guides

Practical, opinionated guides for common waymark workflows and use cases.

## Quick Navigation

- [Getting Started](#getting-started)
- [Daily Workflows](#daily-workflows)
- [Team Collaboration](#team-collaboration)
- [Agent Integration](#agent-integration)
- [Advanced Patterns](#advanced-patterns)

---

## Getting Started

### First-Time Setup

**Goal**: Initialize waymarks in an existing project.

```bash
# 1. Install CLI
bun add -g @waymarks/cli

# 2. Initialize config (interactive)
cd your-project
wm init

# 3. Add your first waymarks
# Add file summary
wm add src/index.ts:1 tldr "application entry point" --write

# 4. Verify
wm src/
```

**Tips**:

- Start with TLDRs on key files only
- Use `wm src/ --type tldr` to see all file summaries
- Commit `.waymark/config.toml` to share team settings
- Add `.waymark/index.json` to `.gitignore`

### Converting Legacy Comments

**Goal**: Migrate existing TODO/FIXME comments to waymark syntax.

```bash
# Preview migration
wm migrate src/

# Apply to specific file
wm migrate src/auth.ts --write

# Batch migrate entire directory
wm migrate src/ --write
```

**What gets converted**:

- `// TODO: fix bug` → `// todo ::: fix bug`
- `# FIXME: memory leak` → `# fix ::: memory leak`
- `<!-- NOTE: deprecated -->` → `<!-- note ::: deprecated -->`

---

## Daily Workflows

### Morning Standup

**Goal**: Find your assigned work for the day.

```bash
# All your TODOs
wm src/ --type todo --mention @yourname

# Raised (WIP) items you're working on
wm src/ --raised --mention @yourname

# Filter by priority
wm src/ --starred --type todo --mention @yourname
```

**Pro tip**: Create a shell alias:

```bash
alias mytodos='wm src/ --type todo --mention @yourname'
```

### Pre-Commit Checklist

**Goal**: Ensure branch is clean before committing.

```bash
# 1. Find raised waymarks (must be cleared before merge)
wm src/ --raised

# 2. Find temp/hack waymarks that might need cleanup
wm src/ --type temp --type hack

# 3. Verify no broken references
wm lint src/
```

**Automation**: Add to pre-push hook:

```bash
# .git/hooks/pre-push
if wm src/ --raised --json | grep -q '\['; then
  echo "Error: Raised (^) waymarks must be cleared before pushing"
  exit 1
fi
```

### Code Review

**Goal**: Find items needing review attention.

```bash
# All review waymarks
wm src/ --type review

# Security-related items
wm src/ --tag "#sec"

# Performance hotspots
wm src/ --tag "#perf:hotpath"
```

---

## Team Collaboration

### Delegating Work to Team Members

**Goal**: Assign tasks and track ownership.

```bash
# Add TODO for teammate
wm add src/auth.ts:42 todo "@alice implement OAuth flow" --write

# Find all work assigned to Alice
wm src/ --mention @alice

# Find unassigned work
wm src/ --type todo | grep -v '@'
```

### Using Actor Groups

**Goal**: Filter by team or role.

**Setup** (`.waymark/config.toml`):

```toml
[groups]
backend = ["@alice", "@bob"]
frontend = ["@charlie", "@dana"]
agents = ["@agent", "@claude", "@cursor"]
```

**Usage**:

```bash
# All backend team work
wm src/ --mention @backend

# All agent-delegated tasks
wm src/ --mention @agents --type todo
```

### Tracking Dependencies

**Goal**: Understand what blocks what.

```bash
# Add dependency
wm add src/payments.ts:56 todo "implement refunds depends:#payments/charge" --write

# Find dependency graph
wm src/ --graph

# Find what's blocking a feature
wm src/ --blocks "#auth/session"
```

---

## Agent Integration

### Delegating to AI Agents

**Goal**: Mark work for AI assistants.

```bash
# Add agent TODO
wm add src/cache.ts:23 todo "@agent implement Redis fallback" --write

# Find all agent work
wm src/ --type todo --mention @agent

# Specific agent
wm src/ --mention @claude
```

**Best practices**:

- Be specific: "implement X" not "fix this"
- Add context: tags, dependencies, mentions
- Use `^` signal for WIP: `^todo ::: @agent refactoring in progress`

### MCP Server Workflows

**Goal**: Let agents read/write waymarks programmatically.

**Setup**: Configure MCP server in your agent's config (Claude Code, Cursor, etc.)

**Agent can now**:

- `waymark.scan` - Read all waymarks
- `waymark.insert` - Add new waymarks
- `waymark.graph` - Analyze dependencies

See [MCP Server Documentation](../../README.md#mcp-server) for integration details.

---

## Advanced Patterns

### Canonical References & Linking

**Goal**: Create stable anchors that other waymarks can reference.

```bash
# 1. Add canonical reference
wm add src/auth.ts:1 tldr "authentication service ref:#auth/service" --write

# 2. Reference from other files
wm add src/middleware.ts:45 note "delegates to ref:#auth/service" --write
wm add src/api.ts:78 todo "coordinate with depends:#auth/service" --write

# 3. Find all references to a canonical
wm src/ --tag "#auth/service"
```

**Naming conventions**:

- Use namespaces: `#area/feature` (e.g., `#payments/stripe`)
- Lowercase only
- Consistent across team

### Multi-line Waymarks

**Goal**: Add detailed context without cluttering single lines.

```typescript
// todo ::: refactor authentication flow for OAuth 2.0
//      ::: coordinate with @backend team
//      ::: update docs once complete
// depends:#auth/session
// priority:high
```

**When to use**:

- Complex tasks needing context
- Multiple properties/tags
- Detailed implementation notes

### Performance Hotspot Tracking

**Goal**: Mark and track performance-critical code.

```bash
# Mark hotspot
wm add src/query.ts:67 note "database query hotspot #perf:hotpath" --write

# Find all hotspots
wm src/ --tag "#perf:hotpath"

# Add performance TODOs
wm add src/cache.ts:34 todo "add Redis caching #perf" --write
```

**Performance tags**:

- `#perf:hotpath` - Critical path code
- `#perf:slow` - Known slow operations
- `#perf:optimize` - Optimization opportunities

### Security Annotations

**Goal**: Mark security boundaries and concerns.

```bash
# Mark security boundary
wm add src/api.ts:12 note "validates all inputs #sec:boundary" --write

# Find security-critical code
wm src/ --tag "#sec"

# Security TODOs
wm add src/auth.ts:89 fix "validate JWT expiry #sec:auth" --write
```

**Security tags**:

- `#sec:boundary` - Input/output validation points
- `#sec:auth` - Authentication code
- `#sec:authz` - Authorization code
- `#sec:crypto` - Cryptographic operations

### Documentation Cross-References

**Goal**: Link code to documentation.

```bash
# In code
wm add src/api.ts:1 tldr "REST API handlers ref:#api/rest #docs/api" --write

# In docs (docs/api/README.md)
<!-- tldr ::: REST API documentation for backend services ref:#docs/api -->
<!-- note ::: implementation details at ref:#api/rest -->
```

**Finding documentation**:

```bash
# All doc TLDRs
wm docs/ --type tldr --tag "#docs"

# API-related docs
wm docs/ --tag "#docs/api"
```

---

## Use Case Examples

### Onboarding New Team Members

**Goal**: Help new developers understand the codebase quickly.

```bash
# 1. Find file summaries
wm src/ --type tldr

# 2. Find key entry points
wm src/ --type tldr --tag "#arch/entrypoint"

# 3. Read file summaries
wm src/ --type tldr --type this
```

### Preparing for Major Refactor

**Goal**: Document refactor plan and track progress.

```bash
# 1. Mark files for refactor
wm add src/legacy.ts:1 ^wip "refactoring to TypeScript @yourname" --write

# 2. Document dependencies
wm add src/legacy.ts:1 note "depends:#new-api/client" --write

# 3. Track refactor progress
wm src/ --raised --mention @yourname

# 4. Clear signals when done
wm modify src/legacy.ts:1 --unraise --write
```

### Security Audit

**Goal**: Identify and track security-related code.

```bash
# 1. Find all security-tagged waymarks
wm src/ --tag "#sec"

# 2. Find unreviewed auth code
wm src/ --type review --tag "#sec:auth"

# 3. Check for known security TODOs
wm src/ --type todo --type fix --tag "#sec"
```

### Performance Review

**Goal**: Identify optimization opportunities.

```bash
# 1. Find hotspots
wm src/ --tag "#perf:hotpath"

# 2. Find optimization TODOs
wm src/ --type todo --tag "#perf"

# 3. Review recent performance notes
wm src/ --type note --tag "#perf"
```

---

## Tips & Tricks

### Shell Aliases

Add to `.bashrc` / `.zshrc`:

```bash
alias wmt='wm src/ --type todo'
alias wmr='wm src/ --raised'
alias wml='wm lint src/'
```

### Git Hooks

Enforce waymark quality in git hooks:

```bash
# .git/hooks/pre-commit
#!/bin/bash
# Prevent committing raised waymarks to main branch
BRANCH=$(git symbolic-ref --short HEAD)
if [[ "$BRANCH" == "main" ]] && wm --raised --json | grep -q '\['; then
  echo "Error: Cannot commit raised (^) waymarks to main branch"
  exit 1
fi

# Run linter
wm lint src/ || exit 1
```

### VS Code Integration

Add to `.vscode/tasks.json`:

```json
{
  "version": "2.0.0",
  "tasks": [
    {
      "label": "Waymark: List TODOs",
      "type": "shell",
      "command": "wm src/ --type todo",
      "problemMatcher": []
    },
    {
      "label": "Waymark: TLDRs",
      "type": "shell",
      "command": "wm src/ --type tldr",
      "problemMatcher": []
    }
  ]
}
```

### Editor Snippets

Add to VS Code snippets (`.vscode/waymark.code-snippets`):

```json
{
  "Waymark TODO": {
    "prefix": "wmtodo",
    "body": ["// todo ::: $1"],
    "description": "Insert waymark TODO"
  },
  "Waymark TLDR": {
    "prefix": "wmtldr",
    "body": ["// tldr ::: $1"],
    "description": "Insert waymark TLDR"
  }
}
```

---

## Getting Help

- [CLI Reference](../cli/README.md) - Complete command documentation
- [Grammar Specification](../GRAMMAR.md) - Waymark syntax reference
- Issue tracker (GitHub: outfitter-dev/waymark, internal) - Report bugs or request features

---

## Contributing Guides

Have a useful workflow? Contribute it!

1. Fork the repo
2. Add your guide to `docs/howto/`
3. Update this README with a link
4. Submit a PR

**Guide template**:

```markdown
<!-- tldr ::: [brief description] #docs/howto -->

# [Guide Title]

**Goal**: [What this guide helps you accomplish]

## Steps

1. [Step 1]
2. [Step 2]
3. [Step 3]

## Example

\```bash
# Example commands
\```

## Tips

- [Tip 1]
- [Tip 2]
```
