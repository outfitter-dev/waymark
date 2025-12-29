<!-- tldr ::: design document for wm modify command v1.0 implementation -->

# `wm modify` Command Design - v1.0

**Status**: Planning
**Created**: 2025-10-05
**Target**: v1.0.0 or v1.1.0

## Overview

The `wm modify` command allows users to update existing waymarks without removing and re-inserting them. This preserves waymark IDs, maintains multi-line structure, and provides atomic updates with preview capability.

## Core Principles

1. **Preserve waymark IDs**: If `wm:<id>` exists in content, keep it at the end after modifications
2. **Atomic operations**: All modifications succeed or none apply
3. **Preview by default**: Require `--write` flag to apply changes (matches `remove` pattern)
4. **Auto-refresh index**: After successful writes refresh the waymark index so downstream tooling stays accurate
5. **Simple v1 scope**: Focus on essential operations, defer complex features to v1.1+

## Command Signature

```bash
wm modify <target> [options]
```

### Target Selection

**By Location** (file:line):

```bash
wm modify src/auth.ts:42 --type fix
```

**By Waymark ID**:

```bash
wm modify --id wm:a3k9m2p --type fix
```

**Mutually Exclusive**: Cannot specify both file:line and `--id` in same invocation.

## v1.0 Operations

### 1. Change Waymark Type

**Flag**: `--type <marker>`

**Examples**:

```bash
# Preview changing todo to fix
wm modify src/auth.ts:42 --type fix

# Apply the change
wm modify src/auth.ts:42 --type fix --write

# Change by ID
wm modify --id wm:a3k9m2p --type fix --write
```

**Validation**:

- New type must be a valid marker (todo, fix, note, etc.)
- Warns if changing to unknown/custom marker

**Behavior**:

```text
Before: // todo ::: implement OAuth wm:a3k9m2p
After:  // fix ::: implement OAuth wm:a3k9m2p
```

### 2. Adjust Signals

**Flags**:

- `--raise` - Add `^` (raised) signal
- `--important` - Add `*` (important) signal
- `--no-signal` - Remove all signals

Flags can be combined in a single invocation. When `--no-signal` is present it clears both signals regardless of other flags.

**Examples**:

```bash
# Add important signal
wm modify src/auth.ts:42 --important --write

# Add raised signal
wm modify src/auth.ts:42 --raise --write

# Add both signals
wm modify src/auth.ts:42 --raise --important --write

# Remove all signals
wm modify src/auth.ts:42 --no-signal --write
```

**Behavior**:

```bash
# --important
Before: // todo ::: implement OAuth
After:  // *todo ::: implement OAuth

# --raise
Before: // todo ::: implement OAuth
After:  // ^todo ::: implement OAuth

# --raise --important
Before: // todo ::: implement OAuth
After:  // ^*todo ::: implement OAuth

# --no-signal
Before: // ^*todo ::: implement OAuth
After:  // todo ::: implement OAuth
```

**Signal Combination Rules** (per v1 grammar):

- `^` always precedes `*` when both present
- Only one `^` and one `*` allowed (no `^^` or `**`)
- Re-applying an existing signal is a no-op

### 3. Replace Content

**Flag**: `--content <text>`

**Examples**:

```bash
# Replace entire content
wm modify src/auth.ts:42 --content "validate JWT tokens" --write

# Replace content preserving ID
wm modify src/auth.ts:42 --content "new content" --write

# Read content from stdin (matching insert --from - pattern)
printf "validate JWT" | wm modify src/auth.ts:42 --content - --write
```

**ID Preservation Logic**:

```typescript
function modifyContent(original: string, newContent: string): string {
  // Extract ID if present (matches wm:xxxxx at end)
  const idMatch = original.match(/\s+(wm:[a-z0-9]+)$/);
  const id = idMatch?.[1];

  // If ID exists, ensure it stays at the end
  if (id) {
    // Remove ID from new content if user accidentally included it
    const cleanContent = newContent.replace(/\s+wm:[a-z0-9]+$/, '').trim();
    return `${cleanContent} ${id}`;
  }

  return newContent;
}
```

**Behavior**:

```bash
# Without ID
Before: // todo ::: implement OAuth
After:  // todo ::: validate JWT tokens

# With ID (preserved)
Before: // todo ::: implement OAuth wm:a3k9m2p
After:  // todo ::: validate JWT tokens wm:a3k9m2p

# User accidentally includes ID in new content (auto-dedupe)
Input:  wm modify ... --content "new content wm:a3k9m2p"
Before: // todo ::: old content wm:a3k9m2p
After:  // todo ::: new content wm:a3k9m2p
```

**Content Sources**:

- `--content <text>` accepts inline strings as today
- `--content -` reads the replacement text from STDIN (one shot), mirroring the `wm add --from -` behavior

**Multi-line Handling**:

- Only modifies the first line (main content)
- Preserves continuation lines unchanged
- Example:

  ```text
  Before:
  // todo ::: implement OAuth
  //      ::: with PKCE flow
  //      ::: coordinate with @security

  After (--content "validate JWT"):
  // todo ::: validate JWT
  //      ::: with PKCE flow
  //      ::: coordinate with @security
  ```

### 4. Interactive Mode

**Flag**: `--interactive`

**Behavior**:

- With an explicit target (`file:line` or `--id`), prompts for type, signal, and content updates (including whether to pull content from STDIN)
- Without a target, scans the workspace and opens a waymark picker; the selected waymark becomes the target for the subsequent prompts
- Shows the preview diff before final confirmation
- Respects `--write`: without it the session stops after preview; with it the confirmed changes apply

**Example**:

```bash
wm modify --interactive
# 1. Choose waymark from list (arrow keys/enter)
# 2. Prompts:
#    • Change type? (todo)
#    • Add raised signal? (y/N)
#    • Add important signal? (y/N)
#    • Remove signals? (y/N)
#    • Update content? (y/N)
#    • Preview summary, then confirm applying with --write
```

### 5. Write Flag

**Flag**: `--write` (or `-w`)

**Default**: Preview mode (shows what would change, doesn't modify files)

**Examples**:

```bash
# Preview
wm modify src/auth.ts:42 --type fix

# Apply
wm modify src/auth.ts:42 --type fix --write
```

## Output Formats

### Preview Mode (default)

**Text Output**:

```text
Preview modification for src/auth.ts:42

Before:
  42 | // todo ::: implement OAuth wm:a3k9m2p

After:
  42 | // *todo ::: implement OAuth wm:a3k9m2p

Modifications:
  - Added important signal (*)

Run with --write to apply changes.
```

**JSON Output** (`--json`):

```json
{
  "preview": true,
  "target": {
    "file": "src/auth.ts",
    "line": 42,
    "id": "wm:a3k9m2p"
  },
  "modifications": {
    "signals": { "raised": false, "important": true }
  },
  "before": {
    "type": "todo",
    "signals": { "raised": false, "important": false },
    "content": "implement OAuth wm:a3k9m2p",
    "raw": "// todo ::: implement OAuth wm:a3k9m2p"
  },
  "after": {
    "type": "todo",
    "signals": { "raised": false, "important": true },
    "content": "implement OAuth wm:a3k9m2p",
    "raw": "// *todo ::: implement OAuth wm:a3k9m2p"
  }
}
```

### Write Mode

**Text Output**:

```text
Modified src/auth.ts:42

  42 | // *todo ::: implement OAuth wm:a3k9m2p

Modifications applied:
  - Added important signal (*)

Index refreshed for src/auth.ts.
```

**JSON Output** (`--json`):

```json
{
  "modified": true,
  "target": {
    "file": "src/auth.ts",
    "line": 42,
    "id": "wm:a3k9m2p"
  },
  "modifications": {
    "signals": { "raised": false, "important": true }
  },
  "result": {
    "type": "todo",
    "signals": { "raised": false, "important": true },
    "content": "implement OAuth wm:a3k9m2p",
    "raw": "// *todo ::: implement OAuth wm:a3k9m2p"
  },
  "indexRefreshed": true
}
```

## Error Handling

### Validation Errors

**No modifications specified**:

```bash
$ wm modify src/auth.ts:42
error: no modifications specified
Available options: --type, --raise, --important, --no-signal, --content, --interactive
```

**Invalid target**:

```bash
$ wm modify src/auth.ts:999 --type fix
error: no waymark found at src/auth.ts:999
```

**Unknown waymark ID**:

```bash
$ wm modify --id wm:invalid --type fix
error: waymark ID wm:invalid not found in index
```

**Invalid marker type**:

```bash
$ wm modify src/auth.ts:42 --type invalid
warning: unknown marker type 'invalid'
Proceed? (y/N)
```

**Conflicting targets**:

```bash
$ wm modify src/auth.ts:42 --id wm:a3k9m2p --type fix
error: cannot specify both file:line and --id
```

### Exit Codes

- `0` - Success (modification applied or preview shown)
- `1` - Validation error (invalid target, no modifications, etc.)
- `2` - File I/O error (cannot read/write file)

## Implementation Plan

### Phase 1: Core Command Structure

**File**: `packages/cli/src/commands/modify.ts`

```typescript
import type { Command } from "commander";
import type { CommandContext } from "../types.ts";
import { parse } from "@waymarks/grammar";
import { formatText } from "@waymarks/core";
import prompts from "prompts";
import { readFromStdin } from "../utils/stdin.ts";

const DEFAULT_MARKER_TYPES = ["todo", "fix", "note", "warn", "tldr", "done"];

export interface ModifyOptions {
  id?: string;
  type?: string;
  content?: string;
  raised?: boolean;
  important?: boolean;
  noSignal?: boolean;
  write?: boolean;
  json?: boolean;
  jsonl?: boolean;
  interactive?: boolean;
}

export interface ModifyTarget {
  file: string;
  line: number;
  id?: string;
}

export async function runModifyCommand(
  ctx: CommandContext,
  target: string | undefined,
  options: ModifyOptions
): Promise<void> {
  // 1. Parse target (file:line or --id)
  const resolvedTarget = await resolveTarget(ctx, target, options.id);

  // 2. Read current waymark snapshot
  const currentWaymark = await readWaymark(resolvedTarget);

  // 3. If interactive, collect modifications via prompts
  const markerChoices = await loadMarkerTypes(ctx);
  const finalizedOptions = options.interactive
    ? await runInteractiveSession(currentWaymark, options, markerChoices)
    : options;

  // 4. Validate modifications (interactive sessions may supply them at runtime)
  validateModifications(finalizedOptions);

  // 5. Resolve content input (inline or stdin)
  const contentOverride = await resolveContentInput(
    finalizedOptions,
    ctx.stdin ?? process.stdin
  );
  const effectiveOptions = {
    ...finalizedOptions,
    ...(contentOverride !== undefined ? { content: contentOverride } : {}),
  };

  // 6. Apply modifications
  const modifiedWaymark = applyModifications(currentWaymark, effectiveOptions);

  // 7. Format output
  if (effectiveOptions.json || effectiveOptions.jsonl) {
    outputJSON(currentWaymark, modifiedWaymark, effectiveOptions);
  } else {
    outputText(currentWaymark, modifiedWaymark, effectiveOptions);
  }

  // 8. Write if requested
  if (effectiveOptions.write) {
    await writeWaymark(resolvedTarget, modifiedWaymark);
    await refreshIndex(ctx, resolvedTarget.file);
    if (!effectiveOptions.json && !effectiveOptions.jsonl) {
      console.log("\nModifications applied.");
    }
  } else if (!effectiveOptions.json && !effectiveOptions.jsonl) {
    console.log("\nRun with --write to apply changes.");
  }
}
```

### Phase 2: Target Resolution

```typescript
async function resolveTarget(
  ctx: CommandContext,
  fileLineArg: string | undefined,
  idArg: string | undefined
): Promise<ModifyTarget> {
  // Error if both specified
  if (fileLineArg && idArg) {
    throw new Error("Cannot specify both file:line and --id");
  }

  // Error if neither specified
  if (!fileLineArg && !idArg) {
    throw new Error("Must specify target as file:line or --id");
  }

  if (idArg) {
    // Resolve ID from index
    return await resolveFromID(ctx, idArg);
  }

  // Parse file:line
  const match = fileLineArg!.match(/^(.+):(\d+)$/);
  if (!match) {
    throw new Error(`Invalid target format: ${fileLineArg}`);
  }

  return {
    file: match[1],
    line: parseInt(match[2], 10)
  };
}

async function resolveFromID(
  ctx: CommandContext,
  id: string
): Promise<ModifyTarget> {
  const index = await loadIndex(ctx);
  const waymark = index.waymarks.find(w => w.id === id);

  if (!waymark) {
    throw new Error(`Waymark ID ${id} not found in index`);
  }

  return {
    file: waymark.file,
    line: waymark.startLine,
    id: waymark.id
  };
}
```

### Phase 3: Modification Application

```typescript
function validateModifications(options: ModifyOptions): void {
  const hasTypeChange = Boolean(options.type);
  const hasSignalChange = Boolean(options.raised || options.important || options.noSignal);
  const hasContentChange = options.content !== undefined;

  if (!(hasTypeChange || hasSignalChange || hasContentChange)) {
    throw new Error("No modifications specified. Use --type, --raise, --important, --no-signal, or --content.");
  }
}

function applyModifications(
  current: WaymarkRecord,
  options: ModifyOptions
): WaymarkRecord {
  const modified = { ...current };

  // Apply type change
  if (options.type) {
    modified.type = options.type;
  }

  // Apply signal changes
  if (options.noSignal) {
    modified.signals.raised = false;
    modified.signals.important = false;
  } else {
    if (options.raised) {
      modified.signals.raised = true;
    }
    if (options.important) {
      modified.signals.important = true;
    }
  }

  // Apply content change (with ID preservation)
  if (options.content !== undefined) {
    modified.contentText = preserveID(current.contentText, options.content);
  }

  // Regenerate raw waymark
  modified.raw = formatText(modified);

  return modified;
}

function preserveID(original: string, newContent: string): string {
  // Extract ID from original if present
  const idMatch = original.match(/\s+(wm:[a-z0-9]+)$/);
  const id = idMatch?.[1];

  if (!id) {
    return newContent;
  }

  // Remove ID from new content if accidentally included
  const cleanContent = newContent.replace(/\s+wm:[a-z0-9]+$/, '').trim();

  // Re-append ID
  return `${cleanContent} ${id}`;
}

async function resolveContentInput(
  options: ModifyOptions,
  stdin: NodeJS.ReadableStream = process.stdin
): Promise<string | undefined> {
  if (options.content === undefined) {
    return undefined;
  }

  if (options.content === '-') {
    const raw = await readFromStdin(stdin);
    return raw.replace(/\n$/, ''); // trim single trailing newline from shell pipelines
  }

  return options.content;
}

async function runInteractiveSession(
  current: WaymarkRecord,
  options: ModifyOptions,
  markers: string[]
): Promise<ModifyOptions> {
  const answers = await prompts(
    buildInteractiveQuestions(current, options, markers),
    { onCancel: () => process.exit(1) }
  );

  return {
    ...options,
    type: answers.type ?? options.type,
    raised: answers.raised ?? options.raised,
    important: answers.important ?? options.important,
    noSignal: answers.noSignal ?? options.noSignal,
    content:
      answers.content !== undefined ? answers.content : options.content,
    write: options.write || answers.confirmWrite === true,
    interactive: false,
  };
}

function buildInteractiveQuestions(
  current: WaymarkRecord,
  options: ModifyOptions,
  markers: string[]
) {
  const questions = [] as prompts.PromptObject[];

  if (!options.type) {
    questions.push({
      type: 'select',
      name: 'type',
      message: 'Change waymark type?',
      choices: markers.map((marker) => ({
        title: marker,
        value: marker,
        selected: marker === current.type,
      })),
      initial: current.type,
    });
  }

  if (!options.noSignal) {
    questions.push({
      type: 'confirm',
      name: 'raised',
      message: 'Add raised signal (^)?',
      initial: current.signals.raised,
    });
    questions.push({
      type: 'confirm',
      name: 'important',
      message: 'Add important signal (*)?',
      initial: current.signals.important,
    });
    questions.push({
      type: 'confirm',
      name: 'noSignal',
      message: 'Remove all signals?',
      initial: false,
    });
  }

  if (options.content === undefined) {
    questions.push({
      type: 'toggle',
      name: 'updateContent',
      message: 'Update content text?',
      active: 'Yes',
      inactive: 'No',
      initial: false,
    });
    questions.push({
      type: (prev) => (prev === true ? 'text' : null),
      name: 'content',
      message: 'New content (leave blank to read from stdin)',
      initial: current.contentText,
    });
  }

  if (!options.write) {
    questions.push({
      type: 'confirm',
      name: 'confirmWrite',
      message: 'Apply modifications (equivalent to --write)?',
      initial: false,
    });
  }

  return questions;
}

async function loadMarkerTypes(ctx: CommandContext): Promise<string[]> {
  const config = await ctx.projectConfig.load();
  if (Array.isArray(config?.markers) && config.markers.length > 0) {
    return config.markers;
  }
  return DEFAULT_MARKER_TYPES;
}
```

### Phase 4: File I/O

```typescript
async function readWaymark(target: ModifyTarget): Promise<WaymarkRecord> {
  const fileContent = await Bun.file(target.file).text();
  const lines = fileContent.split('\n');

  // Read waymark at target line (may be multi-line)
  const waymarkLines: string[] = [];
  let currentLine = target.line - 1; // 0-indexed

  // Read first line
  waymarkLines.push(lines[currentLine]);

  // Read continuation lines
  while (currentLine + 1 < lines.length) {
    const nextLine = lines[currentLine + 1];
    if (isContinuationLine(nextLine)) {
      waymarkLines.push(nextLine);
      currentLine++;
    } else {
      break;
    }
  }

  // Parse waymark
  const waymarkText = waymarkLines.join('\n');
  const parsed = parse(waymarkText, { file: target.file });

  if (!parsed || parsed.length === 0) {
    throw new Error(`No waymark found at ${target.file}:${target.line}`);
  }

  return parsed[0];
}

async function writeWaymark(
  target: ModifyTarget,
  modified: WaymarkRecord
): Promise<void> {
  const fileContent = await Bun.file(target.file).text();
  const lines = fileContent.split('\n');

  // Determine how many lines to replace (handle multi-line)
  let linesToReplace = 1;
  let currentLine = target.line; // 1-indexed for display

  while (currentLine < lines.length) {
    const nextLine = lines[currentLine];
    if (isContinuationLine(nextLine)) {
      linesToReplace++;
      currentLine++;
    } else {
      break;
    }
  }

  // Replace lines with formatted waymark
  const modifiedLines = modified.raw.split('\n');
  lines.splice(target.line - 1, linesToReplace, ...modifiedLines);

  // Write back to file
  await Bun.write(target.file, lines.join('\n'));
}

function isContinuationLine(line: string): boolean {
  // Check if line is a markerless continuation (:::)
  return /^\s*(?:\/\/|#|<!--|\/\*)\s*:::\s/.test(line);
}

async function refreshIndex(ctx: CommandContext, file: string): Promise<void> {
  await ctx.index.update({ files: [file] });
}
```

### Phase 5: CLI Integration

**File**: `packages/cli/src/index.ts`

```typescript
program
  .command("modify")
  .argument("[target]", "waymark location (file:line)")
  .option("--id <id>", "waymark ID to modify")
  .option("--type <marker>", "change waymark type")
  .option("--raise", "add ^ (raised) signal")
  .option("--important", "add * (important) signal")
  .option("--no-signal", "remove all signals")
  .option("--content <text>", "replace waymark content (use '-' to read from stdin)")
  .option("-w, --write", "apply modifications (default: preview)", false)
  .option("--interactive", "prompt for modifications interactively")
  .option("--json", "output as JSON")
  .option("--jsonl", "output as JSON Lines")
  .option("--prompt", "show agent-facing prompt instead of help")
  .description("modify existing waymarks")
  .addHelpText(
    "after",
    `
Examples:
  $ wm modify src/auth.ts:42 --type fix                # Preview type change
  $ wm modify src/auth.ts:42 --type fix --write        # Apply type change
  $ wm modify --id wm:a3k9m2p --important --write      # Add important signal
  $ wm modify src/auth.ts:42 --raise --write           # Add raised signal
  $ wm modify src/auth.ts:42 --raise --important       # Combine signals
  $ wm modify src/auth.ts:42 --no-signal --write       # Remove all signals
  $ wm modify src/auth.ts:42 --content "new text" --write
  $ printf "new text" | wm modify src/auth.ts:42 --content - --write
  $ wm modify src/auth.ts:42 --interactive             # Guided prompts

Notes:
  - Waymark IDs (wm:xxxxx) are preserved when modifying content
  - Multi-line waymarks are preserved (only first line content changes)
  - Content can be supplied via stdin with --content - (mirrors wm add)
  - Interactive mode still requires a target
  - Preview mode (default) shows changes without applying
  - Use --write flag to apply modifications

See 'wm modify --prompt' for agent-facing documentation.
    `
  )
  .action(async (target: string | undefined, options: ModifyOptions) => {
    try {
      const ctx = createContext(program);
      await runModifyCommand(ctx, target, options);
    } catch (error) {
      writeStderr(error instanceof Error ? error.message : String(error));
      process.exit(1);
    }
  });
```

## Testing Strategy

### Unit Tests

**File**: `packages/cli/src/commands/modify.test.ts`

```typescript
import { describe, test, expect } from "bun:test";
import { Readable } from "node:stream";

import {
  preserveID,
  applyModifications,
  resolveContentInput,
} from "./modify.ts";

describe("preserveID", () => {
  test("preserves ID at end of content", () => {
    const result = preserveID(
      "implement OAuth wm:a3k9m2p",
      "validate JWT"
    );
    expect(result).toBe("validate JWT wm:a3k9m2p");
  });

  test("removes duplicate ID from new content", () => {
    const result = preserveID(
      "old content wm:a3k9m2p",
      "new content wm:a3k9m2p"
    );
    expect(result).toBe("new content wm:a3k9m2p");
  });

  test("returns content as-is when no ID present", () => {
    const result = preserveID(
      "implement OAuth",
      "validate JWT"
    );
    expect(result).toBe("validate JWT");
  });
});

describe("applyModifications", () => {
  test("changes waymark type", () => {
    const current = {
      type: "todo",
      signals: { raised: false, important: false },
      contentText: "implement OAuth"
    };

    const result = applyModifications(current, { type: "fix" });
    expect(result.type).toBe("fix");
  });

  test("adds important signal", () => {
    const current = {
      type: "todo",
      signals: { raised: false, important: false },
      contentText: "implement OAuth"
    };

    const result = applyModifications(current, { important: true });
    expect(result.signals.important).toBe(true);
  });

  test("combines signals correctly", () => {
    const current = {
      type: "todo",
      signals: { raised: false, important: true },
      contentText: "implement OAuth"
    };

    const result = applyModifications(current, { raised: true });
    expect(result.signals.raised).toBe(true);
    expect(result.signals.important).toBe(true);
  });

  test("removes all signals", () => {
    const current = {
      type: "todo",
      signals: { raised: true, important: true },
      contentText: "implement OAuth"
    };

    const result = applyModifications(current, { noSignal: true });
    expect(result.signals.raised).toBe(false);
    expect(result.signals.important).toBe(false);
  });
});

describe("resolveContentInput", () => {
  test("returns inline content", async () => {
    const result = await resolveContentInput({ content: "inline" });
    expect(result).toBe("inline");
  });

  test("reads content from stdin sentinel", async () => {
    const stream = Readable.from(["stdin payload\n"]);
    const result = await resolveContentInput({ content: "-" }, stream);
    expect(result).toBe("stdin payload");
  });
});
```

### Integration Tests

```typescript
import { Readable } from "node:stream";
import { vi } from "bun:test";

describe("modify command integration", () => {
  test("modifies waymark type", async () => {
    const tmpFile = await createTempFile(`
// todo ::: implement OAuth
    `.trim());

    await runModifyCommand(
      ctx,
      `${tmpFile}:1`,
      { type: "fix", write: true }
    );

    const result = await Bun.file(tmpFile).text();
    expect(result).toBe("// fix ::: implement OAuth");
  });

  test("preserves ID when modifying content", async () => {
    const tmpFile = await createTempFile(`
// todo ::: implement OAuth wm:a3k9m2p
    `.trim());

    await runModifyCommand(
      ctx,
      `${tmpFile}:1`,
      { content: "validate JWT", write: true }
    );

    const result = await Bun.file(tmpFile).text();
    expect(result).toBe("// todo ::: validate JWT wm:a3k9m2p");
  });

  test("preserves multi-line structure", async () => {
    const tmpFile = await createTempFile(`
// todo ::: implement OAuth
//      ::: with PKCE flow
    `.trim());

    await runModifyCommand(
      ctx,
      `${tmpFile}:1`,
      { important: true, write: true }
    );

    const result = await Bun.file(tmpFile).text();
    expect(result).toContain("// *todo ::: implement OAuth");
    expect(result).toContain("//       ::: with PKCE flow");
  });

  test("accepts content from stdin", async () => {
    const tmpFile = await createTempFile(`
// todo ::: implement OAuth
    `.trim());
    const stdin = Readable.from(["validate JWT"]);
    const ctxWithStdin = { ...ctx, stdin };

    await runModifyCommand(
      ctxWithStdin,
      `${tmpFile}:1`,
      { content: "-", write: true }
    );

    const result = await Bun.file(tmpFile).text();
    expect(result).toBe("// todo ::: validate JWT");
  });

  test("refreshes index after write", async () => {
    const tmpFile = await createTempFile(`
// todo ::: implement OAuth
    `.trim());
    const refreshSpy = vi.spyOn(ctx.index, "update");

    await runModifyCommand(
      ctx,
      `${tmpFile}:1`,
      { important: true, write: true }
    );

    expect(refreshSpy).toHaveBeenCalledWith({ files: [tmpFile] });
  });
});
```

Interactive flows can be covered with `prompts.inject([...])` to simulate user choices and confirm that `--interactive` sessions respect preview-versus-write behavior before writing.

## Future Enhancements (v1.1+)

These features are **out of scope** for v1.0 but documented for future consideration:

### Advanced Content Operations

```bash
# Prepend text (v1.1)
wm modify src/auth.ts:42 --prepend "URGENT: " --write

# Append text (v1.1)
wm modify src/auth.ts:42 --append " (see #123)" --write

# Find/replace in content (v1.1)
wm modify src/auth.ts:42 --replace "OAuth" "JWT" --write
```

### Property Management

```bash
# Add property (v1.1)
wm modify src/auth.ts:42 --add-property owner:@alice --write

# Update property (v1.1)
wm modify src/auth.ts:42 --update-property priority:high --write

# Remove property (v1.1)
wm modify src/auth.ts:42 --remove-property owner --write
```

### Relation Management

```bash
# Add relations (v1.1)
wm modify src/auth.ts:42 --add-ref "#auth/core" --write
wm modify src/auth.ts:42 --add-depends "#db/migration" --write

# Remove relations (v1.1)
wm modify src/auth.ts:42 --remove-depends "#old/dep" --write
```

### Mention/Tag Operations

```bash
# Mentions (v1.1)
wm modify src/auth.ts:42 --add-mention @bob --write
wm modify src/auth.ts:42 --remove-mention @alice --write

# Tags (v1.1)
wm modify src/auth.ts:42 --add-tag "#urgent" --write
wm modify src/auth.ts:42 --remove-tag "#blocked" --write
```

### Batch Operations

```bash
# Criteria-based modifications (v1.2)
wm modify --criteria "type:todo mention:@agent" src/ --important --write

# JSON batch input (v1.2)
wm modify --from modifications.json --write
```

## Open Questions

1. **Index refresh strategy** — **Resolved**
   - Auto-refresh after every successful write (core principle)
   - `refreshIndex(ctx, file)` runs inside `runModifyCommand`

2. **Should modification history be tracked?**
   - Lean no for v1.0: Keep it simple
   - Consider for v1.1: Track in history.json for audit trail

3. **How to handle modifications to waymarks not in index?**
   - Allow modifications to any waymark (indexed or not)
   - ID-based targeting requires index entry
   - File:line targeting works regardless

4. **Should we validate marker types before applying?**
   - Warn on unknown markers (like insert command)
   - Allow override with `--force` flag?

## Decision Log

- **2025-10-05**: Simplified to v1.0 scope (type, signal, content only)
- **2025-10-05**: Replaced `--signal` flag with explicit `--raise`, `--important`, and `--no-signal`
- **2025-10-05**: Flag changed from `--set-content` to `--content` (consistency)
- **2025-10-05**: ID preservation required for all content modifications
- **2025-10-05**: Multi-line waymarks preserve continuation lines unchanged
- **2025-10-05**: Added `--interactive` flow and stdin content support; refresh index automatically after writes
