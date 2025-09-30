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
  config: {
    name: "config",
    type: "string",
    placeholder: "path",
    description: "Load additional config file (JSON/YAML/TOML)",
  },
  scope: {
    name: "scope",
    type: "string",
    placeholder: "project|global|default",
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
  pretty: {
    name: "pretty",
    type: "boolean",
    description: "Output as pretty-printed JSON",
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
    usage: "wm format <file> [options]",
    description:
      "Format waymark comments in a file, normalizing spacing, case, and alignment.",
    flags: [commonFlags.write, commonFlags.config, commonFlags.help],
    examples: [
      "wm format src/index.ts             # Preview formatting changes",
      "wm format src/index.ts --write     # Apply formatting changes",
      "wm format src/index.ts -w          # Apply formatting (short form)",
    ],
  },
  lint: {
    name: "lint",
    usage: "wm lint <file...> [options]",
    description:
      "Validate waymark types against configured allowlist and grammar rules.",
    flags: [commonFlags.json, commonFlags.config, commonFlags.help],
    examples: [
      "wm lint src/                       # Lint all files in src/",
      "wm lint src/*.ts                   # Lint TypeScript files",
      "wm lint src/ --json                # Output results as JSON",
    ],
  },
  migrate: {
    name: "migrate",
    usage: "wm migrate <file> [options]",
    description: "Convert legacy TODO/FIXME/NOTE comments to waymark syntax.",
    flags: [commonFlags.write, commonFlags.config, commonFlags.help],
    examples: [
      "wm migrate src/legacy.ts           # Preview migration",
      "wm migrate src/legacy.ts --write   # Apply migration",
      "wm migrate src/ --write            # Migrate all files in directory",
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
      alias: "r",
      type: "boolean",
      description: "Show only raised (^) waymarks",
    },
    {
      name: "starred",
      alias: "s",
      type: "boolean",
      description: "Show only important (*) waymarks",
    },
    {
      name: "map",
      type: "boolean",
      description: "Display as file tree with TLDR summaries",
    },
    {
      name: "graph",
      type: "boolean",
      description: "Display as relation graph",
    },
    {
      name: "summary",
      type: "boolean",
      description: "Include summary footer (with --map)",
    },
    commonFlags.json,
    commonFlags.jsonl,
    commonFlags.pretty,
    commonFlags.config,
    commonFlags.scope,
    commonFlags.help,
    commonFlags.version,
  ],
  examples: [
    "wm src/                            # Scan and display all waymarks",
    "wm --type todo                     # Show all TODOs",
    "wm --type todo --raised            # Show raised TODOs (^todo)",
    "wm --mention @alice                # Show waymarks mentioning @alice",
    "wm --tag perf                      # Show waymarks tagged #perf",
    "wm --map                           # Show file tree with TLDRs",
    "wm --graph                         # Show relation graph",
    "wm src/ --json                     # Output as JSON",
  ],
};
