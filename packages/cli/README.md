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

# Map mode: file tree with TLDRs
wm src/ --map

# Graph mode: dependency relations
wm src/ --graph

# Format files
wm format src/auth.ts --write

# Insert waymarks
wm insert src/auth.ts:42 todo "implement rate limiting"

# Remove waymarks
wm remove src/auth.ts:42 --write

# Modify existing waymarks
wm modify src/auth.ts:42 --raise --write

# Lint waymarks
wm lint src/
```

## Key Commands

- `wm [paths...]` - Scan and filter waymarks (default command)
- `wm format <file>` - Format and normalize waymark syntax
- `wm insert <file:line> <type> <content>` - Insert waymarks into files
- `wm modify <file:line>` - Modify existing waymarks
- `wm remove <file:line>` - Remove waymarks from files
- `wm lint <files...>` - Validate waymark structure
- `wm migrate <file>` - Convert legacy patterns to waymark syntax
- `wm init` - Initialize waymark configuration
- `wm update` - Check for and install CLI updates

## Output Formats

```bash
wm src/ --json              # Compact JSON array
wm src/ --jsonl             # Newline-delimited JSON
wm src/ --pretty            # Pretty-printed JSON
wm src/ --long              # Detailed record information
wm src/ --tree              # Tree view grouped by directory
```

## Shell Completions

Shell completions are available for zsh, bash, fish, PowerShell, and nushell. See [completions/README.md](./completions/README.md) for installation instructions.

## Documentation

See the [main README](../../README.md) for comprehensive CLI documentation and the [Waymark specification](../../docs/waymark/SPEC.md) for grammar details.

## License

MIT
