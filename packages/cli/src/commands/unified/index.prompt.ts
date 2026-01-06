// tldr ::: agent-facing usage guide for unified wm command

export default `
UNIFIED WM COMMAND - Agent Usage Guide

PURPOSE
  Scan and filter waymarks across a codebase with structured output for agents.

WAYMARK SYNTAX PRIMER
  Waymarks are structured comments using the \`:::\` sigil:

    // todo ::: implement auth #sec
    // *fix ::: validate input @alice
    // tldr ::: user service managing auth
    // ^wip ::: refactoring in progress

  Components:
    - Signals: ^ (raised/in-progress), * (starred for important/valuable)
    - Marker: todo, fix, wip, note, tldr, this, etc.
    - Content: Free text with optional properties
    - Properties: key:value pairs (see:#token, owner:@alice)
    - Mentions: @agent, @alice, @bob
    - Tags: #perf, #sec, #docs

COMMAND SYNTAX
  wm [paths] [filters] [modes] [output]

FILTERING OPTIONS
  --type <marker>     Filter by waymark type
                      Examples: todo, fix, wip, note, tldr, this
                      Can be repeated: --type todo --type fix

  --mention <actor>   Filter by mention
                      Examples: @agent, @alice, @bob
                      Can be repeated: --mention @agent --mention @alice

  --tag <tag>         Filter by hashtag
                      Examples: #perf, #sec, #docs
                      Can be repeated: --tag "#perf" --tag "#sec"

  --raised            Only show ^ (raised/in-progress) waymarks
                      Use to find work that shouldn't merge yet

  --starred           Only show * (starred) waymarks (important/valuable)
                      Use to find high-priority items

DISPLAY MODES
  (default)           List view - shows all matching waymarks
  --graph             Relations - dependency edges (ref/depends/needs)

OUTPUT FORMATS
  (default)           Human-readable text
  --json              JSON array (best for parsing)
  --jsonl             Newline-delimited JSON (best for streaming)
  --text              Formatted text output (human-readable)

FILTER BEHAVIOR
  OR logic within same flag type:
    --type todo --type fix
    → Matches waymarks with type=todo OR type=fix

  AND logic across different flag types:
    --type todo --tag "#perf"
    → Matches waymarks with type=todo AND tag includes #perf

  Example combining both:
    --type todo --type fix --mention @agent --tag "#perf"
    → Matches (todo OR fix) AND @agent AND #perf

AGENT WORKFLOWS

  1. Find actionable work:
     wm --type todo --mention @agent --json
     → List all todos assigned to @agent

  2. Identify dependencies:
     wm --graph --json
     → Extract ref/depends/needs relations

  3. Audit specific concerns:
     wm --tag "#sec" --starred --json
     → High-priority security items

  4. Find in-progress work:
     wm --raised --json
     → Everything marked with ^ signal

  5. Review recent changes:
     wm src/auth/ --type todo --type fix --json
     → Outstanding work in auth module

EXAMPLE OUTPUTS

  $ wm src/ --type todo --mention @agent --json
  [
    {
      "file": "src/auth.ts",
      "startLine": 12,
      "type": "todo",
      "signals": { "raised": false, "important": false },
      "contentText": "@agent implement OAuth callback",
      "mentions": ["@agent"],
      "tags": ["#sec"],
      "properties": {}
    }
  ]

  $ wm --graph --json
  {
    "nodes": [
      { "id": "#auth/service", "file": "src/auth.ts", "line": 1 }
    ],
    "edges": [
      {
        "from": "src/payments.ts:45",
        "to": "#auth/service",
        "kind": "from"
      }
    ]
  }

TIPS FOR AGENTS
  ✓ Always use --json for programmatic parsing
  ✓ Combine filters for precision (type + mention + tag)
  ✓ Use --graph to understand dependencies before refactoring
  ✓ Check --raised before merging to ensure no WIP remains
  ✓ Use --starred to prioritize high-importance items
  ✓ Parse TLDR waymarks to understand file purposes
  ✓ Look for @agent mentions to find delegated work

INTEGRATION PATTERNS
  # Find all agent work and pipe to processing
  wm --type todo --mention @agent --jsonl | process-tasks

  # Check for blocking work before merge
  wm --raised --json | jq 'length' # Should be 0

  # Extract dependency graph for visualization
  wm --graph --json > deps.json

For human-facing help, use: wm --help
`;
