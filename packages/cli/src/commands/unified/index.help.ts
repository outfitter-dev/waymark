// tldr ::: human-facing help text for unified wm command

export default `
USAGE
  wm [paths] [options]

DESCRIPTION
  Scan and display waymarks with optional filtering and output modes.

  The unified wm command combines scanning, filtering, and display into a
  single interface. Use flags to control what waymarks are shown and how
  they're formatted.

OPTIONS
  Filtering:
    -t, --type <marker>     Filter by waymark type (todo, fix, note, etc.)
    -m, --mention <actor>   Filter by mention (@agent, @alice, etc.)
    --tag <tag>             Filter by hashtag (#perf, #sec, etc.)
    -r, --raised            Show only raised (^) waymarks
    -s, --starred           Show only important (*) waymarks

  Display Modes:
    --map                   File tree with TLDR summaries
    --graph                 Dependency relations graph
    --summary               Add summary footer (with --map)

  Output Formats:
    --json                  JSON array
    --jsonl                 Newline-delimited JSON
    --pretty                Pretty-printed JSON

  General:
    -h, --help              Show this help message
    --prompt                Show agent-focused usage guide
    -v, --version           Show version number

EXAMPLES
  # Scan current directory
  wm

  # Find todos assigned to @agent
  wm src/ --type todo --mention @agent

  # Map documentation with TLDRs only
  wm --map docs/ --type tldr

  # Export dependency graph as JSON
  wm --graph --json

  # Find high-priority security issues
  wm --starred --tag "#sec"

  # Combine multiple filters
  wm src/ --type todo --type fix --raised --mention @agent

FILTER BEHAVIOR
  Multiple filters of the same type use OR logic:
    --type todo --type fix    → Shows todos OR fixes

  Different filter types use AND logic:
    --type todo --tag "#perf" → Shows todos AND tagged with #perf

For agent-focused guidance, use: wm --prompt
`;
