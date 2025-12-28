// tldr ::: human-facing help text for migrate command

export default `
USAGE
  wm migrate <file> [options]

DESCRIPTION
  Convert legacy comment patterns (TODO:, FIXME:, etc.) to waymark syntax.

  The migrator detects common legacy patterns and transforms them into
  properly formatted waymarks while preserving intent and context.

OPTIONS
  -w, --write             Write changes to file (default: dry-run)
  --include-legacy        Also migrate non-standard patterns
  -h, --help              Show this help message
  --prompt                Show agent-focused usage guide

SUPPORTED LEGACY PATTERNS
  TODO:                   → todo :::
  FIXME:                  → fix :::
  HACK:                   → hack :::
  NOTE:                   → note :::
  XXX:                    → warn :::
  @deprecated             → deprecated :::

EXAMPLES
  # Preview migration (dry-run)
  wm migrate src/auth.ts

  # Apply migration
  wm migrate src/auth.ts --write

  # Migrate multiple files
  wm migrate src/**/*.ts --write

  # Include non-standard patterns
  wm migrate src/auth.ts --include-legacy --write

BEFORE MIGRATION
  // TODO: implement authentication
  // FIXME: validate email format
  /* XXX: this is a hack */
  /** @deprecated Use authenticate() instead */

AFTER MIGRATION
  // todo ::: implement authentication
  // fix ::: validate email format
  /* hack ::: this is a hack */
  // deprecated ::: Use authenticate() instead

For agent-focused guidance, use: wm migrate --prompt
`;
