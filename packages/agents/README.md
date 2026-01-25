<!-- tldr ::: agent skills and resources for waymark tooling -->

# Waymark Agent Resources

Agent skills and resources for waymark tooling. This directory provides skills, commands, agents, and hooks that can be consumed by AI agents (Claude, etc.) to effectively use the waymark CLI.

## Structure

```text
packages/agents/
├── agents/                    # Agent runbooks or specialized roles
├── commands/                  # Prebuilt agent commands
├── hooks/                     # Agent hooks (optional)
└── skills/
    └── waymark/
        ├── SKILL.md           # Core skill - overview, concepts
        ├── commands/          # Per-command documentation
        │   ├── find.md
        │   ├── add.md
        │   ├── edit.md
        │   ├── rm.md
        │   └── ...
        ├── references/        # Supporting material
        │   ├── schemas.md
        │   ├── exit-codes.md
        │   └── errors.md
        ├── examples/          # Use case examples
        │   ├── workflows.md
        │   ├── agent-tasks.md
        │   ├── batch-operations.md
        │   └── integration.md
        └── index.json         # Manifest for discovery
```

## Usage with Claude Code

Map this directory as a Claude plugin to make skills available:

```json
{
  "plugins": {
    "waymark": {
      "path": "./packages/agents/skills"
    }
  }
}
```

## Skills

### `waymark`

Modular skill for agents to use the `wm` CLI effectively.

**Core (`SKILL.md`):**

- When to use waymarks
- Syntax quick reference
- Command overview

**Commands (`commands/*.md`):**

- Per-command documentation with examples
- Options, arguments, workflows
- Exit codes and error handling

**References (`references/*.md`):**

- JSON schemas for input/output
- Exit code taxonomy
- Error patterns

**Examples (`examples/*.md`):**

- Multi-command workflows
- Common agent task patterns
- Batch operations
- Integration patterns (MCP, CI/CD)

Access via `wm skill` command or directly from this directory.
