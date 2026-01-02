// tldr ::: centralized help text registry for all CLI commands

import type { CommandConfig, FlagConfig, HelpRegistry } from "./types.ts";

// Shared flag definitions
const commonFlags = {
  help: {
    name: "help",
    alias: "h",
    type: "boolean",
    description: "Show this help message",
  },
  version: {
    name: "version",
    alias: "v",
    type: "boolean",
    description: "Show version number",
  },
  prompt: {
    name: "prompt",
    type: "boolean",
    description: "Show agent-facing prompt instead of executing",
  },
  config: {
    name: "config",
    type: "string",
    placeholder: "path",
    description: "Load additional config file (JSON/YAML/TOML)",
  },
  scope: {
    name: "scope",
    alias: "s",
    type: "string",
    placeholder: "project|user|default",
    description: "Select config scope",
  },
  json: {
    name: "json",
    type: "boolean",
    description: "Output as JSON array",
  },
  jsonl: {
    name: "jsonl",
    type: "boolean",
    description: "Output as JSON lines (newline-delimited)",
  },
  text: {
    name: "text",
    type: "boolean",
    description: "Output as human-readable formatted text",
  },
  pretty: {
    name: "pretty",
    type: "boolean",
    description: "(deprecated: use --text) Output as pretty-printed JSON",
  },
  long: {
    name: "long",
    type: "boolean",
    description: "Show detailed record information",
  },
  tree: {
    name: "tree",
    type: "boolean",
    description: "Group output by directory",
  },
  flat: {
    name: "flat",
    type: "boolean",
    description: "Show flat list output",
  },
  compact: {
    name: "compact",
    type: "boolean",
    description: "Compact output format",
  },
  noColor: {
    name: "no-color",
    type: "boolean",
    description: "Disable ANSI colors",
  },
  group: {
    name: "group",
    type: "string",
    placeholder: "file|dir|type",
    description: "Group results by field",
  },
  sort: {
    name: "sort",
    type: "string",
    placeholder: "file|line|type|modified",
    description: "Sort results by field",
  },
  context: {
    name: "context",
    alias: "C",
    type: "string",
    placeholder: "n",
    description: "Show N lines of context",
  },
  after: {
    name: "after",
    alias: "A",
    type: "string",
    placeholder: "n",
    description: "Show N lines after matches (alias: --after-context)",
  },
  before: {
    name: "before",
    alias: "B",
    type: "string",
    placeholder: "n",
    description: "Show N lines before matches (alias: --before-context)",
  },
  limit: {
    name: "limit",
    alias: "n",
    type: "string",
    placeholder: "n",
    description: "Limit number of results",
  },
  page: {
    name: "page",
    type: "string",
    placeholder: "n",
    description: "Page number (used with --limit)",
  },
  write: {
    name: "write",
    alias: "w",
    type: "boolean",
    description: "Write changes to file (default: stdout)",
  },
} as const satisfies Record<string, FlagConfig>;

// Command-specific configurations
export const commands: HelpRegistry = {
  format: {
    name: "format",
    usage: "wm format <paths...> [options]",
    description:
      "Format waymark comments in a file, normalizing spacing, case, and alignment.",
    flags: [
      commonFlags.write,
      commonFlags.config,
      commonFlags.prompt,
      commonFlags.help,
    ],
    examples: [
      "wm format src/index.ts             # Preview formatting changes",
      "wm format src/index.ts --write     # Apply formatting changes",
      "wm format src/index.ts -w          # Apply formatting (short form)",
      "wm format src/ --write             # Format all waymarks in a directory",
    ],
  },
  lint: {
    name: "lint",
    usage: "wm lint <file...> [options]",
    description:
      "Validate waymark types against configured allowlist and grammar rules.",
    flags: [
      commonFlags.json,
      commonFlags.config,
      commonFlags.prompt,
      commonFlags.help,
    ],
    examples: [
      "wm lint src/                       # Lint all files in src/",
      "wm lint src/*.ts                   # Lint TypeScript files",
      "wm lint src/ --json                # Output results as JSON",
    ],
  },
  help: {
    name: "help",
    usage: "wm help [command]",
    description: "Show help for a specific command or general usage.",
    examples: [
      "wm help                            # Show general help",
      "wm help format                     # Show format command help",
      "wm help lint                       # Show lint command help",
    ],
  },
  add: {
    name: "add",
    usage: "wm add <file:line> <type> <content> [options]",
    description: "Add waymarks into files programmatically.",
    flags: [
      commonFlags.write,
      {
        name: "from",
        type: "string",
        placeholder: "path",
        description: "Read insertion specs from JSON/JSONL file",
      },
      {
        name: "type",
        type: "string",
        placeholder: "todo|fix|...",
        description: "Waymark type (required when not using --from)",
      },
      {
        name: "content",
        type: "string",
        placeholder: "text|-",
        description: "Waymark content (use '-' to read from stdin)",
      },
      {
        name: "position",
        type: "string",
        placeholder: "before|after",
        description: "Insert position relative to line",
      },
      {
        name: "before",
        type: "boolean",
        description: "Insert before target line (shorthand)",
      },
      {
        name: "after",
        type: "boolean",
        description: "Insert after target line (shorthand)",
      },
      {
        name: "mention",
        type: "string",
        placeholder: "@handle",
        description: "Add mention (repeatable)",
      },
      {
        name: "tag",
        type: "string",
        placeholder: "#tag",
        description: "Add hashtag (repeatable)",
      },
      {
        name: "property",
        type: "string",
        placeholder: "key:value",
        description: "Add property (repeatable)",
      },
      {
        name: "ref",
        type: "string",
        placeholder: "token",
        description: "Set canonical reference token",
      },
      {
        name: "depends",
        type: "string",
        placeholder: "token",
        description: "Add dependency relation (repeatable)",
      },
      {
        name: "needs",
        type: "string",
        placeholder: "token",
        description: "Add needs relation (repeatable)",
      },
      {
        name: "blocks",
        type: "string",
        placeholder: "token",
        description: "Add blocks relation (repeatable)",
      },
      {
        name: "continuation",
        type: "string",
        placeholder: "text",
        description: "Add continuation line (repeatable)",
      },
      {
        name: "signal",
        type: "string",
        placeholder: "^|*",
        description: "Add signal (^ raised, * starred)",
      },
      {
        name: "raised",
        alias: "R",
        type: "boolean",
        description: "Add raised signal (^)",
      },
      {
        name: "starred",
        type: "boolean",
        description: "Add starred signal (*)",
      },
      {
        name: "order",
        type: "string",
        placeholder: "n",
        description: "Insertion order for batch operations",
      },
      {
        name: "id",
        type: "string",
        placeholder: "wm:abcdef",
        description: "Reserve specific ID for waymark",
      },
      commonFlags.json,
      commonFlags.jsonl,
      commonFlags.config,
      commonFlags.prompt,
      commonFlags.help,
    ],
    examples: [
      'wm add src/auth.ts:42 todo "implement OAuth"',
      'wm add src/db.ts:15 note "assumes UTC" --mention @alice',
      'wm add src/api.ts:10 todo "add caching" --tag #perf --raised',
      "wm add --from waymarks.json --write",
    ],
  },
  insert: {
    name: "insert",
    usage: "wm insert (deprecated, use 'wm add' instead)",
    description: "Deprecated alias for 'add' command.",
    flags: [],
    examples: ["wm add src/auth.ts:42 todo \"use 'add' instead of 'insert'\""],
  },
  modify: {
    name: "modify",
    usage: "wm modify [file:line] [options]",
    description:
      "Update existing waymarks in place by adjusting type, signals, or content.",
    flags: [
      commonFlags.write,
      {
        name: "no-interactive",
        type: "boolean",
        description:
          "Skip automatic interactive prompts when no target is provided",
      },
      {
        name: "id",
        type: "string",
        placeholder: "wm:abcdef",
        description: "Target waymark by ID instead of file:line",
      },
      {
        name: "type",
        type: "string",
        placeholder: "todo|fix|...",
        description: "Change waymark type",
      },
      {
        name: "content",
        type: "string",
        placeholder: "text|-",
        description: "Replace content (- reads from stdin)",
      },
      {
        name: "raised",
        alias: "R",
        type: "boolean",
        description: "Add raised signal (^)",
      },
      {
        name: "mark-starred",
        type: "boolean",
        description: "Add starred signal (*)",
      },
      {
        name: "clear-signals",
        type: "boolean",
        description: "Remove all signals",
      },
      commonFlags.json,
      commonFlags.jsonl,
      commonFlags.config,
      commonFlags.prompt,
      commonFlags.help,
    ],
    examples: [
      "wm modify src/auth.ts:42 --type fix",
      "wm modify --id wm:a3k9m2p --starred --write",
      'printf "new copy" | wm modify src/auth.ts:42 --content - --write',
      "wm modify                                # Interactive prompts (no args)",
      "wm modify --no-interactive --id wm:a3k9m2p",
    ],
  },
  remove: {
    name: "remove",
    usage: "wm remove <file:line> [options]",
    description: "Remove waymarks from files programmatically.",
    flags: [
      commonFlags.write,
      {
        name: "from",
        type: "string",
        placeholder: "path",
        description: "Read removal specs from JSON/JSONL file",
      },
      {
        name: "reason",
        type: "string",
        placeholder: "text",
        description: "Record removal reason in history",
      },
      {
        name: "id",
        type: "string",
        placeholder: "wm:abcdef",
        description: "Remove by ID (repeatable)",
      },
      {
        name: "type",
        type: "string",
        placeholder: "todo|fix|...",
        description: "Filter by waymark type",
      },
      {
        name: "tag",
        type: "string",
        placeholder: "#tag",
        description: "Filter by hashtag (repeatable)",
      },
      {
        name: "mention",
        type: "string",
        placeholder: "@handle",
        description: "Filter by mention (repeatable)",
      },
      {
        name: "property",
        type: "string",
        placeholder: "key:value",
        description: "Filter by property (repeatable)",
      },
      {
        name: "file",
        type: "string",
        placeholder: "path",
        description: "Filter by file pattern (repeatable)",
      },
      {
        name: "content-pattern",
        type: "string",
        placeholder: "regex",
        description: "Filter by content regex pattern",
      },
      {
        name: "contains",
        type: "string",
        placeholder: "text",
        description: "Filter by content substring",
      },
      {
        name: "raised",
        alias: "R",
        type: "boolean",
        description: "Filter by raised signal (^)",
      },
      {
        name: "starred",
        alias: "S",
        type: "boolean",
        description: "Filter by starred signal (*)",
      },
      {
        name: "yes",
        alias: "y",
        type: "boolean",
        description: "Skip confirmation prompt",
      },
      {
        name: "confirm",
        type: "boolean",
        description: "Force confirmation prompt",
      },
      commonFlags.json,
      commonFlags.jsonl,
      commonFlags.config,
      commonFlags.prompt,
      commonFlags.help,
    ],
    examples: [
      "wm remove src/auth.ts:42              # Preview removal",
      "wm remove src/auth.ts:42 --write      # Actually remove",
      "wm remove --id wm:a3k9m2p --write     # Remove by ID",
      "wm remove --type todo --tag #wip --write --yes  # Batch removal",
      'wm remove src/auth.ts:42 --write --reason "cleanup"',
    ],
  },
  init: {
    name: "init",
    usage: "wm init [options]",
    description:
      "Initialize waymark configuration file with interactive prompts or flags.",
    flags: [
      {
        name: "format",
        alias: "f",
        type: "string",
        placeholder: "toml|jsonc|yaml|yml",
        description: "Config file format",
      },
      {
        name: "preset",
        alias: "p",
        type: "string",
        placeholder: "full|minimal",
        description: "Config preset template",
      },
      {
        name: "scope",
        alias: "s",
        type: "string",
        placeholder: "project|user",
        description: "Config scope",
      },
      {
        name: "force",
        type: "boolean",
        description: "Overwrite existing config file",
      },
      commonFlags.help,
    ],
    examples: [
      "wm init                               # Interactive prompts",
      "wm init --format toml --scope project # Create project config",
      "wm init --preset minimal --force      # Overwrite with minimal config",
    ],
  },
  update: {
    name: "update",
    usage: "wm update [options]",
    description:
      "Update CLI to the latest version using the detected install method (npm global or workspace).",
    flags: [
      {
        name: "dry-run",
        alias: "n",
        type: "boolean",
        description: "Print update command without executing",
      },
      {
        name: "force",
        alias: "f",
        type: "boolean",
        description: "Force update even if install method is unknown",
      },
      {
        name: "yes",
        alias: "y",
        type: "boolean",
        description: "Skip confirmation prompt",
      },
      {
        name: "command",
        type: "string",
        placeholder: "cmd",
        description: "Override auto-detected update command",
      },
      commonFlags.help,
    ],
    examples: [
      "wm update                             # Update with confirmation",
      "wm update --yes                       # Update without confirmation",
      "wm update --dry-run                   # Preview update command",
    ],
  },
};

// Main command (unified search/display)
export const mainCommand: CommandConfig = {
  name: "wm",
  usage: "wm [query] [paths...] [options]",
  description: `
Search and display waymarks across your codebase.

The primary interface for finding and viewing waymarks. Supports natural language
queries, filtering by type/tag/mention, and multiple output formats.
	`.trim(),
  flags: [
    {
      name: "type",
      alias: "t",
      type: "string",
      placeholder: "type",
      description: "Filter by waymark type (todo, fix, note, etc.)",
    },
    {
      name: "tldr",
      type: "boolean",
      description: "Shorthand for --type tldr (show TLDR summaries)",
    },
    {
      name: "tag",
      type: "string",
      placeholder: "#tag",
      description: "Filter by hashtag",
    },
    {
      name: "mention",
      type: "string",
      placeholder: "@handle",
      description: "Filter by mention",
    },
    {
      name: "raised",
      alias: "R",
      type: "boolean",
      description: "Show only raised (^) waymarks",
    },
    {
      name: "starred",
      alias: "S",
      type: "boolean",
      description: "Show only starred (*) waymarks (important/valuable)",
    },
    {
      name: "graph",
      type: "boolean",
      description: "Display as relation graph",
    },
    commonFlags.json,
    commonFlags.jsonl,
    commonFlags.text,
    commonFlags.pretty,
    commonFlags.long,
    commonFlags.tree,
    commonFlags.flat,
    commonFlags.compact,
    commonFlags.noColor,
    commonFlags.group,
    commonFlags.sort,
    commonFlags.context,
    commonFlags.after,
    commonFlags.before,
    commonFlags.limit,
    commonFlags.page,
    commonFlags.config,
    commonFlags.scope,
    commonFlags.prompt,
    commonFlags.help,
    commonFlags.version,
  ],
  examples: [
    "wm src/                            # Scan and display all waymarks",
    "wm --type todo                     # Show all TODOs",
    "wm --tldr                          # Show all TLDRs (shorthand)",
    "wm --type todo --raised            # Show raised TODOs (^todo)",
    "wm --mention @alice                # Show waymarks mentioning @alice",
    "wm --tag perf                      # Show waymarks tagged #perf",
    "wm --graph                         # Show relation graph",
    "wm src/ --json                     # Output as JSON",
  ],
};
