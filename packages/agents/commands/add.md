---
description: Interactively add a waymark to a file
argument-hint: [file-path] [marker-type]
allowed-tools: AskUserQuestion, Edit, Read, Write, Bash(wm:*)
---

<!-- tldr ::: guide interactive waymark addition to files with proper syntax -->

# Add Waymark Command

Guide the user through adding a waymark to a file.

## Arguments

- `$1` - File path (required)
- `$2` - Marker type (optional: tldr, todo, fix, note, about, etc.)

## Context Injection

Target file: !`[ -f "$1" ] && cat "$1" | head -100 || echo "File: $1 (will be created)"`
Existing waymarks: !`[ -f "$1" ] && (wm find "$1" --text 2>/dev/null || rg ':::' "$1" -n) || echo "No existing waymarks"`

## Instructions

Load the `using-waymarks` skill for grammar and marker guidance.

### Step 1: Context Gathering

If file path provided:

1. Read the file: @$1
2. Check for existing waymarks, especially `tldr :::`
3. Understand file purpose from code/content

If no file path:

1. Use AskUserQuestion to ask which file to annotate
2. Proceed with that file

### Step 2: Marker Selection

If marker type provided ($2), use it.

Otherwise, use AskUserQuestion to determine intent:

- "Add file summary" → `tldr`
- "Mark a task" → `todo`
- "Flag a bug" → `fix`
- "Add context/note" → `note`
- "Describe a section" → `about`
- "Add a warning" → `warn`

### Step 3: Content Drafting

Based on marker type:

**For `tldr`:**

- Must be first waymark in file
- Write 8-14 word active voice sentence
- Lead with capability, end with key detail
- Add relevant tags (`#docs` for documentation)

**For `about`:**

- Place above the target section/function/class
- Describe what the following code does
- Keep scope local, not file-wide

**For `todo`/`fix`:**

- Include actionable description
- Add mentions if assigning (`@agent`, `@alice`)
- Add tags for categorization

**For `note`/`warn`:**

- State the important context or constraint
- Keep it factual and specific

### Step 4: Placement

Determine correct insertion point:

- `tldr` → After shebang/frontmatter, before code
- `about` → Line above target construct
- Others → Near relevant code

### Step 5: Insert

Use Edit tool to insert the waymark with proper comment syntax for the file type.

If `wm` CLI available, prefer:

```bash
wm add $1 --type <marker> --content "<content>" --line <line>
```

### Step 6: Verify

Show the user the inserted waymark and surrounding context for confirmation.
