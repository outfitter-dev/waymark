<!-- tldr ::: how to add project-specific skills and point wm skill to them -->

# Project-Specific Skills

## When to Add Them

Project-specific skills are useful when a repo has unique workflows, conventions,
or automation that the default Waymark skill does not cover.

## Recommended Locations

The CLI searches for a `waymark-cli` skill directory in the following locations
(relative to the repo root):

- `skills/waymark-cli/`
- `agents/skills/waymark-cli/`
- `packages/agents/skills/waymark-cli/` (monorepo)

A valid skill directory contains a `SKILL.md` file.
In production builds, the CLI uses a generated `manifest.json` for faster lookup,
while development can still live-scan the directories.

## How to Create a Custom Skill

1. Create the directory with a `SKILL.md` file.
2. Add YAML frontmatter with `name` and `description`.
3. Create subdirectories as needed:
   - `commands/` — Command documentation
   - `references/` — Technical references
   - `examples/` — Workflow examples
4. Each `.md` file in these directories becomes a section.

Example structure:

```text
skills/waymark-cli/
├── SKILL.md
├── commands/
│   └── custom.md
└── examples/
    └── team-workflow.md
```

## Use a Custom Path

Set `WAYMARK_SKILL_DIR` to point at a custom skill directory:

```bash
export WAYMARK_SKILL_DIR=/path/to/skills/waymark-cli
```

Confirm the resolved path with:

```bash
wm skill path
```

## Collaboration Tips

- Keep skill docs close to the code they describe.
- Update skills whenever CLI behavior or conventions change.
- Prefer short, task-focused sections over long monoliths.
- Filenames become section names (e.g., `commands/custom.md` → `wm skill show custom`).
