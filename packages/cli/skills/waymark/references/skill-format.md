<!-- tldr ::: skill doc layout and manifest conventions for wm skill -->

# Skill File Format

## Directory Layout

```text
packages/agents/skills/waymark/
├── SKILL.md
├── commands/
├── references/
├── examples/
└── index.json
```

- `SKILL.md` is the core, high-level guide.
- `commands/` holds command-specific docs (`add`, `find`, `rm`, etc.).
- `references/` holds shared technical references.
- `examples/` holds workflows and task patterns.
- `index.json` maps sections to files for discovery.

## index.json Manifest

The manifest is a JSON map with relative paths:

- `name`, `version`, `description`, `entry`
- `commands`: map of command name → file path
- `references`: map of reference name → file path (entries pointing at `examples/` are treated as examples)
- `triggers`: keywords that help agents decide when to load the skill

Example:

```json
{
  "name": "waymark",
  "version": "1.0.0",
  "entry": "SKILL.md",
  "commands": {
    "find": "commands/find.md"
  },
  "references": {
    "schemas": "references/schemas.md",
    "workflows": "examples/workflows.md"
  }
}
```

## Markdown Conventions

- Start each file with a `<!-- tldr ::: ... -->` preamble.
- Frontmatter is optional; if used, place it after the comment preamble.
- Keep headings short and scannable.
- Include `:::` examples in fenced code blocks.
