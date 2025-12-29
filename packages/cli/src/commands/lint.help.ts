// tldr ::: human-facing help text for lint command

export default `
USAGE
  wm lint <files...> [options]

DESCRIPTION
  Validate waymark structure and enforce quality rules.

  The linter checks for duplicate properties, unknown markers, dangling
  relations, and other structural issues.

OPTIONS
  --json                  Output as JSON array
  -h, --help              Show this help message
  --prompt                Show agent-focused usage guide

LINT RULES
  WM001   Duplicate property key (warn)
  WM010   Unknown marker (warn)
  WM020   Unterminated multi-line block (error)
  WM030   Multiple tldr in file (error)
  WM040   Canonical collision (error)
  WM041   Dangling relation (error)
  WM050   Signal on protected branch (policy)

EXIT CODES
  0   No errors (warnings allowed)
  1   Lint errors found
  2   Internal/tooling error

EXAMPLES
  # Lint single file
  wm lint src/auth.ts

  # Lint multiple files
  wm lint src/**/*.ts

  # JSON output for CI
  wm lint src/ --json

  # Pre-commit hook
  git diff --name-only --cached | xargs wm lint

EXAMPLE OUTPUT
  src/auth.ts:12:1 - error WM041: Dangling relation 'depends:#payments/core'
  src/auth.ts:34:1 - warn WM001: Duplicate property key 'owner'
  src/payments.ts:5:1 - error WM030: Multiple tldr waymarks in file

  ✖ 2 errors, 1 warning

For agent-focused guidance, use: wm lint --prompt
`;
