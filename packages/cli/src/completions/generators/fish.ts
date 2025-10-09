// tldr ::: fish completion generator for waymark CLI

import type { CompletionGenerator, GeneratorOptions } from "./types.ts";
import { getTypesString } from "./utils.ts";

export class FishGenerator implements CompletionGenerator {
  private readonly options: GeneratorOptions;

  constructor(options: GeneratorOptions) {
    this.options = options;
  }

  getFilename(): string {
    return "wm.fish";
  }

  generate(): string {
    const typesString = getTypesString(this.options.types);

    return `# tldr ::: fish completion script for waymark CLI

# Common completions
complete -c wm -s v -l version -d "Output version number"
complete -c wm -l scope -d "Config scope" -a "default project user"
complete -c wm -l verbose -d "Enable verbose logging"
complete -c wm -l debug -d "Enable debug logging"
complete -c wm -s q -l quiet -d "Only show errors"
complete -c wm -s h -l help -d "Display help"
complete -c wm -l prompt -d "Show agent-facing documentation"

# Commands
complete -c wm -f -n "__fish_use_subcommand" -a "format" -d "Format waymarks in a file"
complete -c wm -f -n "__fish_use_subcommand" -a "insert" -d "Insert waymarks into files"
complete -c wm -f -n "__fish_use_subcommand" -a "modify" -d "Modify existing waymarks"
complete -c wm -f -n "__fish_use_subcommand" -a "remove" -d "Remove waymarks from files"
complete -c wm -f -n "__fish_use_subcommand" -a "lint" -d "Validate waymark structure"
complete -c wm -f -n "__fish_use_subcommand" -a "migrate" -d "Migrate legacy comments"
complete -c wm -f -n "__fish_use_subcommand" -a "init" -d "Initialize waymark config"
complete -c wm -f -n "__fish_use_subcommand" -a "update" -d "Update CLI to latest version"
complete -c wm -f -n "__fish_use_subcommand" -a "help" -d "Display help for command"

# Format command
complete -c wm -n "__fish_seen_subcommand_from format" -s w -l write -d "Write changes to file"

# Insert command
complete -c wm -n "__fish_seen_subcommand_from insert" -l from -d "Read from JSON file" -r
complete -c wm -n "__fish_seen_subcommand_from insert" -l mention -d "Add mention"
complete -c wm -n "__fish_seen_subcommand_from insert" -l tag -d "Add hashtag"
complete -c wm -n "__fish_seen_subcommand_from insert" -l property -d "Add property"
complete -c wm -n "__fish_seen_subcommand_from insert" -l ref -d "Set canonical reference"
complete -c wm -n "__fish_seen_subcommand_from insert" -l depends -d "Add dependency"
complete -c wm -n "__fish_seen_subcommand_from insert" -l needs -d "Add needs relation"
complete -c wm -n "__fish_seen_subcommand_from insert" -l blocks -d "Add blocks relation"
complete -c wm -n "__fish_seen_subcommand_from insert" -l signal -d "Add signal" -a "^ *"
complete -c wm -n "__fish_seen_subcommand_from insert" -l json -d "Output as JSON"
complete -c wm -n "__fish_seen_subcommand_from insert" -l jsonl -d "Output as JSON Lines"

# Modify command
complete -c wm -n "__fish_seen_subcommand_from modify" -l id -d "Modify by ID"
complete -c wm -n "__fish_seen_subcommand_from modify" -l type -d "Change waymark type" -a "${typesString}"
complete -c wm -n "__fish_seen_subcommand_from modify" -l raise -d "Add raised signal"
complete -c wm -n "__fish_seen_subcommand_from modify" -l important -d "Add important signal"
complete -c wm -n "__fish_seen_subcommand_from modify" -l no-signal -d "Remove all signals"
complete -c wm -n "__fish_seen_subcommand_from modify" -l content -d "Replace content" -r
complete -c wm -n "__fish_seen_subcommand_from modify" -s w -l write -d "Apply modifications"
complete -c wm -n "__fish_seen_subcommand_from modify" -l interactive -d "Interactive flow"
complete -c wm -n "__fish_seen_subcommand_from modify" -l json -d "Output as JSON"
complete -c wm -n "__fish_seen_subcommand_from modify" -l jsonl -d "Output as JSON Lines"

# Remove command
complete -c wm -n "__fish_seen_subcommand_from remove" -s w -l write -d "Actually remove"
complete -c wm -n "__fish_seen_subcommand_from remove" -l id -d "Remove by ID"
complete -c wm -n "__fish_seen_subcommand_from remove" -l from -d "Read from JSON file" -r
complete -c wm -n "__fish_seen_subcommand_from remove" -l criteria -d "Filter criteria"
complete -c wm -n "__fish_seen_subcommand_from remove" -l yes -d "Skip confirmation"
complete -c wm -n "__fish_seen_subcommand_from remove" -l confirm -d "Force confirmation"
complete -c wm -n "__fish_seen_subcommand_from remove" -l json -d "Output as JSON"
complete -c wm -n "__fish_seen_subcommand_from remove" -l jsonl -d "Output as JSON Lines"

# Lint command
complete -c wm -n "__fish_seen_subcommand_from lint" -l json -d "Output as JSON"

# Migrate command
complete -c wm -n "__fish_seen_subcommand_from migrate" -s w -l write -d "Write changes to file"

# Init command
complete -c wm -n "__fish_seen_subcommand_from init" -s f -l format -d "Config format" -a "toml jsonc yaml yml"
complete -c wm -n "__fish_seen_subcommand_from init" -s p -l preset -d "Config preset" -a "full minimal"
complete -c wm -n "__fish_seen_subcommand_from init" -s s -l scope -d "Config scope" -a "project user"
complete -c wm -n "__fish_seen_subcommand_from init" -l force -d "Overwrite existing"

# Update command
complete -c wm -n "__fish_seen_subcommand_from update" -l dry-run -d "Print command without executing"
complete -c wm -n "__fish_seen_subcommand_from update" -l force -d "Run even if install method unknown"
complete -c wm -n "__fish_seen_subcommand_from update" -l yes -d "Skip confirmation"
complete -c wm -n "__fish_seen_subcommand_from update" -l command -d "Override update command" -r

# Help command
complete -c wm -n "__fish_seen_subcommand_from help" -a "format insert modify remove lint migrate init update help"

# Main command (unified) - filters
complete -c wm -n "__fish_use_subcommand" -s t -l type -d "Filter by waymark type" -a "${typesString}"
complete -c wm -n "__fish_use_subcommand" -l tag -d "Filter by hashtag"
complete -c wm -n "__fish_use_subcommand" -l mention -d "Filter by mention"
complete -c wm -n "__fish_use_subcommand" -s r -l raised -d "Show only raised waymarks"
complete -c wm -n "__fish_use_subcommand" -s s -l starred -d "Show only important waymarks"

# Main command (unified) - display
complete -c wm -n "__fish_use_subcommand" -l map -d "Show file tree with TLDRs"
complete -c wm -n "__fish_use_subcommand" -l graph -d "Show dependency graph"
complete -c wm -n "__fish_use_subcommand" -l summary -d "Show summary footer"
complete -c wm -n "__fish_use_subcommand" -l json -d "Output as JSON"
complete -c wm -n "__fish_use_subcommand" -l jsonl -d "Output as JSON Lines"
complete -c wm -n "__fish_use_subcommand" -l pretty -d "Output as pretty JSON"
complete -c wm -n "__fish_use_subcommand" -l long -d "Show detailed information"
complete -c wm -n "__fish_use_subcommand" -l tree -d "Group by directory"
complete -c wm -n "__fish_use_subcommand" -l flat -d "Show flat list"
complete -c wm -n "__fish_use_subcommand" -l keep-comment-markers -d "Keep comment syntax"
complete -c wm -n "__fish_use_subcommand" -l compact -d "Compact output"
complete -c wm -n "__fish_use_subcommand" -l no-color -d "Disable colors"
complete -c wm -n "__fish_use_subcommand" -l group -d "Group by" -a "file dir type"
complete -c wm -n "__fish_use_subcommand" -l sort -d "Sort by" -a "file line type modified"
complete -c wm -n "__fish_use_subcommand" -s C -l context -d "Context lines" -r
complete -c wm -n "__fish_use_subcommand" -s A -l after -d "Lines after" -r
complete -c wm -n "__fish_use_subcommand" -s B -l before -d "Lines before" -r
complete -c wm -n "__fish_use_subcommand" -l limit -d "Limit results" -r
complete -c wm -n "__fish_use_subcommand" -l page -d "Page number" -r
`;
  }
}
