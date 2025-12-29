<!-- tldr ::: comprehensive v1.0 release plan aligning docs, CLI, and implementation -->

> **Legacy Document**: This planning document references archived materials in `.agents/.archive/`.
> The project has moved to skill-based configuration. See `CLAUDE.md` for current guidance.

# Waymark v1.0 Release Plan

**Created:** 2025-12-29
**Status:** Planning Complete — Ready for Implementation
**Target:** v1.0.0-beta.2 (or rename to v1.0.0-rc.1)

## Background

This plan addresses the gaps identified in the [v1 Audit](./AUDIT.md). The core finding: documentation describes v1.0-beta aspirations while implementation is at v0.x level in several areas. This plan reconciles that gap through a "docs down + code up" balanced approach — deprecating features we don't need while implementing what matters.

## Guiding Principles

1. **Waymarks are not docstrings** — They complement JSDoc/TSDoc/docstrings, never replace them
2. **Grep-first** — Every feature must remain discoverable via simple text search
3. **Agent-friendly** — Structured output that automation can parse and act on
4. **Progressive adoption** — Support legacy codetags alongside native waymarks

---

## Decision Summary

| Item | Decision | Rationale |
|------|----------|-----------|
| Block comments (`/* */`) | Restrict | Line comments preferred; block comments allowed only for languages without line comments (CSS) |
| `wm map` command | Remove | No longer needed; using other approaches for codebase overview |
| `--jsonl` flag | Implement | Half-done, valid use case, silent failure is bad UX |
| Lint rules | Implement 3 | `unknown-marker`, `duplicate-property`, `multiple-tldr` with named-only scheme |
| Migrate command | Replace | Becomes `legacy-pattern` lint rule + `include_codetags` config |
| Format paths | Implement | Directory/glob support with smart filtering |
| History tracking | Wire up | Infrastructure exists, just needs integration |
| Protected branch policy | Remove | Unnecessary complexity for launch |
| Docstring clarity | Add | Prominent positioning in README and GRAMMAR.md |

---

## Phase 1: Grammar & Parser Cleanup

### 1.1 Clarify Block Comment Policy in Docs

**Policy:** Line comments are the **preferred** form. Block comments (`/* */`) are allowed **only** for languages that lack line comments (e.g., CSS).

**Files to modify:**

- `README.md` — Update examples to use line comments; add note about CSS exception
- `docs/GRAMMAR.md` — Update comment leader table to mark `/* */` as "CSS/languages without line comments only"
- `PRD.md` — Clarify block comment restriction in grammar section
- `.waymark/rules/WAYMARKS.md` — Add explicit guidance on when block comments are acceptable

**Documentation updates needed:**

- Add explicit callout: "Line comments (`//`, `#`, `--`) are preferred. Block comments (`/* */`) should only be used in languages that lack line comments (CSS, legacy XML)."
- Add lint guidance: Using block comments in JS/TS when line comments are available may trigger a warning
- CSS example: `/* tldr ::: stylesheet for login form #ui/auth */`

**Verification:**

```bash
# Check that JS/TS examples don't use block comments for waymarks
rg "\/\*.*:::" --type ts --type js  # Should be empty or intentional CSS-like files only
```

**Notes:**

- Continuation syntax (`// ::: continued`) handles multi-line needs for languages with line comments
- Parser already supports block comments; this is about documentation and lint guidance
- CSS files legitimately need block comments since CSS has no line comment syntax

### 1.2 Verify Continuation Waymarks

**Status:** Already implemented (confirmed by audit)

**Verification tasks:**

- [ ] Run existing continuation tests: `bun test packages/grammar/src/parser.test.ts`
- [ ] Run formatter continuation tests: `bun test packages/core/src/format.test.ts`
- [ ] Manually verify examples in docs match actual behavior

**Documentation check:**

- [ ] `PRD.md` multi-line section is accurate
- [ ] `docs/GRAMMAR.md` continuation examples work
- [ ] `.waymark/rules/WAYMARKS.md` examples are correct

### 1.3 Remove `wm map` Command Entirely ✅ COMPLETED (2025-12-29)

**Rationale:** The `wm map` command is no longer needed. Codebase overview functionality is handled through other means.

**Status:** All map functionality removed across CLI, MCP server, core package, and documentation. Commits: 49c64e5 (code removal), a867253 (doc cleanup).

**Files to modify:**

1. **`packages/cli/src/index.ts`**
   - Remove `handleMapCommand` function
   - Remove map command registration from command router
   - Remove map-related imports
   - Remove `--map` from help text and examples

2. **`packages/cli/src/utils/map-rendering.ts`**
   - Delete entire file (or keep if utilities are used elsewhere—verify first)

3. **`packages/cli/src/commands/unified/`** (if map integrated there)
   - Remove any `--map` flag handling
   - Remove `isMapMode` from types/parser

4. **Help files** (if they exist)
   - Delete `packages/cli/src/commands/map.help.ts`
   - Delete `packages/cli/src/commands/map.prompt.ts`

5. **Tests**
   - Remove map-related tests from `packages/cli/src/index.test.ts`
   - Remove any dedicated map test files

6. **Documentation**
   - `README.md` — Remove `wm map` examples and references
   - `PRD.md` — Remove map command from CLI specification
   - `docs/` — Remove any map-specific documentation

**Verification:**

```bash
# Ensure no map references remain in CLI
rg "map" packages/cli/src/ --type ts -l  # Review each match
rg "wm map" --type md  # Should return no results after cleanup

# Ensure CLI still works
wm --help  # Should not show map command
wm map     # Should show "unknown command" error
```

**Notes:**

- The `--prompt` flag that was documented but never implemented is also removed with this change
- Any map-related utilities in `@waymarks/core` should be audited for removal too

---

## Phase 2: CLI Flag & Output Fixes

### 2.1 Implement `--jsonl` in Unified Parser

**Problem:** `wm find --jsonl` silently outputs text because unified parser ignores the flag.

**Files to modify:**

1. **`packages/cli/src/utils/flags/json.ts`**
   - Extend `handleJsonFlag()` to recognize both `--json` and `--jsonl`
   - Change state from `json: boolean` to `format: "json" | "jsonl" | null`

   ```typescript
   // Before
   export function handleJsonFlag(token: string | undefined, state: JsonFlagState): boolean {
     if (!matchesFlag(token, ["--json"])) {
       return false;
     }
     state.json = true;
     return true;
   }

   // After
   export type OutputFormat = "json" | "jsonl" | "text";

   export function handleOutputFormatFlag(token: string | undefined, state: FormatFlagState): boolean {
     if (matchesFlag(token, ["--json"])) {
       state.outputFormat = "json";
       return true;
     }
     if (matchesFlag(token, ["--jsonl"])) {
       state.outputFormat = "jsonl";
       return true;
     }
     return false;
   }
   ```

2. **`packages/cli/src/commands/unified/types.ts`**
   - Update `UnifiedCommandOptions` to use `outputFormat` instead of `json: boolean`

3. **`packages/cli/src/commands/unified/parser.ts`**
   - Update to call new handler
   - Update state type

4. **`packages/cli/src/commands/unified/index.ts`**
   - Pass `outputFormat` to `renderRecords()` instead of hardcoded `"json"`

**Tests to add:**

- `packages/cli/src/commands/unified/index.test.ts`:
  - Test `--json` produces JSON array
  - Test `--jsonl` produces newline-delimited JSON
  - Test default produces text

**Verification:**

```bash
wm find src/ --json | head -1   # Should start with [
wm find src/ --jsonl | head -1  # Should be single JSON object
wm find src/ | head -1          # Should be formatted text
```

---

## Phase 3: Lint System Overhaul

### 3.1 Rename Lint Rules to Named-Only Scheme

**Old scheme:** WM001, WM010, WM020, etc.
**New scheme:** `unknown-marker`, `duplicate-property`, `multiple-tldr`, `legacy-pattern`

**Files to modify:**

1. **`packages/cli/src/commands/lint.ts`**
   - Refactor to support multiple named rules
   - Create rule registry pattern

2. **`packages/cli/src/commands/lint.help.ts`**
   - Update rule documentation
   - Remove WM0XX codes

3. **`packages/cli/src/commands/lint.prompt.ts`**
   - Update rule descriptions

4. **`packages/cli/src/index.ts`**
   - Update help text (lines ~1367-1384)
   - Update examples

5. **`PRD.md`**
   - Update "Linter Rules & Codes" section (lines ~518-526)

### 3.2 Implement `duplicate-property` Rule

**Logic:**

- Parse waymark content for properties
- Track property keys per waymark
- Flag duplicates (last wins, but warn)

**Implementation location:** `packages/cli/src/commands/lint.ts`

```typescript
interface LintRule {
  name: string;
  check: (record: WaymarkRecord, context: LintContext) => LintIssue[];
}

const duplicatePropertyRule: LintRule = {
  name: "duplicate-property",
  check: (record, context) => {
    const seen = new Map<string, number>();
    const issues: LintIssue[] = [];

    for (const [key, value] of Object.entries(record.properties)) {
      // Parser already keeps last value, but we can detect from raw
      // Need to scan raw content for duplicate keys
    }

    return issues;
  }
};
```

**Note:** May need grammar-level support to detect duplicates since parser keeps last value. Check if `extractPropertiesAndRelations` can report duplicates.

### 3.3 Implement `multiple-tldr` Rule

**Logic:**

- Group records by file
- Count `tldr` markers per file
- Flag files with > 1 tldr

**Implementation:**

```typescript
const multipleTldrRule: LintRule = {
  name: "multiple-tldr",
  check: (records: WaymarkRecord[], context: LintContext) => {
    const tldrsByFile = new Map<string, WaymarkRecord[]>();

    for (const record of records) {
      if (record.marker === "tldr") {
        const list = tldrsByFile.get(record.file) || [];
        list.push(record);
        tldrsByFile.set(record.file, list);
      }
    }

    const issues: LintIssue[] = [];
    for (const [file, tldrs] of tldrsByFile) {
      if (tldrs.length > 1) {
        for (const tldr of tldrs.slice(1)) {
          issues.push({
            file,
            line: tldr.startLine,
            rule: "multiple-tldr",
            message: `File already has tldr at line ${tldrs[0].startLine}`,
            severity: "error"
          });
        }
      }
    }

    return issues;
  }
};
```

### 3.4 Implement `legacy-pattern` Rule

**Logic:**

- Scan for codetag patterns: `TODO:`, `FIXME:`, `NOTE:`, `HACK:`, `XXX:`
- Support multiple comment leaders: `//`, `#`, `--`
- Report location and suggest waymark equivalent

**Patterns to detect:**

| Legacy | Suggested |
|--------|-----------|
| `// TODO:` | `// todo :::` |
| `// FIXME:` | `// fix :::` |
| `// NOTE:` | `// note :::` |
| `// HACK:` | `// hack :::` |
| `// XXX:` | `// fix :::` |
| `# TODO:` | `# todo :::` |
| `# FIXME:` | `# fix :::` |
| `-- TODO:` | `-- todo :::` |

**Implementation:**

```typescript
const CODETAG_PATTERNS = [
  { regex: /\/\/\s*TODO\s*:/gi, leader: "//", marker: "todo" },
  { regex: /\/\/\s*FIXME\s*:/gi, leader: "//", marker: "fix" },
  { regex: /\/\/\s*NOTE\s*:/gi, leader: "//", marker: "note" },
  { regex: /\/\/\s*HACK\s*:/gi, leader: "//", marker: "hack" },
  { regex: /\/\/\s*XXX\s*:/gi, leader: "//", marker: "fix" },
  { regex: /#\s*TODO\s*:/gi, leader: "#", marker: "todo" },
  { regex: /#\s*FIXME\s*:/gi, leader: "#", marker: "fix" },
  { regex: /#\s*NOTE\s*:/gi, leader: "#", marker: "note" },
  { regex: /--\s*TODO\s*:/gi, leader: "--", marker: "todo" },
  { regex: /--\s*FIXME\s*:/gi, leader: "--", marker: "fix" },
];

const legacyPatternRule: LintRule = {
  name: "legacy-pattern",
  check: (source: string, file: string) => {
    const issues: LintIssue[] = [];
    const lines = source.split("\n");

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      for (const pattern of CODETAG_PATTERNS) {
        if (pattern.regex.test(line)) {
          issues.push({
            file,
            line: i + 1,
            rule: "legacy-pattern",
            message: `Legacy codetag found. Consider: "${pattern.leader} ${pattern.marker} :::"`,
            severity: "warn"
          });
        }
        pattern.regex.lastIndex = 0; // Reset regex state
      }
    }

    return issues;
  }
};
```

### 3.5 Add `include_codetags` Config Option

**Purpose:** When enabled, `wm find` surfaces legacy codetags as quasi-waymarks.

**Files to modify:**

1. **`packages/core/src/types.ts`**
   - Add to `WaymarkConfig`:

   ```typescript
   scan?: {
     include_codetags?: boolean;
   };
   ```

2. **`packages/core/src/config.ts`**
   - Add default: `include_codetags: false`

3. **`packages/core/src/scan.ts`** (or equivalent)
   - When `include_codetags` enabled, also scan for codetag patterns
   - Return records with `legacy: true` flag

4. **`packages/grammar/src/types.ts`**
   - Add `legacy?: boolean` to `WaymarkRecord`

**Record shape when legacy:**

```json
{
  "file": "src/auth.ts",
  "startLine": 42,
  "marker": "todo",
  "contentText": "fix this later",
  "legacy": true,
  "raw": "// TODO: fix this later"
}
```

### 3.6 Remove Migrate Command (or Repurpose)

**Option A: Remove entirely**

- Delete `packages/cli/src/commands/migrate.ts`
- Delete `packages/cli/src/commands/migrate.help.ts`
- Delete `packages/cli/src/commands/migrate.prompt.ts`
- Remove from `packages/cli/src/index.ts`
- Update docs to remove `wm migrate` references

**Option B: Repurpose as alias**

- `wm migrate` becomes `wm lint --rule legacy-pattern`
- Keep for discoverability
- Update help text

**Recommendation:** Option A (remove). Users can run `wm lint` and see `legacy-pattern` results.

### 3.7 (Optional) Implement `prefer-line-comment` Rule

**Purpose:** Warn when block comments are used for waymarks in languages that have line comments available.

**Logic:**

- Check if waymark uses `/* */` comment leader
- Check if file extension indicates a language with line comments (js, ts, jsx, tsx, go, rust, etc.)
- If both true, emit warning suggesting line comment form

**Implementation:**

```typescript
const LANGUAGES_WITH_LINE_COMMENTS = new Set([
  'js', 'jsx', 'ts', 'tsx', 'mjs', 'cjs',  // JavaScript/TypeScript
  'go',                                      // Go
  'rs',                                      // Rust
  'c', 'cpp', 'cc', 'h', 'hpp',             // C/C++
  'java', 'kt', 'kts',                       // Java/Kotlin
  'swift',                                   // Swift
  'php',                                     // PHP
  // CSS, HTML, XML, etc. are NOT in this list
]);

const preferLineCommentRule: LintRule = {
  name: "prefer-line-comment",
  check: (record, context) => {
    if (record.commentLeader?.startsWith("/*")) {
      const ext = context.file.split('.').pop()?.toLowerCase();
      if (ext && LANGUAGES_WITH_LINE_COMMENTS.has(ext)) {
        return [{
          file: context.file,
          line: record.startLine,
          rule: "prefer-line-comment",
          message: `Block comment waymark in ${ext} file. Consider using line comment: "// ${record.marker} :::"`,
          severity: "warn"
        }];
      }
    }
    return [];
  }
};
```

**Note:** This rule is optional and can be disabled via config. It helps enforce the "line comments preferred" policy without breaking CSS support.

---

## Phase 4: Format Command Enhancements

### 4.1 Add Directory/Glob Support

**Files to modify:**

1. **`packages/cli/src/commands/fmt.ts`**
   - Use `expandInputPaths()` instead of single file read
   - Iterate over expanded paths

2. **`packages/cli/src/index.ts`**
   - Update `handleFormatCommand` to handle multiple paths

**Implementation sketch:**

```typescript
import { expandInputPaths } from "../utils/fs.js";

export async function handleFormatCommand(
  program: Command,
  paths: string[],
  options: FormatOptions
): Promise<void> {
  const pathsToFormat = paths.length > 0 ? paths : ["."];
  const expandedPaths = await expandInputPaths(pathsToFormat, {
    // respect skip_paths from config
  });

  // Pre-filter: only files containing :::
  const filesWithWaymarks = await filterFilesWithWaymarks(expandedPaths);

  for (const filePath of filesWithWaymarks) {
    // Skip if waymark-ignore-file
    if (await hasIgnoreMarker(filePath)) continue;

    await formatFile(filePath, options);
  }
}

async function filterFilesWithWaymarks(paths: string[]): Promise<string[]> {
  const results: string[] = [];
  for (const p of paths) {
    const content = await Bun.file(p).text();
    if (content.includes(":::")) {
      results.push(p);
    }
  }
  return results;
}
```

### 4.2 Add Default Skip Patterns

**Files to modify:**

1. **`packages/core/src/config.ts`**
   - Extend default `skip_paths`:

   ```typescript
   skip_paths: [
     "**/dist/**",
     "**/.git/**",
     "**/node_modules/**",
     "**/fixtures/**",
     "**/__fixtures__/**",
     "**/test-data/**",
     "**/*.fixture.*",
     "**/*.invalid.*",
   ],
   ```

### 4.3 Implement `waymark-ignore-file` Marker

**Concept:** If a file's first comment containing `:::` is `// waymark-ignore-file`, skip it.

**Implementation:**

```typescript
async function hasIgnoreMarker(filePath: string): Promise<boolean> {
  const content = await Bun.file(filePath).text();
  const lines = content.split("\n");

  for (const line of lines) {
    const trimmed = line.trim();
    // Skip empty lines and shebangs
    if (!trimmed || trimmed.startsWith("#!")) continue;

    // Check for ignore marker
    if (/^\s*(\/\/|#|--)\s*waymark-ignore-file/.test(line)) {
      return true;
    }

    // If we hit a non-comment line, stop looking
    if (!trimmed.startsWith("//") && !trimmed.startsWith("#") &&
        !trimmed.startsWith("--") && !trimmed.startsWith("<!--")) {
      break;
    }
  }

  return false;
}
```

---

## Phase 5: History Tracking Integration

### 5.1 Wire Up Remove History

**Problem:** `WaymarkIdManager.remove()` calls `delete()` without history metadata.

**Files to modify:**

1. **`packages/core/src/ids.ts`**
   - Update `remove()` to accept and pass history metadata:

   ```typescript
   async remove(id: string, options?: { reason?: string }): Promise<void> {
     const normalized = this.normalizeId(id);
     const existing = await this.index.get(normalized);

     await this.index.delete(normalized, {
       removedBy: "cli",
       reason: options?.reason,
       // Include original waymark data for potential restore
       originalRecord: existing,
     });
   }
   ```

2. **`packages/cli/src/commands/remove.ts`** (or index.ts handler)
   - Add `--reason` flag
   - Pass reason to manager

3. **`packages/core/src/id-index.ts`**
   - Verify `delete()` properly writes to history when called with metadata
   - Test history.json is created and populated

**Tests to add:**

- Remove a waymark with `--reason`
- Verify history.json contains the entry
- Verify entry has `removedAt`, `removedBy`, `reason`, original data

### 5.2 Document History Behavior

**Files to update:**

- `README.md` — Brief mention of history tracking
- `PRD.md` — Update "Repository Artifacts" section
- CLI help text — Document `--reason` flag

---

## Phase 6: Remove Protected Branch Policy

### 6.1 Strip from Config

**Files to modify:**

1. **`packages/core/src/types.ts`**
   - Remove `signals_on_protected` from `WaymarkConfig`
   - Remove `protected_branches` from `WaymarkConfig`

2. **`packages/core/src/config.ts`**
   - Remove defaults for these fields

3. **`.waymark/config.toml`** (project config)
   - Remove `protected_branches` and `signals_on_protected`

4. **`packages/cli/src/commands/doctor.ts`**
   - Remove protected branch checks (lines ~426-455)

5. **`PRD.md`**
   - Remove from config example
   - Remove from prose

6. **`docs/GRAMMAR.md`**
   - Remove any protected branch references

---

## Phase 7: Docstring Clarity

### 7.1 Add README Section

**Location:** After "Why Waymarks Exist", before "Waymarks in Practice"

**Content:**

```markdown
### Waymarks Are Not Docstrings

Waymarks complement documentation comments — they don't replace them.

| Purpose | Tool |
|---------|------|
| API contracts for consumers | JSDoc, TSDoc, docstrings |
| Breadcrumbs for maintainers & agents | Waymarks |

**Docstrings** describe *what* code does for external consumers. **Waymarks** capture *why*, *who*, and *what's next* for internal maintainers.

Place waymarks **adjacent to** docstrings, never inside them:

```typescript
/**
 * Authenticates a user and returns a session token.
 * @param credentials - User login credentials
 * @returns Session token or throws AuthError
 */
// this ::: orchestrates OAuth flow with PKCE #auth/login
// todo ::: @agent add rate limiting #sec:boundary
export async function authenticate(credentials: Credentials): Promise<Session> {
  // ...
}
```

The docstring serves TypeScript tooling and API consumers. The waymarks serve you, your team, and your agents.

```

### 7.2 Add GRAMMAR.md Section

**Location:** Near the top, after "Overview"

**Content:** Similar to README but slightly more technical, emphasizing the grammar distinction.

### 7.3 Audit Existing Examples

**Task:** Review all examples in docs to ensure:
- [ ] No waymark content duplicates what a docstring should say
- [ ] Examples show waymarks adjacent to (not inside) doc-comments
- [ ] Block comment examples are removed
- [ ] Continuation examples use line comments only

**Files to audit:**
- `README.md`
- `PRD.md`
- `docs/GRAMMAR.md`
- `.waymark/rules/WAYMARKS.md`
- `.waymark/rules/DOCSTRING-COMPATIBILITY.md`
- `.waymark/rules/TLDRs.md`
- `.waymark/rules/THIS.md`

---

## Phase 8: Documentation Alignment

### 8.1 Update README.md

- [ ] Update block comment examples to clarify CSS-only usage
- [ ] Add "Waymarks Are Not Docstrings" section
- [ ] Update CLI usage to reflect changes
- [x] Remove `wm map` examples and references ✅ (2025-12-29)
- [ ] Remove `wm migrate` references (or update if aliased)
- [ ] Add `include_codetags` config mention

### 8.2 Update PRD.md

- [ ] Clarify block comment policy (CSS-only, not full deprecation)
- [x] Remove `wm map` from CLI specification ✅ (2025-12-29)
- [ ] Update lint rules section (named-only scheme)
- [ ] Remove protected branch policy
- [ ] Update config example
- [ ] Update milestones to reflect current state

### 8.3 Update docs/GRAMMAR.md

- [ ] Update `/* */` in comment leader table to note "CSS/languages without line comments only"
- [ ] Add docstring clarity section
- [ ] Update lint rules documentation
- [ ] Ensure JS/TS examples use line comments (block comments only in CSS examples)

### 8.4 Update Help Text

**File:** `packages/cli/src/index.ts`

- [x] Remove `wm map` from help and command list ✅ (2025-12-29)
- [ ] Update `wm lint` help with new rule names
- [ ] Remove `wm migrate` (or update)
- [ ] Update `wm format` examples to show directory usage
- [ ] Add `--reason` to `wm remove` help

---

## Testing Checklist

### Unit Tests

- [ ] `--jsonl` flag parsing in unified parser
- [ ] `--jsonl` output format correctness
- [ ] `duplicate-property` lint rule
- [ ] `multiple-tldr` lint rule
- [ ] `legacy-pattern` lint rule
- [ ] `include_codetags` config parsing
- [ ] Legacy codetag detection
- [ ] Format with directory input
- [ ] Format with `waymark-ignore-file`
- [ ] History tracking on remove

### Integration Tests

- [ ] `wm find src/ --jsonl` produces valid JSONL
- [ ] `wm lint src/` reports all rule types
- [ ] `wm format . --write` respects skip patterns
- [ ] `wm remove <id> --reason "test"` writes to history

### Manual Verification

- [ ] `rg ":::"` still finds all waymarks (grep-first principle)
- [ ] Continuation waymarks render correctly
- [ ] Config file loading works at all scopes
- [ ] Help text is accurate for all commands

---

## Implementation Order

**Recommended sequence (by dependency and risk):**

1. **Phase 1** (Grammar cleanup) — Low risk, unblocks docs work
2. **Phase 7** (Docstring clarity) — Can parallelize with Phase 1
3. **Phase 6** (Remove protected branch) — Simple removal
4. **Phase 2** (JSONL fix) — Small, isolated fix
5. **Phase 4** (Format enhancements) — Medium complexity
6. **Phase 3** (Lint overhaul) — Largest change, highest value
7. **Phase 5** (History wiring) — Depends on understanding ID system
8. **Phase 8** (Docs alignment) — Final pass after code changes

---

## Success Criteria

Before tagging release:

- [ ] `bun check:all` passes
- [ ] All new tests pass
- [ ] No documented feature is unimplemented
- [ ] No implemented feature is undocumented
- [ ] README examples all work
- [ ] `wm --help` accurately describes capabilities
- [ ] Docstring distinction is clear in public docs

---

## Open Questions

1. **Lint rule configuration:** Should users be able to disable specific rules via config? (e.g., `lint.rules.legacy-pattern = false`)

2. **JSONL streaming:** Should `--jsonl` stream records as they're found, or buffer like `--json`? (Streaming is more useful for large repos)

3. **History restore:** Should we stub out `wm restore` command, or leave for future? (Leaning: leave for future)

4. **Codetag content parsing:** When `include_codetags` is on, should we parse the content after `TODO:` for properties/tags? (Leaning: no, keep it simple)

---

## References

- [v1 Audit](./AUDIT.md) — Original findings document
- [PRD.md](/.agents/.archive/PRD.md) — Product requirements (archived)
- [PLAN.md](/.agents/.archive/PLAN.md) — Project-level plan (archived)
- [IMPROVEMENTS.md](/.agents/.archive/IMPROVEMENTS.md) — Previous CLI improvements (archived)
- [SCRATCHPAD.md](/.agents/.archive/SCRATCHPAD.md) — Historical worklog (archived)
