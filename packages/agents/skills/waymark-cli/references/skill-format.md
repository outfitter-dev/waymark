<!-- tldr ::: skill doc layout and convention-based discovery for wm skill -->

# Skill File Format

## Directory Layout

Skills use convention-based discovery. The directory structure determines what's available:

```text
packages/agents/skills/waymark-cli/
├── SKILL.md           # Core skill guide (required)
├── commands/          # Command docs (auto-discovered)
│   ├── find.md
│   └── add.md
├── references/        # Technical references (auto-discovered)
│   └── schemas.md
└── examples/          # Workflow examples (auto-discovered)
    └── workflows.md
```

## Discovery Rules

- `SKILL.md` — Required entry point. Frontmatter provides metadata.
- `commands/*.md` — Each file becomes a command section. Filename (without .md) is the section name.
- `references/*.md` — Each file becomes a reference section.
- `examples/*.md` — Each file becomes an example section.

No manifest file needed. The CLI discovers sections by scanning directories.

## SKILL.md Frontmatter

Metadata lives in YAML frontmatter at the top of SKILL.md:

```yaml
---
name: Waymark CLI
description: This skill should be used when the user asks about...
version: 1.0.0
---
```

- `name` — Display name (defaults to directory name if omitted)
- `description` — When to use this skill (for agent triggering)
- `version` — Semantic version (optional)

## Section Naming

Section names derive from filenames:

| File | Section Name |
| --- | --- |
| `commands/find.md` | `find` |
| `commands/add.md` | `add` |
| `references/schemas.md` | `schemas` |
| `examples/workflows.md` | `workflows` |

Access sections with `wm skill show <name>`:

```bash
wm skill show find       # commands/find.md
wm skill show schemas    # references/schemas.md
wm skill show workflows  # examples/workflows.md
```

## Markdown Conventions

- Start each file with a `<!-- tldr ::: ... -->` preamble.
- Frontmatter is optional for non-SKILL.md files.
- Keep headings short and scannable.
- Include `:::` examples in fenced code blocks.
