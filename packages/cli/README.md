# @waymarks/cli

Command-line interface for scanning, filtering, formatting, and managing waymarks in your codebase.

## Installation

### Global Installation

```bash
# Using npm
npm install -g @waymarks/cli

# Using bun
bun add -g @waymarks/cli
```

### Project Installation

```bash
# Using npm
npm install --save-dev @waymarks/cli

# Using bun
bun add -d @waymarks/cli
```

## Usage

The CLI is available as `wm` (or `waymark` as an alias):

```bash
# Scan and display waymarks
wm src/

# Filter by type, tags, mentions
wm src/ --type todo --mention @agent --tag "#perf"

# Graph mode: dependency relations
wm src/ --graph

# Format files
wm fmt src/auth.ts --write

# Insert waymarks
wm add src/auth.ts:42 todo "implement rate limiting"

# Remove waymarks
wm rm src/auth.ts:42 --write

# Edit existing waymarks
wm edit src/auth.ts:42 --raised --write

# Lint waymarks
wm lint src/
```

## Key Commands

- `wm [paths...]` - Scan and filter waymarks (default command)
- `wm fmt [paths...]` - Format and normalize waymark syntax
- `wm add <file:line> <type> <content>` - Insert waymarks into files
- `wm edit <file:line>` - Edit existing waymarks
- `wm rm <file:line>` - Remove waymarks from files
- `wm lint [paths...]` - Validate waymark structure and surface legacy codetags
- `wm init` - Initialize waymark configuration
- `wm update` - Check for and install CLI updates

## Output Formats

```bash
wm src/ --json              # Compact JSON array
wm src/ --jsonl             # Newline-delimited JSON
wm src/ --text              # Human-readable formatted text
wm src/ --long              # Detailed record information
wm src/ --tree              # Tree view grouped by directory
```

## Shell Completions

Generate completions with the built-in `wm completions` command:

```bash
# Zsh
wm completions zsh > ~/.local/share/waymark/completions/wm.zsh
echo 'source ~/.local/share/waymark/completions/wm.zsh' >> ~/.zshrc

# Bash
wm completions bash > ~/.local/share/waymark/completions/wm.bash
echo 'source ~/.local/share/waymark/completions/wm.bash' >> ~/.bashrc

# Fish
wm completions fish > ~/.config/fish/completions/wm.fish

# PowerShell
wm completions powershell > ~/.config/waymark/completions/wm.ps1
Add-Content $PROFILE "`n. ~/.config/waymark/completions/wm.ps1"
```

Run `wm completions` with no arguments to see the supported shells. Note: `wm complete` is also supported as a backward-compatible alias.

## Documentation

See the [main README](../../README.md) for comprehensive CLI documentation and the [Waymark specification](../../docs/GRAMMAR.md) for grammar details.

## License

MIT
