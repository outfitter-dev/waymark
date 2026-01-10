<!-- tldr ::: Phase 5 CLI refactoring - interactive TUI with fzf integration -->

# Phase 5: Interactive TUI

**Status**: ⏸️ DEFERRED

## Overview

Phase 5 will add an interactive terminal UI with keyboard navigation and fzf integration for fuzzy searching. This phase has been deferred to focus on core CLI functionality first.

## Planned Features

### TUI Implementation

- [ ] Default `wm` command shows Ink-based TUI (not fzf)
- [ ] Browse waymarks with keyboard navigation
- [ ] Real-time filtering as you type
- [ ] Multi-column layout (file tree, waymark list, preview)
- [ ] Jump to file:line in editor (configurable command)
- [ ] Visual signal indicators (`^` and `*`)

### fzf Integration

- [ ] Detect if `fzf` is installed
- [ ] Use fzf for fuzzy matching algorithm (faster than custom)
- [ ] Fall back to simple string matching if fzf unavailable
- [ ] Support `$FZF_DEFAULT_OPTS` for algorithm tuning

### TUI vs Direct Output

- TUI mode: `wm` with no format flags
- Direct output: when format flags present (`--json`, `--jsonl`, `--pretty`)

### Preview Pane

- [ ] Show waymark context (surrounding lines)
- [ ] Syntax highlighting (if possible)
- [ ] File path and line number at top

## Technical Decisions Pending

### TUI Framework: Ink vs OpenTUI

See `docs/waymark/tui-ab-plan.md` for detailed comparison.

**Option A: React Ink**

- Pros: React familiarity, rich ecosystem, battle-tested
- Cons: Bundle size, React overhead for terminal

**Option B: OpenTUI**

- Pros: Rust performance, native binaries, smaller footprint
- Cons: Less mature, smaller ecosystem, learning curve

Decision deferred until core CLI is stable.

## Implementation Tasks

- [ ] Evaluate TUI frameworks (Ink vs OpenTUI)
- [ ] Build basic TUI layout with keyboard navigation
- [ ] Integrate fzf for fuzzy matching
- [ ] Add preview pane with context
- [ ] Handle editor jump command
- [ ] Implement fallback for no fzf
- [ ] Test TUI keyboard navigation
- [ ] Performance optimization for large codebases

## Testing Requirements

- [ ] TUI keyboard navigation tests (if possible)
- [ ] fzf integration tests (mock when not available)
- [ ] Fallback behavior tests
- [ ] Preview pane rendering tests

## Success Criteria

- TUI works seamlessly with keyboard navigation
- fzf integration provides fast fuzzy matching
- Preview pane enhances code understanding
- Fallback to plain output when TUI unavailable
- Performance remains fast even with large codebases

## Rationale for Deferral

Focus on delivering a streamlined non-interactive CLI first (rename, unified command, intelligent parsing, ergonomic flags). Interactive TUI/fzf work remains a later phase to avoid over-engineering before core functionality is solid.
