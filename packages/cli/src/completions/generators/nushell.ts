// tldr ::: nushell completion generator for waymark CLI

import type { CompletionGenerator, GeneratorOptions } from "./types.ts";
import { getTypesString } from "./utils.ts";

export class NushellGenerator implements CompletionGenerator {
  private readonly options: GeneratorOptions;

  constructor(options: GeneratorOptions) {
    this.options = options;
  }

  getFilename(): string {
    return "wm.nu";
  }

  generate(): string {
    const _typesString = getTypesString(this.options.types);
    const allTypes = this.options.types;

    return `# tldr ::: nushell completion script for waymark CLI

# Main wm command
export extern "wm" [
    ...paths: string # Files or directories to scan
    --version(-v) # Output version number
    --scope: string@"nu-complete wm scope" # Config scope
    --verbose # Enable verbose logging
    --debug # Enable debug logging
    --quiet(-q) # Only show errors
    --help(-h) # Display help
    --prompt # Show agent-facing documentation
    --type(-t): string@"nu-complete wm types" # Filter by waymark type
    --tag: string # Filter by hashtag
    --mention: string # Filter by mention
    --raised(-r) # Show only raised waymarks
    --starred(-s) # Show only important waymarks
    --map # Show file tree with TLDRs
    --graph # Show dependency graph
    --summary # Show summary footer
    --json # Output as JSON
    --jsonl # Output as JSON Lines
    --pretty # Output as pretty JSON
    --long # Show detailed information
    --tree # Group by directory
    --flat # Show flat list
    --keep-comment-markers # Keep comment syntax
    --compact # Compact output
    --no-color # Disable colors
    --group: string@"nu-complete wm group" # Group by
    --sort: string@"nu-complete wm sort" # Sort by
    --context(-C): int # Context lines
    --after(-A): int # Lines after
    --before(-B): int # Lines before
    --limit: int # Limit results
    --page: int # Page number
]

# Format command
export extern "wm format" [
    file: string # File to format
    --write(-w) # Write changes to file
    --help(-h) # Display help
    --prompt # Show agent-facing documentation
]

# Insert command
export extern "wm insert" [
    ...args: string # file:line type content or JSON input
    --from: string # Read from JSON file
    --mention: string # Add mention
    --tag: string # Add hashtag
    --property: string # Add property
    --ref: string # Set canonical reference
    --depends: string # Add dependency
    --needs: string # Add needs relation
    --blocks: string # Add blocks relation
    --signal: string@"nu-complete wm signal" # Add signal
    --json # Output as JSON
    --jsonl # Output as JSON Lines
    --help(-h) # Display help
    --prompt # Show agent-facing documentation
]

# Modify command
export extern "wm modify" [
    target?: string # Optional file:line target
    --id: string # Modify by waymark ID
    --type: string@"nu-complete wm types" # Change waymark type
    --raise # Add raised signal (^)
    --important # Add important signal (*)
    --no-signal # Remove all signals
    --content: string # Replace content (use '-' for stdin)
    --write(-w) # Apply modifications
    --interactive # Interactive flow
    --json # Output as JSON
    --jsonl # Output as JSON Lines
    --help(-h) # Display help
    --prompt # Show agent-facing documentation
]

# Remove command
export extern "wm remove" [
    ...args: string # file:line or other removal targets
    --write(-w) # Actually remove
    --id: string # Remove by ID
    --from: string # Read from JSON file
    --criteria: string # Filter criteria
    --yes # Skip confirmation
    --confirm # Force confirmation
    --json # Output as JSON
    --jsonl # Output as JSON Lines
    --help(-h) # Display help
    --prompt # Show agent-facing documentation
]

# Lint command
export extern "wm lint" [
    ...files: string # Files to lint
    --json # Output as JSON
    --help(-h) # Display help
    --prompt # Show agent-facing documentation
]

# Migrate command
export extern "wm migrate" [
    file: string # File to migrate
    --write(-w) # Write changes to file
    --help(-h) # Display help
    --prompt # Show agent-facing documentation
]

# Init command
export extern "wm init" [
    --format(-f): string@"nu-complete wm format" # Config format
    --preset(-p): string@"nu-complete wm preset" # Config preset
    --scope(-s): string@"nu-complete wm init-scope" # Config scope
    --force # Overwrite existing
    --help(-h) # Display help
]

# Update command
export extern "wm update" [
    --dry-run # Print command without executing
    --force # Run even if install method unknown
    --yes # Skip confirmation
    --command: string # Override update command
    --help(-h) # Display help
]

# Help command
export extern "wm help" [
    command?: string@"nu-complete wm commands" # Command to get help for
]

# Completions
def "nu-complete wm commands" [] {
    ["format" "insert" "modify" "remove" "lint" "migrate" "init" "update" "help"]
}

def "nu-complete wm types" [] {
    [${allTypes.map((t) => `"${t}"`).join(" ")}]
}

def "nu-complete wm scope" [] {
    ["default" "project" "user"]
}

def "nu-complete wm group" [] {
    ["file" "dir" "type"]
}

def "nu-complete wm sort" [] {
    ["file" "line" "type" "modified"]
}

def "nu-complete wm signal" [] {
    ["^" "*"]
}

def "nu-complete wm format" [] {
    ["toml" "jsonc" "yaml" "yml"]
}

def "nu-complete wm preset" [] {
    ["full" "minimal"]
}

def "nu-complete wm init-scope" [] {
    ["project" "user"]
}
`;
  }
}
