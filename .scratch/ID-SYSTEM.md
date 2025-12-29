<!-- tldr ::: durable waymark ID system overview, lifecycle, and storage (scratch) -->

# Waymark ID System (Durable IDs)

This doc captures how durable waymark IDs work in v1 (as specified in `docs/cli/waymark_editing.md`) and how they are used for automation and code review workflows.

## Purpose

Waymark IDs make annotations stable across refactors and line shifts. They enable:

- Updating or removing a specific waymark without relying on line numbers
- Tracking automated insertions (code review, compliance, bots)
- Maintaining an index of known waymarks for fast lookups

## ID Format

```text
wm:<base36-hash>
```

- Prefix: `wm:`
- Hash: 7-9 chars, base36, lowercase
- Example: `wm:a3k9m2p`

IDs appear as a property in the waymark content:

```ts
// todo ::: add rate limiting owner:@alice wm:a3k9m2p
```

## Generation

- Content-addressed with a timestamp salt for uniqueness.
- Collision checks are performed against the index; if a collision occurs, a suffix is appended.

## Lifecycle

### Insert

- `wm add` can auto-generate IDs or accept explicit ones.
- Inserted IDs are recorded in the index.

### Find / Update

- `wm find --id wm:...` resolves the location via index.
- Planned `wm update` would update by ID rather than line.

### Remove

- `wm remove --id wm:...` deletes by ID.
- Removal is recorded in history when enabled.

## Storage

### Index (active IDs)

`.waymark/index.json` tracks active IDs and metadata:

- file, line, type, content
- content hash + context hash for drift detection
- timestamps and source info

### History (tombstones)

`.waymark/history.json` stores removal records with metadata such as:

- removedAt, removedBy, reason
- original waymark record

Both files are gitignored by default.

## Fingerprints

Two hashes help track moved waymarks:

- `contentHash`: normalized content
- `contextHash`: surrounding lines + indentation

Matching precedence during refresh:

1. ID match
2. Content hash
3. Context hash + fuzzy line distance

## Config (IDs + Index)

Key options in `.waymark/config.*`:

```toml
[ids]
mode = "prompt"       # prompt | auto | off
length = 8
track_history = true

[index]
refresh_triggers = ["manual", "pre-commit"]
auto_refresh_after_minutes = 10
assign_on_refresh = false
```

## Code Review Use Case

Waymark IDs enable automated review workflows:

- GitHub Actions can insert `review` waymarks with stable IDs
- Review bots can later remove or update those by ID
- IDs make review notes durable even when code shifts

Example (conceptual):

```json
{
  "insertions": [
    {
      "file": "src/auth.ts",
      "line": 42,
      "type": "review",
      "content": "missing input validation",
      "id": "wm:gh42-rev1",
      "properties": { "github": "#42" }
    }
  ]
}
```

## Related Docs

- `docs/cli/waymark_editing.md` (full ID design, insert/remove flows)
- `docs/cli/commands.md` (ID management overview)
