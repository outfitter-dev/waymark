// tldr ::: agent-facing usage guide for lint command

export default `
LINT COMMAND - Agent Usage Guide

PURPOSE
  Validate waymark structure and enforce quality rules to maintain codebase integrity.

COMMAND SYNTAX
  wm lint <files...> [--json]

OUTPUT FORMATS
  Default:  Human-readable text with colored output
  --json:   JSON array of lint issues for parsing

LINT RULES

  WM001 - Duplicate property key (warn)
    Multiple instances of same property key in a waymark.
    Example: owner:@alice ... owner:@bob
    Action: Remove duplicate, keep last value

  WM010 - Unknown marker (warn)
    Marker not in blessed list or allowTypes config.
    Example: // foo ::: unknown marker
    Action: Use blessed marker or add to allowTypes

  WM020 - Unterminated multi-line block (error)
    Multi-line waymark missing proper continuation or closure.
    Example: HTML comment missing -->
    Action: Add missing continuation lines or close block

  WM030 - Multiple tldr in file (error)
    More than one tldr waymark in a single file.
    Example: Two // tldr ::: statements
    Action: Consolidate into single tldr at top of file

  WM040 - Canonical collision (error)
    Multiple waymarks declare same ref:#token.
    Example: ref:#auth/service in two files
    Action: Rename one canonical or remove duplicate

  WM041 - Dangling relation (error)
    Relation property references non-existent canonical.
    Example: depends:#payments/core with no ref:#payments/core
    Action: Create canonical or fix token reference

  WM050 - Signal on protected branch (policy)
    Raised (^) waymark found on protected branch.
    Example: // ^todo ::: implement on main branch
    Action: Complete work or remove signal before merge

EXIT CODES
  0 = Success (no errors, warnings allowed)
  1 = Lint errors found
  2 = Internal error or invalid usage

AGENT WORKFLOWS

  1. Pre-commit validation:
     git diff --name-only --cached | xargs wm lint
     → Lint only staged files

  2. CI integration:
     wm lint src/ --json | jq 'map(select(.severity == "error"))'
     → Filter for errors only, fail build if any

  3. Find all issues in project:
     wm lint src/ --json > lint-results.json
     → Export all issues for review

  4. Check before merge:
     wm lint $(git diff --name-only main..HEAD)
     → Lint files changed in current branch

  5. Validate specific rule:
     wm lint src/ --json | jq 'map(select(.code == "WM041"))'
     → Find all dangling relations

EXAMPLE OUTPUT (text)

  src/auth.ts:12:1 - error WM041: Dangling relation 'depends:#payments/core'
    No canonical found for token #payments/core

  src/auth.ts:34:1 - warn WM001: Duplicate property key 'owner'
    Property 'owner' appears multiple times

  src/payments.ts:5:1 - error WM030: Multiple tldr waymarks in file
    Found tldr at lines 5 and 23

  ✖ 2 errors, 1 warning

EXAMPLE OUTPUT (json)

  [
    {
      "file": "src/auth.ts",
      "line": 12,
      "column": 1,
      "severity": "error",
      "code": "WM041",
      "message": "Dangling relation 'depends:#payments/core'",
      "type": "todo"
    },
    {
      "file": "src/auth.ts",
      "line": 34,
      "column": 1,
      "severity": "warn",
      "code": "WM001",
      "message": "Duplicate property key 'owner'",
      "type": "fix"
    }
  ]

INTEGRATION PATTERNS

  # Fail CI on errors
  wm lint src/ --json | jq 'map(select(.severity == "error")) | length' | grep -q '^0$'

  # Generate lint report
  wm lint src/ > lint-report.txt

  # Check for protected branch violations
  if git branch --show-current | grep -E '^(main|master|release/)'; then
    wm lint src/ --json | jq 'map(select(.code == "WM050"))'
  fi

  # Auto-fix duplicate properties (manual review)
  wm lint src/ --json | jq 'map(select(.code == "WM001"))' | process-duplicates

CONFIGURATION

  Lint behavior controlled by .waymark/config.jsonc:

  {
    "allowTypes": ["todo", "fix", "note", "tldr", "custom"],
    "protectedBranches": ["main", "release/*"],
    "signalsOnProtected": "strip",  // or "fail" or "allow"
    "lint": {
      "duplicateProperty": "warn",   // or "error" or "off"
      "unknownMarker": "warn",
      "danglingRelation": "error",
      "duplicateCanonical": "error"
    }
  }

TIPS FOR AGENTS
  ✓ Always lint before committing waymark changes
  ✓ Use --json for parsing in automated workflows
  ✓ Fix errors immediately; warnings can be deferred
  ✓ Check for WM041 (dangling relations) when refactoring
  ✓ Ensure WM030 (multiple tldrs) never occurs
  ✓ Use exit code 1 to fail CI on lint errors
  ✓ Integrate with format command for complete validation

COMBINING WITH OTHER COMMANDS

  # Format then lint
  wm format src/auth.ts --write && wm lint src/auth.ts

  # Scan for issues, then lint for structure
  wm src/ --type todo --raised && wm lint src/

For human-facing help, use: wm lint --help
`;
