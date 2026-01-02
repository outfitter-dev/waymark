// tldr ::: human-facing help text for format command

export default `
USAGE
  wm format <paths...> [options]

DESCRIPTION
  Format and normalize waymark syntax in files.

  The formatter ensures consistent spacing, marker casing, and property ordering
  according to your waymark configuration.

OPTIONS
  -w, --write             Write changes to file (default: dry-run)
  -h, --help              Show this help message
  --prompt                Show agent-focused usage guide

FORMATTING RULES
  - Exactly one space before and after ::: sigil
  - Marker case normalized (default: lowercase)
  - Multi-line continuations aligned to parent :::
  - Property ordering: relations after free text
  - Signal order: ^ before * when combined

EXAMPLES
  # Preview formatting changes (dry-run)
  wm format src/auth.ts

  # Apply formatting changes
  wm format src/auth.ts --write

  # Format multiple files or directories
  wm format src/**/*.ts --write
  wm format src/ --write

NOTES
  Files beginning with a \`waymark-ignore-file\` comment are skipped.

BEFORE FORMATTING
  //todo:::implement auth
  // *  fix  ::: validate input
  // tldr  :::payment processor
  //       :::   handles Stripe webhooks

AFTER FORMATTING
  // todo ::: implement auth
  // * fix ::: validate input
  // tldr ::: payment processor
  //      ::: handles Stripe webhooks

For agent-focused guidance, use: wm format --prompt
`;
