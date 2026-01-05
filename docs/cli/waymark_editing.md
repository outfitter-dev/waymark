<!-- tldr ::: comprehensive guide to add, remove, and edit commands for waymark management #docs/cli -->

# Waymark Editing Guide

## Overview

The `wm add` command enables programmatic insertion of waymarks at specific line numbers, supporting both single insertions and batch operations across multiple files. This unlocks automation workflows for code review, TLDR generation, compliance auditing, and integration with external tools.

## Current Scope Adjustments (2025-10-03)

- Keep the core insert/remove pipeline focused: dry-run by default with explicit `--write`, rich JSON specs, and consistent CLI ergonomics.
- Treat waymark IDs as opt-in: prompt on first use, remember the choice per user/project, and persist IDs in a lightweight `.waymark/index.json` file instead of SQLite.
- Defer multi-line insertion and interactive CLI flows until formatting helpers and UX stories are mature.
- Require scoped removals (explicit files or indexed lookups) rather than crawling `**/*`; maintain an incremental JSON index to keep lookups fast without heavy DB machinery and up to date even for manually added waymarks via explicit refresh commands or opt-in git hooks.
- Limit removal edits to the waymark line itself—no automatic blank-line collapsing to avoid noisy diffs.
- Plan for `wm update` specification soon after insert/remove so the ID lifecycle closes, but do not block v1 on it.

## Motivation

Current workflows require manual editing or complex sed/awk scripts to add waymarks. This creates friction for:

- **Code reviewers** leaving structured feedback at specific locations
- **Automation tools** generating TLDRs or documentation waymarks
- **Compliance systems** marking code sections requiring review
- **Migration tools** converting external annotations (GitHub issues, TODOs, etc.)

The add command makes waymarks first-class citizens in automation pipelines.

## Command Interface

### Single Insertion

```bash
# Basic insertion (file:line shorthand)
wm add src/auth.ts:42 --type todo --content "add rate limiting"

# With full metadata
wm add src/auth.ts:42 \
  --type todo \
  --content "add rate limiting" \
  --important \
  --owner @alice \
  --tag "#security" \
  --mention "@agent" \
  --after \
  --write

# Dry run (default)
wm add src/auth.ts:42 --type note --content "assumes UTC timestamps"

# Write to file
wm add src/auth.ts:42 --type note --content "assumes UTC timestamps" --write
```

<!-- note ::: Fresh v1 CLI expects the `file:line` positional form. Supporting `--file/--line` again in the future would be a deliberate addition, not a constraint. -->

> **No per-type shortcuts.** Earlier explorations considered auto-generating flags like `--todo` or `--note`; v1 keeps the interface explicit with `--type <marker>` (and arbitrary custom markers) to avoid multiplying flag permutations.

### Batch Insertion

```bash
# From JSON file
wm add --from insertions.json --write

# From stdin
cat insertions.json | wm add --from - --json
```

> **Why JSON-first?** Supporting multi-command-line positional inserts proved confusing and brittle. For more than one insertion (including multi-line blocks or multiple waymarks targeting the same anchor), rely on JSON specs so validation, ordering, and metadata stay unambiguous.
> The bare CLI form remains optimized for single inserts (`wm add FILE:LINE ...`).

**Ordering & Multi-line Tips**

- When several waymarks target the same `file:line`, add an `order` number. Lower numbers insert closer to the anchor before higher numbers.
- Multi-line waymarks remain JSON-only via the `continuations` array. Each entry becomes an additional formatted line following the header comment.

### Output Formats

```bash
# Human-readable (default)
wm add --from batch.json

# JSON for tooling
wm add --from batch.json --json

# JSONL for streaming
wm add --from batch.json --jsonl
```

### JSON Input Schema

### Single Insertion Object

```json
{
  "file": "src/auth.ts",
  "line": 42,
  "position": "after",
  "type": "todo",
  "content": "add rate limiting",
  "signals": {
    "raised": false,
    "important": true
  },
  "properties": {
    "owner": "@alice",
    "ref": "#auth/rate-limit"
  },
  "tags": ["#security", "#perf"],
  "mentions": ["@agent"]
}
```

### Batch Insertion File

```json
{
  "insertions": [
    {
      "file": "src/auth.ts",
      "line": 42,
      "type": "todo",
      "content": "add rate limiting",
      "signals": { "important": true }
    },
    {
      "file": "src/auth.ts",
      "line": 100,
      "position": "before",
      "type": "note",
      "content": "assumes valid JWT tokens"
    },
    {
      "file": "src/database.ts",
      "line": 15,
      "type": "tldr",
      "content": "postgres connection pool with retry logic",
      "properties": { "ref": "#db/pool" }
    },
    {
      "file": "src/auth.ts",
      "line": 42,
      "type": "note",
      "content": "handled in auth middleware",
      "order": 2
    },
    {
      "file": "src/auth.ts",
      "line": 42,
      "type": "todo",
      "content": "audit rate limiter thresholds",
      "order": 1
    }
  ],
  "options": {
    "write": true,
    "format": true
  }
}
```

### Field Definitions

| Field | Type | Required | Default | Description |
| ----- | ---- | -------- | ------- | ----------- |
| `file` | string | ✅ | - | File path (relative or absolute) |
| `line` | number | ✅ | - | Line number for insertion (1-indexed) |
| `position` | "before" \| "after" | ❌ | "after" | Insert before or after target line |
| `type` | string | ✅ | - | Waymark type (todo, note, tldr, etc.) |
| `content` | string | ✅ | - | Waymark content text |
| `signals` | object | ❌ | {} | Signal flags (raised, important) |
| `properties` | object | ❌ | {} | Key-value properties |
| `tags` | string[] | ❌ | [] | Hashtags (without # prefix in array) |
| `mentions` | string[] | ❌ | [] | Actor mentions (without @ prefix in array) |
| `id` | string | ❌ | auto | Stable waymark ID (see ID System below) |
| `order` | number | ❌ | auto | Explicit relative ordering when multiple waymarks target the same anchor |
| `continuations` | string[] | ❌ | [] | Additional lines for multi-line waymarks (JSON-only feature, formatted sequentially) |

## Waymark ID System

### Overview

Programmatically inserted waymarks can include a stable, unique ID via the `wm:` property. This enables tracking, updating, and removing specific waymarks across file modifications and refactors.

### ID Format

```text
wm:<base36-hash>
```

- **Prefix**: `wm:` (waymark identifier)
- **Hash**: 7-9 character base36 string (lowercase letters + digits)
- **Uniqueness**: Repository-scoped collision resistance
- **Example**: `wm:a3k9m2p`, `wm:7xqn4vw8z`

<!-- ask ::: @agent could we store it as `wid=<wid>` instead of a hard-coded `wm:` in the ID? And present them as `wm:<wid>`? -->
<!-- reply ::: The waymark content will use `wm:a3k9m2p` as a property. The database column is named `wid` (waymark ID). So content: `owner:@alice wm:a3k9m2p`, DB column: `wid` storing `a3k9m2p`. -->

### ID Generation Algorithm

**Approach**: Content-addressed hash with timestamp salt for uniqueness.

```typescript
function generateWaymarkId(insertion: InsertionSpec, timestamp: number): string {
  // Create deterministic input from waymark content
  const input = [
    insertion.file,
    insertion.type,
    insertion.content,
    timestamp.toString()
  ].join('|');

  // Hash with fast algorithm (xxHash or similar)
  const hash = xxHash64(input);

  // Convert to base36 and truncate to 7-9 chars
  const base36 = hash.toString(36).toLowerCase();

  // Take first 8 characters for good collision resistance
  const id = base36.substring(0, 8);

  return `wm:${id}`;
}
```

### Collision Resistance

**Probability Analysis:**

- 8 chars base36 = 36^8 = ~2.8 trillion combinations
- Birthday paradox: 50% collision at ~1.7M waymarks
- For typical codebases (<100K waymarks), collision risk < 0.001%

**Collision Handling:**

1. Check existing IDs in repository cache
2. If collision detected, append incremental suffix: `wm:a3k9m2p-2`
3. Record in `.waymark/index.json` for future lookups

### Usage in Waymarks

IDs appear as a property in the waymark content:

```typescript
// todo ::: add rate limiting owner:@alice #security wm:a3k9m2p
```

**Format Rules:**

- ID appears as property: `wm:a3k9m2p`
- Database column name: `wid` (stores just the hash: `a3k9m2p`)
- ID property comes last (conventionally, not enforced)
- Space-separated from other properties
- Searchable via `wm --id wm:a3k9m2p` or `wm --id a3k9m2p` (prefix optional)

### ID Lifecycle

**Creation (Insert):**

```bash
# Auto-generate ID
wm add src/auth.ts --line 42 --type todo --content "add rate limiting" --write

# Returns:
{
  "inserted": {
    "line": 43,
    "id": "wm:a3k9m2p",
    "content": "// todo ::: add rate limiting wm:a3k9m2p"
  }
}
```

**Explicit ID (Insert):**

```json
{
  "file": "src/auth.ts",
  "line": 42,
  "type": "todo",
  "content": "add rate limiting",
  "id": "wm:a3k9m2p"
}
```

**Update by ID:**

```bash
# Find and update specific waymark
wm update wm:a3k9m2p --content "add rate limiting with exponential backoff" --write

# Or via JSON
{
  "updates": [
    {
      "id": "wm:a3k9m2p",
      "content": "add rate limiting with exponential backoff"
    }
  ]
}
```

> **Note**: `wm update` command is implied by the ID system but not fully specified in this doc. It would follow similar patterns to insert/remove with ID-based targeting. Consider adding full `wm update` specification in future iteration.

**Remove by ID:**

```bash
wm rm --id wm:a3k9m2p --write
```

**Query by ID:**

```bash
# Find waymark location
wm find --id wm:a3k9m2p

# Returns:
{
  "file": "src/auth.ts",
  "line": 43,
  "type": "todo",
  "content": "add rate limiting wm:a3k9m2p owner:@alice"
}
```

### ID Index Storage

Track active IDs in a lightweight `.waymark/index.json` file that stays in sync with the workspace. The file stores a normalized array of records so agents can resolve IDs without rescanning the entire repo.

```jsonc
{
  "version": 1,
  "ids": {
    "wm:a3k9m2p": {
      "file": "src/auth.ts",
      "line": 43,
      "type": "todo",
      "content": "add rate limiting",
      "source": "@alice",
      "sourceType": "cli",
      "updatedAt": "2025-10-03T04:12:00Z",
      "contentHash": "sha1-abc123",
      "contextHash": "sha1-def456"
    }
  },
  "files": {
    "src/auth.ts": {
      "hash": "sha1-…",
      "lastSeen": "2025-10-03T04:12:00Z"
    }
  }
}
```

- Repo-local JSON keeps dependencies simple and diffable.
- Automatic writes occur after each CLI insert/remove so hot paths stay in sync without rescanning.
- Optional `.waymark/history.json` captures tombstoned waymarks for undo, storing the same payload plus `removedAt`/`removedBy` and optional `reason` metadata.
- The files stay gitignored by default, but history can be committed for shared undo if a team wants it.
- Run `wm index --refresh` to crawl the repo on demand (CI, pre-commit, manual). The refresher hashes files so unchanged paths are skipped; a `--changed-since <ref>` flag scopes even tighter.
- Optional hook helpers (`wm hook install`) can wire refreshes into git events such as `pre-commit`, `pre-push`, or `post-checkout`; triggers are controlled through config (see `[index].refresh_triggers`).
- On every CLI invocation we check index freshness (no background daemon required); if the last refresh is older than the configured threshold we offer (or auto-run) `wm index --refresh --changed-since <ref>` depending on `[index].auto_refresh_after_minutes` and trigger policy.
- When any refresher runs, it can optionally assign IDs to newly discovered waymarks based on configuration (see `[ids].assign_on_refresh`).
- Each index entry stores both an ID (if present) and a fingerprint pair (`contentHash`, `contextHash`) so we can match drifted waymarks even when IDs are absent.

#### Fingerprint Strategy

- `contentHash`: hash of the canonicalized waymark content (type + text + properties). Updates whenever the content changes.
- `contextHash`: hash of a sliding window (e.g., the two lines above/below plus indentation) to survive line moves.
- Matching precedence during refresh:
  1. **ID match** (exact string) – most reliable.
  2. **Content hash** – catches edits that keep semantics but change location.
  3. **Context hash + fuzzy line distance** – handles renames/moves.
  4. If no match, treat as new waymark; optionally assign a fresh ID when `assign_on_refresh = true`.
- Fingerprints let us keep the index authoritative even if a waymark lacks an inline ID: manual edits remain trackable, and we can offer the user a prompt to adopt IDs for orphaned entries.
- Hook integration example:

  ```bash
  # Wire refresh into git hooks
  wm hook install --trigger pre-commit --command "wm index --refresh --changed-since HEAD"
  ```

### Configuration Options

Control ID behavior via `.waymark/config.toml`:

```toml
[ids]
# How to handle IDs: "prompt" (ask once), "auto" (always), or "off"
mode = "prompt"

# ID length (7-9 characters)
length = 8

# Persist user-level override so agents can opt in once
remember_user_choice = true

# Track ID history in .waymark/history.json for undo support
track_history = true

[index]
# CLI refresh triggers; supported values include "manual", "pre-commit", "pre-push", "post-checkout", "ci"
refresh_triggers = ["manual", "pre-commit"]

# Minutes after which the CLI auto-prompts for a refresh (set to 0 to disable automatic checks)
auto_refresh_after_minutes = 10

# Assign IDs to newly discovered waymarks during refresh when mode != "off"
assign_on_refresh = false
```

### Add Command Use Cases

**1. Update Specific Waymark**

```bash
# Original insertion
wm add src/auth.ts --line 42 --type todo --content "implement OAuth" --write
# Returns: wm:x7k2n4m

# Later, update without knowing line number
wm update wm:x7k2n4m --content "implement OAuth with PKCE" --write
```

**2. Track Waymark Across Refactors**

```bash
# File refactored, lines changed, but ID stays the same
wm find --id wm:x7k2n4m

# Still finds waymark even if moved to different file/line
```

**3. Automated Review Workflow**

```json
// GitHub Action inserts review comments with IDs
{
  "insertions": [
    {
      "file": "src/auth.ts",
      "line": 42,
      "type": "review",
      "content": "missing input validation",
      "id": "wm:gh42-rev1",
      "properties": { "github": "#42" }
    }
  ]
}

// Later, after fixes, remove by ID
wm rm --id wm:gh42-rev1 --write
```

**4. Task Management Integration**

```bash
# Linear/Jira creates waymarks with task IDs
wm add src/api.ts --line 100 \
  --type todo \
  --content "implement pagination" \
  --id "wm:lin-1234" \
  --property "linear:ENG-1234" \
  --write

# When task completes, remove by ID
wm rm --id wm:lin-1234 --write
```

**5. Code Generation Markers**

```typescript
// Codegen tool marks generated sections
wm add src/generated.ts --line 1 \
  --type note \
  --content "generated by codegen v2.1.0" \
  --id "wm:gen-header" \
  --write

// Later, find and update generator version
wm update wm:gen-header --content "generated by codegen v2.2.0" --write
```

### ID Namespace Conventions

For external integrations, use prefixed IDs:

```text
wm:gh<pr>-<n>      # GitHub PR comments (e.g., wm:gh42-rev1)
wm:lin-<task>      # Linear tasks (e.g., wm:lin-1234)
wm:jira-<key>      # Jira tickets (e.g., wm:jira-eng123)
wm:gen-<name>      # Code generation (e.g., wm:gen-header)
wm:bot-<ts>        # Bot-generated (e.g., wm:bot-1234567)
```

**Benefits:**

- Immediately identify source of waymark
- Avoid collisions across integrations
- Enable integration-specific cleanup

<!-- note ::: Keep integration namespaces as separate properties (github:#42, linear:ENG-1234) rather than in the wm: ID itself to avoid collision risk. -->

### Implementation Details

```typescript
// packages/core/src/ids.ts

export interface WaymarkIdConfig {
  mode: "auto" | "prompt" | "off" | "manual";
  length: number;
  track_history: boolean;
}

interface IdIndexStore {
  has(id: string): Promise<boolean>;
  set(entry: IdIndexEntry): Promise<void>;
  update(id: string, updater: (entry: IdIndexEntry) => IdIndexEntry): Promise<void>;
  get(id: string): Promise<IdIndexEntry | null>;
  delete(id: string): Promise<void>;
}

interface IdIndexEntry {
  id: string;
  file: string;
  line: number;
  type: string;
  content: string;
  source?: string;
  sourceType?: "cli" | "mcp" | "api" | "manual";
  contentHash: string;
  contextHash: string;
  updatedAt: number;
}

export class WaymarkIdManager {
  constructor(
    private store: IdIndexStore,
    private config: WaymarkIdConfig
  ) {}

  /**
   * Generate unique waymark ID
   */
  async generate(spec: InsertionSpec): Promise<string> {
    const timestamp = Date.now();
    let attempts = 0;
    const maxAttempts = 10;

    while (attempts < maxAttempts) {
      const id = generateWaymarkId(spec, timestamp + attempts);

      // Check for collision
      const exists = await this.exists(id);
      if (!exists) {
        return id;
      }

      attempts++;
    }

    // Fallback: append random suffix
    const baseId = generateWaymarkId(spec, timestamp);
    const randomSuffix = Math.random().toString(36).substring(2, 4);
    return `${baseId}${randomSuffix}`;
  }

  /**
   * Check if ID exists
   */
  async exists(id: string): Promise<boolean> {
    return this.store.has(id);
  }

  /**
   * Register new waymark ID
   */
  async register(
    id: string,
    file: string,
    line: number,
    type: string,
    content: string
  ): Promise<void> {
    const fp = fingerprintRecord({ file, line, type, content });
    await this.store.set({
      id,
      file,
      line,
      type,
      content,
      contentHash: fp.contentHash,
      contextHash: fp.contextHash,
      updatedAt: Date.now()
    });
  }

  /**
   * Update waymark location (when file/line changes)
   */
  async update(id: string, file: string, line: number): Promise<void> {
    await this.store.update(id, (entry) => ({
      ...entry,
      file,
      line,
      contextHash: fingerprintContext(file, line),
      updatedAt: Date.now()
    }));
  }

  /**
   * Find waymark by ID
   */
  async find(id: string): Promise<WaymarkLocation | null> {
    const entry = await this.store.get(id);
    return entry ? { file: entry.file, line: entry.line } : null;
  }

  /**
   * Remove waymark ID from tracking
   */
  async remove(id: string): Promise<void> {
    await this.store.delete(id);
  }
}
```

### Security Considerations

**ID Spoofing:**

- IDs are not cryptographically secure
- Don't use for authorization/authentication
- Treat as identifiers, not secrets

**Collision Attacks:**

- Malicious users could try to force collisions
- Mitigation: Include timestamp in hash input
- Track creation time for audit trail

**Privacy:**

- IDs derived from content may leak information
- Don't include sensitive data in content used for ID generation
- Consider hashing with repo-specific salt

### Migration from Manual Waymarks

Add IDs to existing waymarks:

```bash
# Scan all waymarks, assign IDs, write back
wm id --assign-all --write

# Only assign to specific types
wm id --assign --type todo --type review --write

# Preview without writing
wm id --assign-all
```

### Open Questions

**Q9: ID Auto-Generation**

Should IDs be auto-generated by default or opt-in?

**Option A**: Auto-generate for all programmatic insertions
**Option B**: Require explicit `--with-id` flag
**Option C**: Config-based (default off, enable per-repo)

**Recommendation**: Option C (config-based prompt that remembers the choice at user + repo scope)

**Decision**: On first `wm add` run, prompt once: "Auto-generate IDs? (auto / prompt each time / off)" and persist the answer in repo config plus `~/.waymark/config`. Scheduled index refreshes respect the same mode; setting `[ids].assign_on_refresh = true` promotes newly discovered waymarks to have IDs during background scans.

**Q10: ID Persistence**

Where should IDs be tracked?

**Option A**: Only in waymark content (property-based)
**Option B**: Waymark content + JSON index file (`.waymark/index.json`)
**Option C**: Only in JSON index (invisible to users)

**Recommendation**: Option B (dual tracking for reliability)

**Decision**: Dual tracking (content + JSON index)

**Q11: ID Format Length**

What ID length provides best tradeoff?

**Option A**: 7 chars (36^7 = ~78B combinations)
**Option B**: 8 chars (36^8 = ~2.8T combinations)
**Option C**: 9 chars (36^9 = ~101T combinations)

**Recommendation**: Option B (8 chars, sufficient for any codebase)

**Decision**: 8 chars

**Q12: Manual ID Specification**

Should users be able to specify custom IDs?

**Option A**: Yes, with validation (must match `wm:` pattern)
**Option B**: Yes, any string (user responsibility)
**Option C**: No, always auto-generated

**Recommendation**: ~~Option A (allow custom with validation)~~

**Decision**: Option A (allow custom IDs with validation when `mode = "manual"`)

### Output Format

### Success Response (JSON)

```json
{
  "results": [
    {
      "file": "src/auth.ts",
      "requested": {
        "line": 42,
        "position": "after"
      },
      "inserted": {
        "line": 43,
        "content": "// *todo ::: add rate limiting owner:@alice #security @agent"
      },
      "status": "success"
    },
    {
      "file": "src/auth.ts",
      "requested": {
        "line": 100,
        "position": "before"
      },
      "inserted": {
        "line": 100,
        "content": "// note ::: assumes valid JWT tokens"
      },
      "status": "success"
    }
  ],
  "summary": {
    "total": 2,
    "successful": 2,
    "failed": 0,
    "filesModified": 1
  }
}
```

### Error Response

```json
{
  "results": [
    {
      "file": "src/missing.ts",
      "requested": {
        "line": 42,
        "position": "after"
      },
      "status": "error",
      "error": "File not found: src/missing.ts"
    }
  ],
  "summary": {
    "total": 1,
    "successful": 0,
    "failed": 1
  }
}
```

### Human-Readable Output

```text
Inserted 3 waymarks:

✓ src/auth.ts:43 (after line 42)
  // *todo ::: add rate limiting owner:@alice #security @agent

✓ src/auth.ts:100 (before line 100)
  // note ::: assumes valid JWT tokens

✓ src/database.ts:16 (after line 15)
  // tldr ::: postgres connection pool with retry logic ref:#db/pool

Summary: 3 inserted, 0 failed, 2 files modified
```

### Implementation Strategy

### Phase 1: Core Insert Logic (`@waymarks/core`)

```typescript
// packages/core/src/insert.ts

export interface InsertionSpec {
  file: string;
  line: number;
  position?: 'before' | 'after';
  type: string;
  content: string;
  signals?: {
    raised?: boolean;
    important?: boolean;
  };
  properties?: Record<string, string>;
  tags?: string[];
  mentions?: string[];
  order?: number;
  continuations?: string[];
}

function fingerprintRecord(input: {
  file: string;
  line: number;
  type: string;
  content: string;
}): { contentHash: string; contextHash: string } {
  const normalized = `${input.type}:::${normalizeWhitespace(input.content)}`;
  return {
    contentHash: hash(normalized),
    contextHash: fingerprintContext(input.file, input.line)
  };
}

function fingerprintContext(file: string, line: number): string {
  const window = readContextWindow(file, line, { before: 2, after: 2 });
  return hash(window.join('\n'));
}

export interface InsertionResult {
  file: string;
  requested: {
    line: number;
    position: string;
  };
  inserted?: {
    line: number;
    content: string;
  };
  status: 'success' | 'error';
  error?: string;
}

export interface InsertOptions {
  write?: boolean;
  format?: boolean;
  config?: WaymarkConfig;
}

export async function insertWaymarks(
  specs: InsertionSpec[],
  options: InsertOptions = {}
): Promise<InsertionResult[]>
```

### Phase 2: Stable Line Number Algorithm

**Critical Requirement**: All line numbers in input refer to the **original file state** before any insertions.

**Solution**: Process insertions in descending line order within each file.

```typescript
async function insertWaymarks(
  specs: InsertionSpec[],
  options: InsertOptions
): Promise<InsertionResult[]> {
  const results: InsertionResult[] = [];

  // Group by file
  const byFile = groupBy(specs, s => s.file);

  for (const [filepath, fileSpecs] of byFile) {
    // Read file once
    const lines = await readFileLines(filepath);
    const commentLeader = detectCommentLeader(filepath);

    // Sort DESCENDING by line number so earlier insertions don't shift later ones.
    // Within the same line we respect the explicit `order` (ascending) and fall back to
    // JSON declaration order for stability.
    const sorted = [...fileSpecs].sort((a, b) => {
      if (a.line === b.line) {
        const orderA = a.order ?? Number.MAX_SAFE_INTEGER;
        const orderB = b.order ?? Number.MAX_SAFE_INTEGER;
        if (orderA !== orderB) return orderA - orderB;
        return fileSpecs.indexOf(a) - fileSpecs.indexOf(b);
      }
      return b.line - a.line;
    });

    for (const spec of sorted) {
      try {
        // Format the waymark
        const waymark = formatWaymark(spec, {
          commentLeader,
          indent: detectIndentAtLine(lines, spec.line)
        });

        // Calculate actual insertion point
        const insertIndex = spec.position === 'before'
          ? spec.line - 1
          : spec.line;

        // Validate bounds
        if (insertIndex < 0 || insertIndex > lines.length) {
          throw new Error(`Line ${spec.line} out of bounds (file has ${lines.length} lines)`);
        }

        // Insert the line
        lines.splice(insertIndex, 0, waymark);

        results.push({
          file: filepath,
          requested: { line: spec.line, position: spec.position || 'after' },
          inserted: { line: insertIndex + 1, content: waymark },
          status: 'success'
        });
      } catch (error) {
        results.push({
          file: filepath,
          requested: { line: spec.line, position: spec.position || 'after' },
          status: 'error',
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }

    // Write file if requested
    if (options.write) {
      await writeFile(filepath, lines.join('\n'));
    }
  }

  return results;
}
```

### Phase 3: Waymark Formatting

```typescript
function formatWaymark(
  spec: InsertionSpec,
  context: { commentLeader: string; indent: number }
): string {
  const { commentLeader, indent } = context;
  const indentStr = ' '.repeat(indent);

  // Build signal prefix
  let signals = '';
  if (spec.signals?.raised) signals += '^';
  if (spec.signals?.important) signals += '*';

  // Build content with properties, tags, mentions
  let content = spec.content;

  // Add properties
  if (spec.properties) {
    const props = Object.entries(spec.properties)
      .map(([k, v]) => `${k}:${v}`)
      .join(' ');
    content += ` ${props}`;
  }

  // Add tags (ensure # prefix)
  if (spec.tags?.length) {
    const tags = spec.tags.map(t => t.startsWith('#') ? t : `#${t}`).join(' ');
    content += ` ${tags}`;
  }

  // Add mentions (ensure @ prefix)
  if (spec.mentions?.length) {
    const mentions = spec.mentions.map(m => m.startsWith('@') ? m : `@${m}`).join(' ');
    content += ` ${mentions}`;
  }

  return `${indentStr}${commentLeader} ${signals}${spec.type} ::: ${content}`;
}
```

### Phase 4: CLI Command

```typescript
// packages/cli/src/commands/add.ts

interface ParsedAddArgs {
  from?: string;
  specs: InsertionSpec[]; // derived from positional FILE:LINE arguments (one per invocation)
  write: boolean;
  json: boolean;
  jsonl: boolean;
}

export async function runAddCommand(args: string[]): Promise<void> {
  const parsed = parseAddArgs(args);

  // Load specs from file or use inline specs
  const specs = parsed.from
    ? await loadInsertionsFromFile(parsed.from)
    : parsed.specs;

  // Execute insertions
  const results = await insertWaymarks(specs, {
    write: parsed.write,
    config: await loadConfig()
  });

  // Format output
  if (parsed.json) {
    console.log(JSON.stringify({ results, summary: summarize(results) }, null, 2));
  } else if (parsed.jsonl) {
    results.forEach(r => console.log(JSON.stringify(r)));
  } else {
    formatInsertResults(results);
  }

  // Exit with error if any insertions failed
  const failed = results.filter(r => r.status === 'error').length;
  if (failed > 0) {
    process.exit(1);
  }
}
```

### Remove Command Use Cases

### 1. Code Review Feedback

```bash
# Reviewer leaves structured feedback
wm add src/api/users.ts \
  --line 42 \
  --type review \
  --content "missing input validation" \
  --owner @reviewer \
  --tag "#security" \
  --write
```

### 2. Automated TLDR Generation

```bash
# Generate TLDRs via LLM, insert at top of each file
generate-tldrs src/**/*.ts | wm add --from - --write
```

### 3. Compliance Auditing

```json
{
  "insertions": [
    {
      "file": "src/payments/stripe.ts",
      "line": 1,
      "type": "check",
      "content": "PCI-DSS compliance review required before production",
      "tags": ["#compliance", "#pci"],
      "signals": { "important": true }
    }
  ]
}
```

### 4. Migration from GitHub Issues

```typescript
// Convert GitHub issues to waymarks
const issues = await octokit.issues.listForRepo({ owner, repo });

const insertions = issues.data.flatMap(issue => {
  const locations = parseCodeReferences(issue.body);
  return locations.map(loc => ({
    file: loc.file,
    line: loc.line,
    type: 'todo',
    content: issue.title,
    properties: {
      owner: `@${issue.assignee?.login}`,
      github: `#${issue.number}`
    }
  }));
});

await fs.writeFile('insertions.json', JSON.stringify({ insertions }));
```

### 5. Test Coverage Annotations

```bash
# Mark untested code paths
coverage-gaps src/ | jq '{insertions: map({
  file,
  line,
  type: "test",
  content: "add test coverage for this path",
  tags: ["#test", "#coverage"]
})}' | wm add --from - --write
```

## Edge Cases & Error Handling

### 1. Line Out of Bounds

```typescript
// Line 1000 in a 100-line file
// Behavior: Insert at end of file, warn user

{
  "status": "error",
  "error": "Line 1000 out of bounds (file has 100 lines). Insert at line 100 instead?"
}
```

**Alternative**: Auto-clamp to valid range with warning?

### 2. File Doesn't Exist

```typescript
{
  "status": "error",
  "error": "File not found: src/missing.ts"
}
```

**Alternative**: Create file with waymark? Probably not.

### 3. Duplicate Line Numbers

```json
{
  "insertions": [
    { "file": "src/auth.ts", "line": 42, "type": "todo", "content": "first" },
    { "file": "src/auth.ts", "line": 42, "type": "note", "content": "second" }
  ]
}
```

**Behavior**: Both insert at line 42. Since we process descending, the second spec (note) inserts first at 42, then the first spec (todo) inserts at 42, pushing the note to 43.

**Alternative**: Error on duplicates? Warning?

### 4. Invalid Waymark Type

```typescript
// Type not in blessed markers and not in allowTypes
{
  "status": "error",
  "error": "Invalid waymark type 'custom'. Allowed types: todo, fix, note, ..."
}
```

**Alternative**: Insert anyway with warning?

### 5. Comment Leader Detection Fails

```typescript
// Unknown file extension
{
  "status": "warning",
  "message": "Unknown comment leader for .xyz file, defaulting to '//'",
  "inserted": { ... }
}
```

### 6. Indentation Detection

**Strategy**: Detect indentation at target line, match it.

```typescript
function detectIndentAtLine(lines: string[], lineNumber: number): number {
  const line = lines[lineNumber - 1];
  if (!line) return 0;

  const match = line.match(/^(\s*)/);
  return match ? match[1].length : 0;
}
```

### 7. Mixed File Types in Batch

```json
{
  "insertions": [
    { "file": "src/auth.ts", ... },
    { "file": "src/auth.py", ... },
    { "file": "docs/guide.md", ... }
  ]
}
```

**Behavior**: Each file gets appropriate comment leader (`//`, `#`, `<!--`).

## Open Questions

### 1. Atomic Operations

Should batch insertions be atomic? If one fails, should all rollback?

**Option A**: Best-effort (continue on errors, report all results)
**Option B**: Atomic (rollback all if any fails)
**Option C**: Per-file atomic (rollback file if any insertion in that file fails)

**Decision**: Option A (best-effort)

### 2. Formatting Integration

Should inserted waymarks auto-format via `formatText()`?

**Option A**: Always format (ensures consistency)
**Option B**: Only if `--format` flag (user control)
**Option C**: Never format (user runs `wm fmt` separately)

**Decision**: Option A (always format)

### 3. Dry Run Behavior

Current design: dry run by default, `--write` to persist.

**Alternative**: Write by default, `--dry-run` to preview?

**Decision**: Dry-run by default with configuration option to default to write and `--dry-run` to preview

### 4. Conflict Detection

Should we check if inserting at a line that already has a waymark?

**Option A**: Allow (multiple waymarks on adjacent lines)
**Option B**: Warn (user should verify)
**Option C**: Error (prevent duplicates)

**Decision**: Option A (allow)

### 5. Multi-line Waymarks

Should the add command support multi-line waymark insertion?

```json
{
  "file": "src/auth.ts",
  "line": 42,
  "type": "todo",
  "content": "implement OAuth flow",
  "continuations": [
    "with PKCE support",
    "coordinate with security team"
  ]
}
```

**Alternative**: Leave multi-line to manual editing/formatting?

**Decision**: Defer multi-line support to a follow-up release. V1 will insert single-line waymarks only and document manual workflows for complex blocks.

### 6. Interactive Mode

Should we support interactive insertion with prompts?

```bash
wm add src/auth.ts --line 42 --interactive
# Prompts for: type, content, properties, etc.
```

**Decision**: Defer interactive mode; future CLI polish can add guided prompts once core flows stabilize.

### 7. Template Support

Should we support waymark templates?

```bash
wm add src/auth.ts --line 42 --template security-review
# Expands to predefined type/content/tags
```

**Decision**: Defer to future version (not v1)

### 8. Glob Pattern Support

Should `file` field support globs?

```json
{
  "file": "src/payments/*.ts",
  "line": 1,
  "type": "check",
  "content": "PCI compliance required"
}
```

**Behavior**: Insert same waymark at line 1 of all matching files?

**Decision**: Not applicable for add command. Line numbers won't be consistent across different files. For bulk insertions at consistent locations (like TLDR at top), consider a future enhancement for semantic positioning (e.g., "after imports", "before first function").

---

## Waymark Remove Command Design

### Overview

The `wm rm` command enables programmatic removal of waymarks based on various criteria. This complements `wm add` and enables cleanup workflows, task completion automation, and maintenance operations.

### Motivation

Teams need to remove waymarks when:

- **Tasks are completed** - Remove `todo` waymarks after implementation
- **Code is refactored** - Clean up stale context markers
- **Compliance reviewed** - Remove `check` waymarks after audit
- **Temporary markers expire** - Remove `temp`/`wip` waymarks
- **Bulk cleanup** - Remove all waymarks matching specific criteria

### Command Interface

### By Line Number (Exact Removal)

```bash
# Remove waymark at specific line
wm rm src/auth.ts --line 42

# Remove from multiple files
wm rm src/auth.ts --line 42 src/db.ts --line 15 --write

# Remove with an audit reason (stored in history when enabled)
wm rm src/auth.ts --line 42 --reason "cleanup obsolete marker" --write

# Dry run (default - shows what would be removed)
wm rm src/auth.ts --line 42
```

### By Query Criteria

```bash
# Remove all waymarks of a specific type
wm rm --type todo --write

# Remove by type in specific files
wm rm src/**/*.ts --type todo --write

# Remove by tag
wm rm --tag "#deprecated" --write

# Remove by owner
wm rm --property owner:@alice --write

# Remove by multiple criteria (AND logic)
wm rm --type todo --tag "#old" --owner @alice --write

# Remove completed waymarks
wm rm --type done --write
```

### Batch Removal (JSON)

```bash
# From JSON file
wm rm --from removals.json --write

# From stdin
cat removals.json | wm rm --from - --write

# With confirmation for large operations
wm rm --from removals.json --confirm --write
```

### Interactive Selection (Future)

Interactive removal prompts remain on the roadmap. For now, combine targeted
filters (like `--type`, `--tag`, `--mention`) with `--confirm` or `--yes` to
control bulk deletions.

### JSON Input Schema

### Batch Removal File

```json
{
  "removals": [
    {
      "file": "src/auth.ts",
      "line": 42
    },
    {
      "file": "src/database.ts",
      "line": 15
    },
    {
      "criteria": {
        "type": "todo",
        "tags": ["#deprecated"],
        "files": ["src/**/*.ts"]
      }
    }
  ],
  "options": {
    "write": true,
    "cleanup_whitespace": false,
    "reason": "cleanup deprecated waymarks"
  }
}
```

### Removal Spec Types

**Exact line removal:**

```json
{
  "file": "src/auth.ts",
  "line": 42
}
```

**Criteria-based removal:**

```json
{
  "criteria": {
    "type": "todo",
    "tags": ["#deprecated", "#old"],
    "properties": { "owner": "@alice" },
    "files": ["src/**/*.ts"],
    "content_pattern": "implement.*OAuth"
  }
}
```

### Field Definitions

| Field | Type | Description |
| ----- | ---- | ----------- |
| `file` | string | Specific file path |
| `line` | number | Exact line number (1-indexed) |
| `criteria.type` | string | Waymark type to match |
| `criteria.tags` | string[] | Tags to match (all must be present) |
| `criteria.properties` | object | Properties to match |
| `criteria.files` | string[] | File patterns (glob support) |
| `criteria.content_pattern` | string | Regex pattern to match content |
| `criteria.signals` | object | Signal flags to match |

Optional batch `options` can include a `reason` string. When history tracking is enabled, the reason is stored alongside the removal entry.

### Output Format

### Success Response (JSON)

```json
{
  "results": [
    {
      "file": "src/auth.ts",
      "line": 42,
      "removed": "// todo ::: add rate limiting owner:@alice #security",
      "status": "success"
    },
    {
      "file": "src/database.ts",
      "line": 15,
      "removed": "// tldr ::: postgres connection pool",
      "status": "success"
    }
  ],
  "summary": {
    "total": 2,
    "successful": 2,
    "failed": 0,
    "filesModified": 2,
    "lines_removed": 2
  }
}
```

### Human-Readable Output

```text
Removed 3 waymarks:

✓ src/auth.ts:42
  - // todo ::: add rate limiting owner:@alice #security

✓ src/auth.ts:100
  - // todo ::: implement OAuth

✓ src/database.ts:15
  - // tldr ::: postgres connection pool

Summary: 3 removed, 0 failed, 2 files modified
```

### Dry-Run Output

```text
Would remove 3 waymarks:

  src/auth.ts:42
  - // todo ::: add rate limiting owner:@alice #security

  src/auth.ts:100
  - // todo ::: implement OAuth

  src/database.ts:15
  - // tldr ::: postgres connection pool

Run with --write to apply changes
```

### Implementation Strategy

### Core Remove Logic

```typescript
// packages/core/src/remove.ts

export interface RemovalSpec {
  file?: string;
  line?: number;
  criteria?: {
    type?: string;
    tags?: string[];
    properties?: Record<string, string>;
    files?: string[];
    content_pattern?: string;
    signals?: {
      raised?: boolean;
      important?: boolean;
    };
  };
}

export interface RemovalResult {
  file: string;
  line: number;
  removed: string;
  status: 'success' | 'error';
  error?: string;
}

export interface RemoveOptions {
  write?: boolean;
  cleanup_whitespace?: boolean;
  config?: WaymarkConfig;
  reason?: string;
  removedBy?: string;
}

export async function removeWaymarks(
  specs: RemovalSpec[],
  options: RemoveOptions = {}
): Promise<RemovalResult[]>
```

### Removal Algorithm

```typescript
async function removeWaymarks(
  specs: RemovalSpec[],
  options: RemoveOptions
): Promise<RemovalResult[]> {
  const results: RemovalResult[] = [];

  // Expand specs into specific line numbers to remove
  const lineRemovals = await expandRemovalSpecs(specs);

  // Group by file
  const byFile = groupBy(lineRemovals, r => r.file);

  for (const [filepath, fileRemovals] of byFile) {
    const lines = await readFileLines(filepath);

    // Sort DESCENDING by line number (remove from bottom to top)
    // This prevents line number shifts during removal
    const sorted = [...fileRemovals].sort((a, b) => b.line - a.line);

    for (const removal of sorted) {
      try {
        const lineIndex = removal.line - 1;

        // Validate line exists
        if (lineIndex < 0 || lineIndex >= lines.length) {
          throw new Error(`Line ${removal.line} out of bounds`);
        }

        // Capture removed content
        const removedContent = lines[lineIndex];

        // Remove the line
        lines.splice(lineIndex, 1);

        results.push({
          file: filepath,
          line: removal.line,
          removed: removedContent,
          status: 'success'
        });
      } catch (error) {
        results.push({
          file: filepath,
          line: removal.line,
          removed: '',
          status: 'error',
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }

    // Whitespace cleanup is opt-in to avoid collateral diffs
    if (options.cleanup_whitespace) {
      cleanupBlankLines(lines);
    }

    // Write file if requested
    if (options.write) {
      await writeFile(filepath, lines.join('\n'));
    }
  }

  return results;
}
```

### Criteria Expansion

```typescript
async function expandRemovalSpecs(
  specs: RemovalSpec[]
): Promise<Array<{ file: string; line: number }>> {
  const lineRemovals: Array<{ file: string; line: number }> = [];

  for (const spec of specs) {
    // Direct line removal
    if (spec.file && spec.line) {
      lineRemovals.push({ file: spec.file, line: spec.line });
      continue;
    }

    // Criteria-based removal
    if (spec.criteria) {
      const files = spec.criteria.files?.length
        ? await expandFilePatterns(spec.criteria.files)
        : await lookupFilesFromIndex(spec.criteria);

      for (const file of files) {
        const waymarks = (await loadFromIndex(file)) ?? (await rescanFile(file));
        const matches = waymarks.filter(w => matchesCriteria(w, spec.criteria!));

        for (const match of matches) {
          lineRemovals.push({ file: match.file, line: match.startLine });
        }
      }
    }
  }

  return lineRemovals;
}

function matchesCriteria(waymark: WaymarkRecord, criteria: RemovalSpec['criteria']): boolean {
  if (!criteria) return false;

  // Type match
  if (criteria.type && waymark.type !== criteria.type) {
    return false;
  }

  // Tags match (all must be present)
  if (criteria.tags?.length) {
    const hasAllTags = criteria.tags.every(tag => waymark.tags.includes(tag));
    if (!hasAllTags) return false;
  }

  // Properties match
  if (criteria.properties) {
    for (const [key, value] of Object.entries(criteria.properties)) {
      if (waymark.properties[key] !== value) {
        return false;
      }
    }
  }

  // Content pattern match
  if (criteria.content_pattern) {
    const regex = new RegExp(criteria.content_pattern);
    if (!regex.test(waymark.contentText)) {
      return false;
    }
  }

  // Signal match
  if (criteria.signals) {
    if (criteria.signals.raised !== undefined &&
        waymark.signals.raised !== criteria.signals.raised) {
      return false;
    }
    if (criteria.signals.important !== undefined &&
        waymark.signals.important !== criteria.signals.important) {
      return false;
    }
  }

  return true;
}
```

### Use Cases

### 1. Complete Tasks

```bash
# Remove all completed todos
wm rm --type done --write

# Remove specific completed task
wm rm src/auth.ts --line 42 --write
```

### 2. Cleanup After Refactor

```bash
# Remove all temporary/wip markers
wm rm --type temp --write
wm rm --type wip --write

# Remove stale review comments
wm rm --type review --property "owner:@former-employee" --write
```

### 3. Compliance Workflow

```bash
# Remove check markers after audit
wm rm --tag "#pci-audit" --type check --write
```

### 4. Bulk Cleanup

```json
{
  "removals": [
    {
      "criteria": {
        "type": "todo",
        "tags": ["#deprecated"]
      }
    },
    {
      "criteria": {
        "type": "note",
        "content_pattern": "legacy.*implementation"
      }
    }
  ]
}
```

### 5. GitHub Actions Integration

```yaml
# .github/workflows/cleanup-completed.yml
name: Cleanup Completed Waymarks

on:
  schedule:
    - cron: '0 0 * * 0'  # Weekly

jobs:
  cleanup:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: oven-sh/setup-bun@v1
      - name: Remove completed waymarks
        run: |
          wm rm --type done --write
          if [[ -n $(git status -s) ]]; then
            git config user.name "waymark-bot"
            git commit -am "chore: cleanup completed waymarks"
            git push
          fi
```

### Safety Features

### 1. Dry-Run by Default

Same as insert - show what would be removed without modifying files.

```bash
# Shows preview
wm rm --type todo

# Actually removes
wm rm --type todo --write
```

### 2. Confirmation Prompts

For large operations, prompt user:

```bash
wm rm --type todo --confirm --write

# Output:
# Found 47 waymarks matching criteria.
# Remove all 47 waymarks? [y/N]
```

### 3. Backup Option

```bash
wm rm --type todo --backup --write

# Creates .waymark/backups/{timestamp}/
```

### 4. Undo Support

```bash
# Show recent removals
wm rm --show-history

# Undo last removal operation
wm rm --undo
```

### Edge Cases

### 1. No Matches Found

```json
{
  "results": [],
  "summary": {
    "total": 0,
    "successful": 0,
    "failed": 0,
    "message": "No waymarks found matching criteria"
  }
}
```

### 2. Line Number Already Gone

```json
{
  "file": "src/auth.ts",
  "line": 42,
  "status": "error",
  "error": "Line 42 is not a waymark (content: 'const user = await fetchUser();')"
}
```

### 3. File Modified During Operation

Detect file changes and warn/abort:

```json
{
  "status": "error",
  "error": "File src/auth.ts was modified during operation"
}
```

### 4. Removing TLDR

Warning when removing `tldr` waymarks:

```text
⚠ Warning: Removing TLDR from src/auth.ts
This is the file's primary documentation waymark.
Continue? [y/N]
```

### CLI Integration

```typescript
// packages/cli/src/commands/remove.ts

export async function runRemoveCommand(args: string[]): Promise<void> {
  const parsed = parseRemoveArgs(args);

  // Load specs from file or use inline specs
  const specs = parsed.from
    ? await loadRemovalsFromFile(parsed.from)
    : buildRemovalSpecs(parsed);

  // Confirmation for large operations
  if (parsed.confirm && !parsed.yes) {
    const preview = await removeWaymarks(specs, { write: false });
    const count = preview.filter(r => r.status === 'success').length;

    if (count > 10) {
      const confirmed = await confirm(`Remove ${count} waymarks?`);
      if (!confirmed) {
        console.log('Cancelled');
        return;
      }
    }
  }

  // Execute removals
  const results = await removeWaymarks(specs, {
    write: parsed.write,
    cleanup_whitespace: parsed.cleanup_whitespace,
    config: await loadConfig(),
    reason: parsed.reason
  });

  // Format output
  if (parsed.json) {
    console.log(JSON.stringify({ results, summary: summarize(results) }, null, 2));
  } else {
    formatRemoveResults(results, { dryRun: !parsed.write });
  }

  // Exit with error if any removals failed
  const failed = results.filter(r => r.status === 'error').length;
  if (failed > 0) {
    process.exit(1);
  }
}
```

### Open Questions for Remove Command

### R1: Blank Line Handling

After removing waymarks, should we:

**Option A**: Preserve blank lines (leave gaps)
**Option B**: Collapse consecutive blank lines (clean up)
**Option C**: Remove the blank line only if it was created by the removal

**Recommendation**: Option A with a future `--cleanup` flag for folks who want whitespace normalization.

**Decision**: Option A (leave spacing untouched; only remove the waymark line).

### R2: Confirmation Thresholds

When should we require confirmation?

**Option A**: Always prompt when `--confirm` flag present
**Option B**: Auto-prompt when removing > N waymarks (e.g., N=10)
**Option C**: Never prompt (trust user, they can review with dry-run)

**Recommendation**: Option B (auto-prompt at N=10) + `--yes` flag to skip

**Decision**: Option B (auto-prompt at N=10)

### R3: Partial Matches

For criteria-based removal, what if criteria matches parts of multi-line waymarks?

**Option A**: Remove entire multi-line waymark if header matches
**Option B**: Error on multi-line waymarks (force line-based removal)
**Option C**: Remove only matching continuation lines

**Recommendation**: Option A (treat multi-line as atomic unit)

**Decision**: Option A (remove entire multi-line waymark atomically). Track parent-child relationships in database to prevent orphaning.

### R4: TLDR Protection

Should we prevent/warn when removing TLDR waymarks?

**Option A**: Error (block removal of TLDR)
**Option B**: Warn + confirm (allow with explicit confirmation)
**Option C**: Allow silently (user knows what they're doing)

**Recommendation**: Option B (warn + confirm for TLDR)

**Decision**: Option B (warn + confirm)

### R5: Undo Functionality

Should we support undo for remove operations?

**Option A**: No undo (use git for versioning)
**Option B**: Track in .waymark/history/ for `wm rm --undo`
**Option C**: Optional backup directory with `--backup` flag

**Recommendation**: Option C (explicit backup when needed)

**Decision**: Track removed waymarks in `.waymark/history.json` separate from `index.json`. Audit trail stays in `index.json`, tombstoned waymarks live in `history.json` for undo capability.

### Decisions Required Before Implementation

The following design choices need to be finalized:

### Priority 1: Core Behavior (Must Decide)

- [x] **Q1: Atomic Operations** - Best-effort (A), all-or-nothing (B), or per-file (C)?
  - **Decision**: Option A (best-effort) with detailed error reporting
  - **Rationale**: Partial success better than total failure; users can retry failed insertions

- [x] **Q2: Auto-Formatting** - Always (A), flag-based (B), or never (C)?
  - **Decision**: Option A (always format)
  - **Rationale**: Ensures consistency; users expect programmatic insertions to be formatted

- [x] **Q3: Dry-Run Default** - Dry-run by default with `--write`, or write by default with `--dry-run`?
  - **Decision**: Dry-run by default with config option to default to write
  - **Rationale**: Prevents accidental file modification; explicit `--write` shows intent; power users can configure default behavior

- [x] **Q4: Conflict Detection** - Allow (A), warn (B), or error (C)?
  - **Decision**: Option A (allow) with informational output
  - **Rationale**: Adjacent waymarks are valid; tooling shouldn't prevent legitimate patterns

### Priority 2: Enhanced Features (Can Defer)

- [x] **Q5: Multi-line Waymarks** - Support `continuations` array in spec or manual-only?
  - **Decision**: JSON-only multi-line via `continuations`
  - **Rationale**: Keeps CLI path simple while letting automation emit structured multi-line notes

- [x] **Q6: Interactive Mode** - Default to interactive prompts when no target is provided; add `--no-interactive` escape hatch.
  - **Decision**: Defer interactive mode until after core automation ships
  - **Rationale**: Prioritize API/automation pathways; add UX polish later

- [x] **Q7: Template Support** - Support predefined waymark templates?
  - **Decision**: Defer to future version (not v1)
  - **Rationale**: Can be built later on top of base implementation; users can create JSON templates manually

- [x] **Q8: Glob Pattern Support** - Allow glob patterns in `file` field?
  - **Decision**: Not applicable for insert (line numbers not consistent across files)
  - **Rationale**: Different files have different structures; programmatic insertion at same line number doesn't make sense

### Summary of Finalized Decisions

**For v1.0 Implementation:**

- ✅ Best-effort atomic operations with detailed error reporting (Q1)
- ✅ Always format inserted waymarks (Q2)
- ✅ Dry-run by default with config option to default to write (Q3)
- ✅ Allow adjacent waymarks without warnings (Q4)
- ✅ JSON-only multi-line waymark support (Q5)
- ⏸️ Interactive mode deferred to v2 (Q6)
- ✅ Auto-generate IDs with interactive prompt on first use (Q9)
- ✅ Dual tracking: content + JSON index (Q10)
- ✅ 8-character IDs (Q11)
- ✅ ID modes support auto/prompt/manual with validation (Q12)
- ✅ Leave whitespace untouched by default; optional cleanup flag later (R1)
- ✅ Auto-prompt confirmation at N=10 removals (R2)
- ✅ Remove multi-line waymarks atomically with orphan prevention (R3)
- ✅ Warn + confirm when removing TLDR waymarks (R4)
- ✅ Track removed waymarks in history.json with audit trail in index.json (R5)
- ⏸️ Defer template support to future version (Q7)

**Decision Tracking:**

**Add Command:**

| Question | Status | Decision | Notes |
| -------- | ------ | -------- | ----- |
| Q1: Atomic ops | ✅ Finalized | Option A (best-effort) | Detailed error reporting per insertion |
| Q2: Formatting | ✅ Finalized | Option A (always format) | Ensures consistency for programmatic insertions |
| Q3: Dry-run | ✅ Finalized | Dry-run default + config | Can configure default to write, `--dry-run` to preview |
| Q4: Conflicts | ✅ Finalized | Option A (allow) | Adjacent waymarks are valid |
| Q5: Multi-line | ✅ Finalized | JSON-only continuations | CLI stays single-line; batch handles multi-line |
| Q6: Interactive | ✅ Finalized | Defer to future | CLI prompts arrive after core release |
| Q7: Templates | ✅ Finalized | Defer to future | Manual JSON templates sufficient for now |
| Q8: Glob support | ✅ Finalized | Not applicable | Line numbers inconsistent across files |
| Q9: ID auto-gen | ✅ Finalized | Option C (config-based) | Interactive prompt on first use |
| Q10: ID persistence | ✅ Finalized | Option B (dual tracking) | Content property + JSON index |
| Q11: ID length | ✅ Finalized | Option B (8 chars) | 2.8T combinations, sufficient for any codebase |
| Q12: Custom IDs | ✅ Finalized | Option A (validated manual) | Enable integrations while keeping format strict |

**Remove Command:**

| Question | Status | Decision | Notes |
| ---------- | -------- | ---------- | ------- |
| R1: Blank lines | ✅ Finalized | Option A (leave) | Only remove waymark line; optional cleanup flag later |
| R2: Confirmation | ✅ Finalized | Option B (auto-prompt) | Prompt at N=10, `--yes` to skip |
| R3: Multi-line | ✅ Finalized | Option A (atomic) | Track parent-child in DB, prevent orphans |
| R4: TLDR protect | ✅ Finalized | Option B (warn + confirm) | Prevent accidental removal of primary docs |
| R5: Undo support | ✅ Finalized | history.json + audit log | Removed waymarks live in history.json, audit trail in index.json |

## Integration Points

### MCP Server

Expose a single MCP tool for waymark operations:

**Tool:**

```typescript
// apps/mcp/src/tools/waymark.ts
{
  name: "waymark",
  description: "Single tool for scan, graph, add, or help actions",
  inputSchema: {
    action: { type: "string", enum: ["scan", "graph", "add", "help"] },
    // scan: paths[], format?
    // graph: paths[]
    // add: filePath, type, content, line?, signals?, configPath?, scope?
    // help: topic?
  }
}
```

**Remove Tool:**

```typescript
// apps/mcp/src/tools/remove.ts
{
  name: "waymark.remove",
  description: "Remove waymark(s) from file(s)",
  inputSchema: {
    oneOf: [
      // Single removal by line
      {
        type: "object",
        properties: {
          file: { type: "string" },
          line: { type: "number" }
        },
        required: ["file", "line"]
      },
      // Criteria-based removal
      {
        type: "object",
        properties: {
          criteria: {
            type: "object",
            properties: {
              type: { type: "string" },
              tags: { type: "array", items: { type: "string" } },
              properties: { type: "object" },
              files: { type: "array", items: { type: "string" } },
              content_pattern: { type: "string" }
            }
          }
        },
        required: ["criteria"]
      },
      // Batch removal
      {
        type: "object",
        properties: {
          removals: {
            type: "array",
            items: { /* RemovalSpec schema */ }
          }
        },
        required: ["removals"]
      }
    ]
  }
}
```

### GitHub Actions

```yaml
# .github/workflows/add-review-waymarks.yml
name: Add Review Waymarks

on:
  pull_request_review:
    types: [submitted]

jobs:
  insert-waymarks:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: oven-sh/setup-bun@v1
      - name: Convert review comments to waymarks
        run: |
          gh api repos/${{ github.repository }}/pulls/${{ github.event.pull_request.number }}/comments \
            | jq '{insertions: map({
                file: .path,
                line: .line,
                type: "review",
                content: .body,
                properties: {owner: .user.login}
              })}' \
            | wm add --from - --write
      - name: Commit waymarks
        run: |
          git config user.name "waymark-bot"
          git commit -am "chore: add review waymarks"
          git push
```

## Next Steps

### Phase 1: Design Finalization

1. **Review and refine both command designs**
2. **Decide on open questions** for insert (Q1-Q8) and remove (R1-R5)
3. **Validate use cases** with real-world examples
4. **Finalize JSON schemas** for both commands

### Phase 2: Core Implementation

1. **Implement core insert logic** in `@waymarks/core/src/insert.ts`
2. **Implement core remove logic** in `@waymarks/core/src/remove.ts`
3. **Add comprehensive unit tests** for both modules
4. **Create shared utilities** (file I/O, glob expansion, criteria matching)

### Phase 3: CLI Integration

1. **Add `wm add` command** in `packages/cli/src/commands/add.ts`
2. **Add `wm rm` command** in `packages/cli/src/commands/remove.ts`
3. **Add CLI integration tests** covering all usage modes
4. **Update CLI help** and usage documentation

### Phase 4: MCP Extension

1. **Extend MCP server** with `waymark` tool (action: scan|graph|add|help)
2. **Add `action: remove`** to the `waymark` MCP tool
3. **Test MCP integration** with Claude Code and other agents

### Phase 5: Documentation & Release

1. **Create JSON schemas** in `schemas/` directory
2. **Document in SPEC** and update PLAN.md
3. **Add examples** to README and usage guides
4. **Write integration guides** for GitHub Actions, pre-commit hooks, etc.

## Feedback Needed

### Add Command

- [ ] Line number stability algorithm correct?
- [ ] JSON schema complete and ergonomic?
- [ ] Output format helpful for tooling?
- [ ] Edge case handling reasonable?
- [ ] Glob pattern support scope appropriate?
- [ ] Missing use cases to consider?

### Remove Command

- [ ] Criteria-based removal powerful enough?
- [ ] Safety features adequate (dry-run, confirmation, TLDR protection)?
- [ ] Blank line handling options sensible?
- [ ] Interactive mode design useful?
- [ ] Backup/undo approach appropriate?

### Both Commands

- [ ] Consistent design patterns across insert/remove?
- [ ] API surface area minimal and composable?
- [ ] JSON input/output schemas interoperable?
- [ ] Error handling comprehensive?
- [ ] Documentation coverage sufficient?
