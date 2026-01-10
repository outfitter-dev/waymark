<!-- tldr ::: index for v1 syntax implementation plan and issue references #docs/plan -->

# v1 Syntax Implementation

This directory contains the implementation plan and GitHub issue references for Waymark v1 syntax changes.

## Quick Start for Agents

1. Read `PLAN.md` for the full implementation plan and branch sequence
2. Reference `issue-*.md` files for detailed scope per change area
3. Each branch must pass CI independently (complete vertical slice)

## Files

| File | Purpose |
|------|---------|
| `PLAN.md` | Master implementation plan with branch sequence and file lists |
| `issue-129-tracking.md` | Tracking issue with all syntax changes overview |
| `issue-130-signals-types.md` | Signals (`~`) and type aliases (`about`) |
| `issue-131-ids.md` | Wikilink ID format (`[[hash]]`) |
| `issue-132-relations-properties.md` | New relation keys and `sym:` property |
| `issue-133-tags-mentions.md` | Stricter `@mention` parsing |
| `issue-134-continuations.md` | Continuation lines and whitespace |
| `issue-135-docs.md` | Documentation updates |

## Branch Sequence

```text
1. syntax/types-about      (S) - rename this → about
2. syntax/signals-tilde    (M) - change ^ → ~
3. syntax/relations-v2     (M) - new relation keys
4. syntax/properties-sym   (S) - add sym: property
5. syntax/tags-mentions    (S) - stricter @mention
6. syntax/ids-bracket      (L) - wm:xxx → [[hash]]
7. syntax/continuations    (S) - docs only
8. syntax/docs-v1          (M) - comprehensive docs
```

## Key Constraints

- **No backward compatibility** - breaking changes only
- **Each branch CI-green** - tests updated in same branch
- **TDD methodology** - red-green-refactor per change
- **Graphite stack** - branches stack on each other
