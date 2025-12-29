// tldr ::: agent-facing usage guide for remove command

export default `
REMOVE COMMAND - Agent Usage Guide

PURPOSE
  Programmatically remove waymarks from files with safety checks and audit logging.

COMMAND SYNTAX
  wm remove <file:line> [--write]
  wm remove --id <wm-id> [--write]
  wm remove --from <json-file> [--write]
  wm remove --criteria <filter-query> <paths> [--write]
  wm remove <file:line> --write --reason "<text>"

REMOVAL MODES

  1. Preview Mode (default):
     Shows what would be removed without modifying files
     Safe for exploration and validation

  2. Write Mode (--write):
     Actually removes waymarks from files
     Updates index and history

SAFETY MODEL

  Two-step process:
  1. Preview → Inspect what will be removed
  2. Execute → Add --write to apply changes
  Use --reason to store an audit note in history.json

INPUT METHODS

  1. By Location:
     wm remove src/auth.ts:42 --write
     → Removes waymark at line 42 in src/auth.ts

  2. By Waymark ID:
     wm remove --id wm:a3k9m2p --write
     → Removes waymark with ID wm:a3k9m2p

  3. By Filter Criteria:
     wm remove --criteria "type:todo mention:@agent" src/ --write
     → Removes all todos mentioning @agent in src/

  4. From JSON Input:
     cat removals.json | wm remove --from - --write
     → Batch removal from JSON

FILTER CRITERIA SYNTAX

  type:<marker>         Match by waymark type
  mention:<actor>       Match by mention
  tag:<hashtag>         Match by hashtag
  signal:^              Match raised (^) waymarks
  signal:*              Match starred (*) waymarks (important/valuable)
  contains:<text>       Match content containing text
  ref:<token>           Match canonical references

  Combine filters with AND logic:
  "type:todo mention:@agent tag:#deprecated"

OUTPUT FORMATS

  Default:  Human-readable preview/summary
  --json:   Compact JSON array of removed records
  --jsonl:  Newline-delimited JSON

EXAMPLES

  1. Preview removal by location:
     wm remove src/auth.ts:42
     → Shows waymark that would be removed

  2. Execute removal:
     wm remove src/auth.ts:42 --write
     → Actually removes the waymark

  3. Remove by ID:
     wm remove --id wm:a3k9m2p --write

  4. Remove all completed todos:
     wm remove --criteria "type:done" . --write

  5. Remove stale agent todos:
     wm remove --criteria "type:todo mention:@agent signal:^" src/ --write

  6. Batch remove from analysis:
     echo '[
       {"file":"src/a.ts","line":42},
       {"id":"wm:xyz123"}
     ]' | wm remove --from - --write --json

  7. Remove deprecated waymarks:
     wm remove --criteria "type:deprecated" --write

  8. Record a removal reason:
     wm remove src/auth.ts:42 --write --reason "obsolete"

AGENT WORKFLOWS

  1. Clean up completed work:
     # Agent finds done waymarks and removes them
     wm scan --type done --json | jq -r '.file + ":" + (.startLine|tostring)' | \\
       while read loc; do wm remove $loc --write; done

  2. Remove raised waymarks after merge:
     # Agent removes ^ waymarks after PR merges
     wm remove --criteria "signal:^" . --write

  3. Archive deprecated markers:
     # Agent removes deprecated waymarks after refactor
     wm remove --criteria "type:deprecated tag:#old-api" --write

  4. Conditional removal based on analysis:
     # Agent analyzes codebase and removes outdated waymarks
     wm scan --type todo --json | \\
       jq 'map(select(.properties.since < "2024-01-01")) | \\
           map({file, line: .startLine})' | \\
       wm remove --from - --write

JSON INPUT SCHEMA

  Required fields:
    file: string - File path
    line: number - Line number (1-indexed)

  OR

    id: string - Waymark ID (wm:xxxxx)

  Optional fields:
    confirm: boolean - Force confirmation prompt

  Examples:
  {"file": "src/auth.ts", "line": 42}
  {"id": "wm:a3k9m2p"}

AUTOMATIC BEHAVIORS

  1. Multi-line Handling:
     - Detects continuation lines
     - Removes entire waymark block atomically
     - Preserves surrounding code

  2. Index Updates:
     - Removes waymark from .waymark/index.json
     - Adds to .waymark/history.json with timestamp
     - Updates file metadata

  3. History Tracking:
     - Records removed waymark details
     - Stores removal timestamp and reason
     - Enables undo/audit capabilities

HISTORY STRUCTURE

  .waymark/history.json contains:
  {
    "removed": [
      {
        "waymark": {...},
        "removedAt": "2025-01-15T10:30:00Z",
        "removedBy": "cli",
        "reason": "completed"
      }
    ]
  }

ERROR HANDLING

  Common errors:
  - File not found → Check file path
  - Line mismatch → Waymark not at specified line
  - Unknown ID → ID not in index
  - No matches → Criteria didn't match any waymarks

  Preview mode catches most errors before write.

VERIFICATION

  After removal, verify with scan:
  wm remove src/auth.ts:42 --write
  wm scan src/auth.ts --type todo
  → Confirm waymark was removed

COMBINING WITH OTHER COMMANDS

  # Remove all todos, then verify
  wm remove --criteria "type:todo" . --write && wm scan --type todo

  # Find and remove specific waymarks
  wm scan --type deprecated --json | \\
    jq -r '.file + ":" + (.startLine|tostring)' | \\
    xargs -I {} wm remove {} --write

  # Clean up before release
  wm remove --criteria "signal:^" . --write  # Remove raised
  wm remove --criteria "type:wip" . --write  # Remove WIP

TIPS FOR AGENTS

  ✓ Always preview before --write to avoid mistakes
  ✓ Use --json output for programmatic processing
  ✓ Use criteria filters for bulk cleanup operations
  ✓ Verify removal with scan command afterward
  ✓ Review .waymark/history.json for audit trail
  ✓ Consider committing history.json for team sync

UNDO CAPABILITY (future)

  Removed waymarks in history can potentially be restored:
  wm restore --id wm:a3k9m2p --from-history

  (This feature may be added in future versions)

For human-facing help, use: wm remove --help
`;
