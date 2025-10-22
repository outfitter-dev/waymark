<!-- tldr ::: CLI installation and quick start guide #docs/cli -->

# Waymark CLI

The `wm` command provides a unified interface for scanning, filtering, formatting, and managing waymarks in your codebase.

## Quick Navigation

- **[Commands Reference](./commands.md)** - Comprehensive command documentation
- **[Waymark Editing](./waymark_editing.md)** - Insert, remove, and modify waymarks
- **[Grammar](../GRAMMAR.md)** - Waymark syntax reference
- **[How-To Guides](../howto/README.md)** - Practical usage examples

---

## Installation

### via npm

```bash
npm install -g @waymarks/cli
```

### via Bun

```bash
bun add -g @waymarks/cli
```

### From Source

```bash
git clone git@github.com:outfitter-dev/waymark.git
cd waymark
bun install
bun run build
bun link @waymarks/cli
```

### Verify Installation

```bash
wm --version
```

---

## Shell Completions

Use the built-in `wm completions` command to generate completions for your shell.
Each command below writes the script to a cache directory and references it from
your shell profile:

```bash
# Zsh
mkdir -p ~/.local/share/waymark/completions
wm completions zsh > ~/.local/share/waymark/completions/wm.zsh
echo 'source ~/.local/share/waymark/completions/wm.zsh' >> ~/.zshrc

# Bash
mkdir -p ~/.local/share/waymark/completions
wm completions bash > ~/.local/share/waymark/completions/wm.bash
echo 'source ~/.local/share/waymark/completions/wm.bash' >> ~/.bashrc

# Fish
mkdir -p ~/.config/fish/completions
wm completions fish > ~/.config/fish/completions/wm.fish

# PowerShell
mkdir -p ~/.config/waymark/completions
wm completions powershell > ~/.config/waymark/completions/wm.ps1
Add-Content $PROFILE "`n. ~/.config/waymark/completions/wm.ps1"
```

Run `wm completions` without arguments to list supported shells and debugging
helpers. Note: `wm complete` is also supported as a backward-compatible alias.

---

## Quick Reference

```bash
# Scan and display waymarks
wm src/                              # all waymarks
wm src/ --type todo                  # filter by type
wm src/ --raised                     # only ^ (WIP)
wm src/ --starred                    # only * (priority)

# Map mode: file tree with TLDRs
wm src/ --map                        # show file tree
wm src/ --map --summary              # with summary footer

# Graph mode: relation edges
wm src/ --graph                      # dependency graph
wm src/ --graph --json               # JSON output

# Formatting and validation
wm format src/example.ts --write     # normalize syntax
wm lint src/                         # validate waymarks

# Waymark management
wm insert src/auth.ts:42 todo "add rate limiting" --write
wm remove src/auth.ts:42 --write
wm modify src/auth.ts:42 --raise --write

# Output formats
wm src/ --json                       # compact JSON
wm src/ --jsonl                      # newline-delimited JSON
wm src/ --pretty                     # pretty-printed JSON

# Configuration
wm init                              # interactive setup
wm init --format toml --scope project
```

---

## Getting Started

### 1. Initialize Configuration

```bash
cd your-project
wm init
```

This creates `.waymark/config.toml` with default settings.

### 2. Add Your First Waymarks

```bash
# Add a file summary (TLDR)
wm insert src/index.ts:1 tldr "application entry point" --write

# Add a TODO
wm insert src/auth.ts:42 todo "implement rate limiting" --write

# Verify
wm src/
```

### 3. Explore the Codebase

```bash
# Show file summaries
wm src/ --map

# Find all TODOs
wm src/ --type todo

# View dependency graph
wm src/ --graph
```

---

## Common Tasks

### Find Work Assigned to You

```bash
wm src/ --type todo --mention @yourname
```

**Tip**: Create a shell alias:

```bash
alias mytodos='wm src/ --type todo --mention @yourname'
```

### Pre-Commit Check

```bash
# Ensure no raised (WIP) waymarks
wm src/ --raised

# Validate waymarks
wm lint src/
```

### Code Review

```bash
# Find items needing review
wm src/ --type review

# Find security-related items
wm src/ --tag "#sec"
```

---

## Next Steps

- **[Commands Reference](./commands.md)** - Learn all commands in depth
- **[Waymark Editing](./waymark_editing.md)** - Master insert/remove/modify
- **[How-To Guides](../howto/README.md)** - See practical workflows
- **[Grammar](../GRAMMAR.md)** - Understand waymark syntax

---

## Getting Help

```bash
# General help
wm help

# Command-specific help
wm help format
wm help insert
```

**Resources**:

- Issue tracker (GitHub: outfitter-dev/waymark, internal) - Report bugs
- [Documentation](../README.md) - Full documentation index
- [Project README](../../README.md) - Project overview
