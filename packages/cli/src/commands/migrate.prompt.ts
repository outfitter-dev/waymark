// tldr ::: agent-facing usage guide for migrate command

export default `
MIGRATE COMMAND - Agent Usage Guide

PURPOSE
  Convert legacy comment patterns to waymark syntax for standardization.

COMMAND SYNTAX
  wm migrate <file> [--write] [--include-legacy]

MODES
  Default (dry-run):     Preview conversions without modifying files
  --write:               Apply migrations to files
  --include-legacy:      Also migrate non-standard patterns

SUPPORTED MIGRATIONS

  Standard patterns (always migrated):
    TODO:           → todo :::
    FIXME:          → fix :::
    HACK:           → hack :::
    NOTE:           → note :::
    XXX:            → warn :::
    @deprecated     → deprecated :::

  Legacy patterns (with --include-legacy):
    OPTIMIZE:       → note ::: optimize
    REFACTOR:       → note ::: refactor
    REVIEW:         → review :::
    BUG:            → fix :::
    IDEA:           → idea :::

MIGRATION RULES

  1. Preserve intent: Original meaning maintained
     Before: // TODO: implement OAuth
     After:  // todo ::: implement OAuth

  2. Normalize spacing: Consistent ::: sigil format
     Before: // FIXME:validate input
     After:  // fix ::: validate input

  3. Convert case: Markers lowercased
     Before: // TODO: Fix This
     After:  // todo ::: Fix This
     (Content case preserved)

  4. Detect context: Inline vs block comments handled
     Before: /* TODO: implement */
     After:  /* todo ::: implement */

  5. Preserve structure: Multi-line comments maintained
     Before:
       /**
        * TODO: Implement authentication
        * with OAuth 2.0
        */
     After:
       /**
        * todo ::: Implement authentication
        *      ::: with OAuth 2.0
        */

AGENT WORKFLOWS

  1. Preview migration before applying:
     wm migrate src/auth.ts
     → Shows what would change

  2. Migrate single file:
     wm migrate src/auth.ts --write
     → Converts legacy patterns in place

  3. Migrate entire codebase:
     find src -name "*.ts" | xargs wm migrate --write
     → Batch migrate all TypeScript files

  4. Include non-standard patterns:
     wm migrate src/ --include-legacy --write
     → Migrate both standard and legacy patterns

  5. Migrate then format:
     wm migrate src/auth.ts --write && wm format src/auth.ts --write
     → Convert then normalize

EXAMPLE OUTPUT (dry-run)

  $ wm migrate src/auth.ts

  src/auth.ts:
  - // TODO: implement OAuth
  + // todo ::: implement OAuth

  - // FIXME: validate email format
  + // fix ::: validate email format

  - /* XXX: this is a hack */
  + /* hack ::: this is a hack */

  Would migrate 3 patterns. Use --write to apply changes.

EXAMPLE OUTPUT (--write)

  $ wm migrate src/auth.ts --write

  Migrated 3 patterns in src/auth.ts

INTEGRATION PATTERNS

  # Migrate files before committing
  git diff --name-only --cached | xargs wm migrate --write

  # Progressive migration strategy
  find src -name "*.ts" -type f -exec wm migrate {} --write \\;

  # Migrate then validate
  wm migrate src/ --write && wm lint src/

  # Check migration coverage
  rg 'TODO:|FIXME:|HACK:' src/ && echo "Migration incomplete"

MIGRATION STRATEGY FOR CODEBASES

  1. Audit current patterns:
     rg '(TODO:|FIXME:|HACK:|NOTE:|XXX:)' src/ > legacy-patterns.txt

  2. Test migration on sample files:
     wm migrate src/sample.ts

  3. Migrate incrementally by directory:
     wm migrate src/auth/ --write
     wm migrate src/payments/ --write

  4. Validate after each batch:
     wm lint src/auth/
     wm format src/auth/ --write

  5. Verify no legacy patterns remain:
     rg 'TODO:|FIXME:|HACK:' src/ || echo "Migration complete"

EDGE CASES

  Handles common variations:
    // TODO: implement    → // todo ::: implement
    //TODO: implement     → // todo ::: implement
    // TODO : implement   → // todo ::: implement
    /*TODO: implement*/   → /* todo ::: implement */

  Preserves code context:
    const x = 1; // TODO: fix
    → const x = 1; // todo ::: fix

  Respects comment leaders:
    # TODO: Python comment
    → # todo ::: Python comment

TIPS FOR AGENTS
  ✓ Always preview with dry-run before using --write
  ✓ Migrate in batches (directory by directory)
  ✓ Validate with lint after migration
  ✓ Format after migration for consistency
  ✓ Use --include-legacy cautiously (review results)
  ✓ Check for remaining legacy patterns after migration
  ✓ Test builds after migration to catch edge cases

COMBINING WITH OTHER COMMANDS

  # Full migration workflow
  wm migrate src/auth.ts --write
  wm format src/auth.ts --write
  wm lint src/auth.ts

  # Find files needing migration
  rg -l 'TODO:|FIXME:' src/ | xargs wm migrate --write

For human-facing help, use: wm migrate --help
`;
