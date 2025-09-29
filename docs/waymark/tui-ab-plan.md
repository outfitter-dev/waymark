<!-- tldr ::: comparative plan for opentui vs React Ink waymark TUIs #docs/plan -->

# Waymark TUI A/B Evaluation Plan

## Purpose

We want a terminal-first experience that makes Waymark data scannable without leaving the shell. Two contenders are on the table — **opentui** (lightweight, Bun-native) and **React Ink** (component-driven, React-compatible). This document defines the evaluation criteria, scope, and cadence for running both prototypes in parallel and converging on a preferred approach.

## Objectives

1. **Feature Parity:** replicate the core CLI flows (`scan`, `map`, `find`, `graph`) with intuitive navigation.
2. **Agent Coherence:** ensure the TUI consumes the same core helpers as CLI/MCP so automation remains consistent.
3. **Performance & Ergonomics:** measure responsiveness, bundle size, developer experience, and DX for future contributors.
4. **Decision Readiness:** collect enough evidence in ≤2 focused workdays to recommend one path and archive the other.

## Prototype Scope

| Focus Area | opentui Spike | React Ink Spike |
| --- | --- | --- |
| Rendering primitives | Use opentui layout primitives for panels/lists | Compose Ink components (e.g., `Box`, `Text`, `SelectInput`) |
| Data source | Shared CLI helpers from `@waymarks/core` | Same `@waymarks/core` helpers |
| Navigation | Keyboard navigation (j/k, enter, esc) with builtin state management | React state hooks + Ink key handlers |
| Output views | File list, marker filter, detail pane (raw snippet + metadata) | Same views; leverage Ink components for structured layout |
| Packaging | Bun entrypoint; evaluate pure Bun dependencies | Bun entrypoint with React/Ink bundling |

### Out of Scope

- Advanced editing/insert flows (defer until baseline TUI chosen)
- MCP transport integration (revisit post-decision)
- Multi-repo dashboards

## Success Metrics

- **UX:** prototype supports list + detail view, marker filter, and back navigation with <3 obvious issues (informal hallway test).
- **Performance:** initial load <250 ms on sample repo (map cache present) and navigation latency negligible (<50 ms).
- **Developer Ergonomics:** spike author can add a new panel/view within 30 minutes; diffs stay <300 LoC.
- **Integration:** runs via `bun run tui:<variant>` reusing CLI config discovery; no copy-paste of core logic.

## Execution Timeline

| Day | Activities |
| --- | --- |
| Day 0 | Align on scope, prep skeleton branches (`feat/tui-opentui`, `feat/tui-ink`), document baseline requirements. |
| Day 1 | Build opentui spike: bootstrap layout, wire data loaders, capture notes in SCRATCHPAD. |
| Day 2 | Build React Ink spike: mirror features, capture DX/perf observations. |
| Day 3 | Synthesize findings, run comparison rubric, draft recommendation, update PLAN decisions log. |

## Deliverables

- Two prototype folders under `packages/cli/src/tui/opentui` and `packages/cli/src/tui/ink` (or equivalent) with minimal, runnable code.
- Run scripts in `package.json`:
  - `bun run tui:opentui`
  - `bun run tui:ink`
- Evaluation checklist completed (see below) with notes for each prototype.
- Recommendation summary appended to this doc (`## Decision & Follow-Up`).

## Evaluation Checklist

### Build & Runtime

- [ ] Prototype runs via Bun without extra global installs.
- [ ] Type-check passes with strict TS settings.
- [ ] Ultracite lint passes; no ad-hoc formatting overrides.

### UX Flow

- [ ] Marker filter toggles between `tldr`/`todo`/`this`/custom.
- [ ] Detail pane shows snippet plus metadata (file, line, tags, relations).
- [ ] Keyboard shortcuts documented in help overlay.
- [ ] Graceful handling when cache/map data is missing (fall back to scanning).

### DX Notes

- [ ] Author wrote setup instructions (bullets) in this doc.
- [ ] Pain points recorded in SCRATCHPAD.
- [ ] Integration friction with MCP/CLI noted.

### Performance

- [ ] Startup time measured (Bun `time` output).
- [ ] Render latency measured for 1k-waymark dataset.
- [ ] Memory footprint noted (`/usr/bin/time -l` or Bun equivalent).

## Decision & Follow-Up (to be completed)

<!-- todo ::: summarize findings and mark chosen TUI path once evaluation wraps -->

- Winner:
- Rationale:
- Follow-up tasks:

## Risks & Mitigations

- **Time Overrun:** Keep spikes timeboxed; if a prototype exceeds the day, log blockers and pause.
- **API Drift:** Use shared modules (`packages/cli/src/utils`) and avoid diverging data contracts.
- **Contributor Familiarity:** If both attempts struggle, consider fallback (ncurses-based minimal UI) or extend CLI with richer text output.

## Next Steps Checklist

1. [ ] Update `PLAN.md` Phase 5 to include TUI A/B execution tasks.
2. [ ] Create Graphite branches for each spike once ready to implement.
3. [ ] Schedule sync/review to compare prototypes.
4. [ ] After decision, remove unused prototype and land winning approach behind feature flag/preview command.

## References

- opentui docs (link TBD once reviewed).
- React Ink: <https://github.com/vadimdemedes/ink>
- Existing CLI utilities in `packages/cli/src/utils/output.ts` and `packages/cli/src/utils/fs.ts`.

<!-- note ::: revisit this doc after A/B cycle to archive losing approach and formalize follow-ups -->
