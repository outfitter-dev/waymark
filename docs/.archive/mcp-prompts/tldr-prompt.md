<!-- tldr ::: archived tldr prompt guidance for skill development -->

# TLDR Waymark Drafting Guidance

Archived from `apps/mcp/src/prompts/tldr.ts`.

## Prompt Text

Write a single-sentence TLDR waymark that summarizes the file.
Use active voice, cite the primary capability, and end with key technologies or domains.

## Context Provided

- File path (normalized for output)
- File snippet (truncated to max lines, default 200, max 2000)

## Implementation Notes

- Reads file content via `safeReadFile`
- Truncates to bounded limit (1-2000 lines)
- Returns as MCP prompt with `role: "user"`

## Example Output Pattern

```typescript
// tldr ::: Stripe webhook handler verifying signatures and queuing retries #payments
```

## Skill Development Notes

When converting to a skill:

1. Load the file content as context
2. Reference `.waymark/rules/TLDRs.md` for detailed guidance
3. Check existing waymarks in the file to avoid duplicates
4. Use the formatter to normalize the output
