# Waymark CLI - Engineering Memory

## @outfitter/contracts Error API (v0.4.1)

- `ValidationError.create(field, reason, context?)` -- field-specific validation
- `ValidationError.fromMessage(message, context?)` -- freeform validation
- `InternalError.create(message, context?)` -- unexpected errors
- `CancelledError.create(message)` -- user/signal cancellation
- `NotFoundError.create(resourceType, resourceId, context?)`
- `getExitCode(category)` -- maps ErrorCategory to exit code number
- Exit codes: validation:1, not_found:2, conflict:3, permission:4, timeout:5, rate_limit:6, network:7, internal:8, auth:9, cancelled:130

## Dual Commander Package Issue

- `@outfitter/cli` bundles its own Commander at `node_modules/@outfitter/cli/node_modules/commander/`
- `instanceof CommanderError` fails across package boundaries
- Solution: duck-type check `isCommanderLikeError()` that checks `.exitCode` (number) + `.code` (string starting with "commander.")
- Commander already prints help/version to stdout before throwing -- must suppress duplicate output in catch handlers

## createCLI() Integration Notes

- `createCLI()` calls `.version()` and `.exitOverride()` internally
- Do NOT call `.version()` again -- patch the existing option in-place to change flags
- The `cli.parse()` method handles help/version exit codes; `program.parseAsync()` bypasses this
- When using `program.parseAsync()` directly, add `isCommanderOutputError()` check in catch to avoid double-printing

## Biome Formatting

- Formatter reorders imports alphabetically -- don't fight it
- `biome-ignore lint/suspicious/noExplicitAny:` needed when patching Commander internals
- Format hook runs on pre-commit and may fix multiple files

## Graphite Workflow

- `gt modify -cm "message"` stages only tracked changes + creates new commit
- `gt modify -acm "message"` stages ALL changes including untracked
- Without `-a`, must `git add` specific files first, then use `-cm`
- Graphite auto-restacks the entire branch stack after commits
