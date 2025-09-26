<!-- tldr ::: running log of agent activities and discoveries #docs/rules -->

# Scratchpad

Keep this log current while working. Each session should append entries under the current date.

## Notes

<!-- context ::: this space is for any general notes that come up while working -->
<!-- ::: the intent is to capture thoughts, concerns, etc. so other agents can see them -->
<!-- ::: keep this space tidy though, and prune it periodically when things may no longer be relevant -->

- ...

## 2025-09-26

- Initial Project Setup
  - Initialized workspace scaffolding: packages (`core`, `cli`, `agents`), `apps/mcp`, shared configs
  - Added formatting/linting stack (Ultracite, Prettier, markdownlint-cli2, lefthook) and workspace scripts
  - Rebuilt documentation (README, SPEC, rule guides) with updated waymarks and conventions
- Environment Audit & Configuration
  - Audited environment setup from previous agent's work
  - Added missing TypeScript strict option: `exactOptionalPropertyTypes: true`
  - Added @types/bun as devDependency to all packages for proper Bun API typing
  - Added "types": ["bun"] to root tsconfig.json for global Bun type availability
- Monorepo & Build Pipeline
  - Installed and configured Turbo 2.5.8 for monorepo task orchestration
  - Created comprehensive turbo.json with task dependencies and caching
  - Enhanced root package.json with complete script suite (build, dev, test, typecheck, CI scripts)
  - Updated all workspace packages with matching scripts for Turbo coordination
  - Enhanced bunfig.toml with aggressive caching, build optimizations, and test configuration
  - Created minimal source files for all packages to enable build/typecheck verification
  - Verified full build pipeline working with Turbo caching ("FULL TURBO" achieved)
  - Added Turbo cache directory (.turbo/) to .gitignore
- Git Hooks & Quality Gates
  - Configured lefthook pre-commit and pre-push hooks with waymark checks
  - Created test setup file and basic test for @waymarks/core
  - Fixed package test scripts to handle missing tests gracefully
  - Verified CI scripts (ci:local, ci:validate) working properly
- SQLite Caching Implementation
  - Integrated Bun's native SQLite (`bun:sqlite`) for caching strategy
  - Updated PRD with comprehensive SQLite caching architecture
  - Created cache module in @waymarks/core with WaymarkCache class
  - Designed SQLite schema for waymarks, file metadata, and dependency graphs
  - Configured for performance with WAL mode, prepared statements, and indices
  - Updated PLAN.md Phase 2 with cache implementation tasks
- Environment Cleanup & Fixes
  - Fixed environment issues from previous agent's off-rails script moves
  - Removed duplicate .lefthook.yaml file and unnecessary scripts/hooks directory
  - Made lefthook configuration DRY by using package.json scripts directly
  - Updated biome.json to correct extends array format: extends: ["ultracite"]
  - Changed format script from deprecated ultracite format to ultracite fix --unsafe
  - Fixed TypeScript issues in cache module (changed snake_case DB columns to camelCase)
- Grammar Package Creation
  - Created missing @waymarks/grammar package with complete structure
  - Moved core type definitions and parser logic to separate grammar package
  - Fixed all lint issues: top-level regex, proper typing without any, barrel file ignores
  - Generated TypeScript declarations for grammar package (.d.ts files)
- Final Validation
  - Fixed linting issues (unused imports, console usage, barrel file pattern)
  - Achieved full check:all pipeline success (lint, typecheck, test, check:waymarks all passing)
