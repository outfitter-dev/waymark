<!-- tldr ::: Phase 1 CLI refactoring - binary rename, version flag, format command -->

# Phase 1: Core Refactoring

**Status**: ✅ COMPLETE (2025-09-30)

## Overview

Phase 1 focused on foundational CLI improvements: renaming the binary, adding version support, and renaming the format command.

## Completed Tasks

### Binary Rename

- [x] Renamed primary binary from `waymark` to `wm`
- [x] Added `waymark` as symlink alias via package.json bin configuration
- [x] Updated build scripts to output `wm.js` instead of `waymark.js`
- [x] Updated install scripts for local development
- [x] Kept config directory as `~/.config/waymark/`
- [x] Kept cache directory as `~/.cache/waymark/`

### Version Flag

- [x] Added `--version` / `-v` flag
- [x] Reads version from package.json dynamically
- [x] Display format: `wm version X.Y.Z`
- [x] Works globally (before command dispatch)

### Format Command

- [x] Renamed `fmt` command to `format`
- [x] Kept `fmt` as backward-compatible alias
- [x] Updated usage strings
- [x] Updated documentation

## Testing

- All 18 tests passing after phase completion
- Manual verification of `wm --version` and `wm format` commands

## Files Modified

- `packages/cli/package.json` - Updated bin configuration
- `packages/cli/src/index.ts` - Added version handling, updated usage
- `packages/cli/src/commands/fmt.ts` - Command implementation
- Documentation files (README.md, PRD.md, etc.)

## Deferred Items

- [ ] State directory for zustand: `~/.cache/waymark/state.json` (deferred to pagination work in future phases)
