<!-- tldr ::: CLI installation and quick start guide #docs/cli -->

# Waymark CLI

The `wm` command provides a unified interface for scanning, filtering, formatting, and managing waymarks in your codebase.

## Quick Navigation

- **[Commands Reference](./commands.md)** - Comprehensive command documentation
- **[Waymark Editing](./waymark_editing.md)** - Add, edit, and remove waymarks
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
wm src/ --flagged                    # only ~ (WIP)
wm src/ --starred                    # only * (priority)

# Graph mode: relation edges
wm src/ --graph                      # dependency graph
wm src/ --graph --json               # JSON output

# Formatting and validation
wm fmt src/example.ts --write     # normalize syntax
wm lint src/                         # validate waymarks

# Waymark management
wm add src/auth.ts:42 todo "add rate limiting" --write
wm rm src/auth.ts:42 --write
wm edit src/auth.ts:42 --flagged --write

# Output formats
wm src/ --json                       # compact JSON
wm src/ --jsonl                      # newline-delimited JSON
wm src/ --text                       # human-readable formatted text

# Configuration
wm init                              # interactive setup
wm init --format toml --scope project

# Agent documentation
wm skill                             # core skill docs
wm skill show add                    # command-specific docs
wm skill show skill-format           # skill file format
wm skill show project-skills         # project-specific skills
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
wm add src/index.ts:1 tldr "application entry point" --write

# Add a TODO
wm add src/auth.ts:42 todo "implement rate limiting" --write

# Verify
wm src/
```

### 3. Explore the Codebase

```bash
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
# Ensure no flagged (WIP) waymarks
wm src/ --flagged

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
- **[Waymark Editing](./waymark_editing.md)** - Master add/edit/rm
- **[How-To Guides](../howto/README.md)** - See practical workflows
- **[Grammar](../GRAMMAR.md)** - Understand waymark syntax

---

## Getting Help

```bash
# General help
wm help

# Command-specific help
wm help fmt
wm help add

# Topic help
wm help syntax

# Agent documentation
wm skill
wm skill show workflows
wm skill show skill-format
```

**Resources**:

- Issue tracker (GitHub: outfitter-dev/waymark, internal) - Report bugs
- [Documentation](../README.md) - Full documentation index
- [Project README](../../README.md) - Project overview
