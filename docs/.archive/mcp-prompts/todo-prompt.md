<!-- tldr ::: archived todo prompt guidance for skill development -->

# TODO Waymark Drafting Guidance

Archived from `apps/mcp/src/prompts/todo.ts`.

## Prompt Text

Write a TODO waymark content line (no marker) that captures the essential follow-up work.
Keep it short, actionable, and mention owners or references if provided.

## Context Provided

- Summary (required) - Brief description of the work
- File path (optional) - Where the TODO should be placed
- Context (optional) - Additional context about the work

## Implementation Notes

- Simple text assembly, no file reading
- Returns as MCP prompt with `role: "user"`

## Example Output Pattern

```typescript
// todo ::: @agent implement rate limiting for auth endpoints #sec:boundary
```

## Skill Development Notes

When converting to a skill:

1. Accept summary/context from user or infer from conversation
2. Reference `.waymark/rules/CONVENTIONS.md` for tag patterns
3. Suggest appropriate signals (^ for WIP, * for priority)
4. Include relevant mentions (@agent, @username) when ownership matters
