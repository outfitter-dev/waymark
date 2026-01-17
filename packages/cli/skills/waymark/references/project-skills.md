<!-- tldr ::: how to add project-specific skills and point wm skill to them -->

# Project-Specific Skills

## When to Add Them

Project-specific skills are useful when a repo has unique workflows, conventions,
or automation that the default Waymark skill does not cover.

## Recommended Locations

The CLI searches for a `waymark` skill directory in the following locations
(relative to the repo root):

- `skills/waymark/`
- `agents/skills/waymark/`
- `packages/agents/skills/waymark/` (monorepo)

Each location must include an `index.json` manifest.

## How to Create a Custom Skill

1. Create the directory structure shown in `wm skill show skill-format`.
2. Copy `SKILL.md` and adjust the core guidance for your repo.
3. Add command docs or references as needed.
4. Update `index.json` to include your new sections.

## Use a Custom Path

Set `WAYMARK_SKILL_DIR` to point at a custom skill directory:

```bash
export WAYMARK_SKILL_DIR=/path/to/skills/waymark
```

You can always confirm the resolved path with:

```bash
wm skill path
```

## Collaboration Tips

- Keep skill docs close to the code they describe.
- Update skills whenever CLI behavior or conventions change.
- Prefer short, task-focused sections over long monoliths.
