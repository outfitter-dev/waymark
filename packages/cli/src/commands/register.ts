// tldr ::: commander command registration for waymark CLI

import { Command, InvalidArgumentError } from "commander";
import { createUsageError } from "../errors.ts";
import type { ModifyCliOptions } from "../types.ts";
import { parsePropertyEntry } from "../utils/properties.ts";
import type { ConfigCommandOptions } from "./config.ts";
import type { DoctorCommandOptions } from "./doctor.ts";
import { getTopicHelp, helpTopicNames } from "./help/index.ts";
import type { SkillCommandOptions } from "./skill.ts";

const POSITION_ERROR = "--position must be 'before' or 'after'";
const ORDER_ERROR = "--order expects an integer";

type CommandHandlers = {
  handleCommandError: (program: Command, error: unknown) => void;
  handleFormatCommand: (
    program: Command,
    paths: string[],
    options: { write?: boolean }
  ) => Promise<void>;
  handleAddCommand: (program: Command, command: Command) => Promise<void>;
  handleModifyCommand: (
    program: Command,
    command: Command,
    target: string | undefined,
    options: ModifyCliOptions
  ) => Promise<void>;
  handleRemoveCommand: (program: Command, command: Command) => Promise<void>;
  handleUpdateAction: (options: {
    dryRun?: boolean;
    force?: boolean;
    yes?: boolean;
    command?: string;
  }) => Promise<void>;
  handleLintCommand: (
    program: Command,
    paths: string[],
    options: { json?: boolean }
  ) => Promise<void>;
  handleInitCommand: (options: {
    format?: string;
    preset?: string;
    scope?: string;
    force?: boolean;
  }) => Promise<void>;
  handleConfigCommand: (
    program: Command,
    options: ConfigCommandOptions
  ) => Promise<void>;
  handleSkillCommand: (options: SkillCommandOptions) => Promise<void>;
  handleSkillShowCommand: (
    section: string,
    options: SkillCommandOptions
  ) => Promise<void>;
  handleSkillListCommand: () => Promise<void>;
  handleSkillPathCommand: () => void;
  handleDoctorCommand: (
    program: Command,
    options: DoctorCommandOptions
  ) => Promise<void>;
  handleUnifiedCommand: (
    program: Command,
    paths: string[],
    options: Record<string, unknown>
  ) => Promise<void>;
  writeStdout: (message: string) => void;
};

/**
 * Register CLI commands and handlers on the commander program.
 * @param program - Commander program instance.
 * @param handlers - Handler callbacks for each command.
 */
export function registerCommands(
  program: Command,
  handlers: CommandHandlers
): void {
  const {
    handleCommandError,
    handleFormatCommand,
    handleAddCommand,
    handleModifyCommand,
    handleRemoveCommand,
    handleUpdateAction,
    handleLintCommand,
    handleInitCommand,
    handleConfigCommand,
    handleSkillCommand,
    handleSkillShowCommand,
    handleSkillListCommand,
    handleSkillPathCommand,
    handleDoctorCommand,
    handleUnifiedCommand,
    writeStdout,
  } = handlers;

  // Custom help command
  const helpCommand = new Command("help")
    .argument("[command]", "command to get help for")
    .description("display help for command")
    .action((commandName?: string) => {
      try {
        if (!commandName) {
          program.help();
          return;
        }

        const cmd = program.commands.find((c) => c.name() === commandName);
        if (cmd) {
          cmd.help();
          return;
        }

        const topicHelp = getTopicHelp(commandName);
        if (topicHelp) {
          writeStdout(topicHelp);
          return;
        }

        if (helpTopicNames.length > 0) {
          writeStdout(`Available topics: ${helpTopicNames.join(", ")}`);
        }
        throw createUsageError(`Unknown command or topic: ${commandName}`);
      } catch (error) {
        handleCommandError(program, error);
      }
    });

  program.addCommand(helpCommand);

  // Format command
  const fmtCommand = new Command("fmt")
    .argument("[paths...]", "files or directories to format")
    .option("--write, -w", "write changes to file", false)
    .description("format and normalize waymark syntax in files")
    .addHelpText(
      "after",
      `
Examples:
  $ wm fmt src/auth.ts                 # Preview formatting single file
  $ wm fmt src/auth.ts --write         # Apply formatting to single file
  $ wm fmt src/**/*.ts --write         # Format multiple files
  $ wm fmt src/ --write                # Format all files in directory

Notes:
  - Files beginning with a \`waymark-ignore-file\` comment are skipped

Formatting Rules:
  - Exactly one space before and after ::: sigil
  - Marker case normalized (default: lowercase)
  - Multi-line continuations aligned to parent :::
  - Property ordering: relations after free text
  - Signal order: ~ before * when combined

Before Formatting:
  //todo:::implement auth
  // *  fix  ::: validate input

After Formatting:
  // todo ::: implement auth
  // *fix ::: validate input

See 'wm skill show fmt' for agent-facing documentation.
    `
    )
    .action(async (paths: string[], options: { write?: boolean }) => {
      try {
        await handleFormatCommand(program, paths, options);
      } catch (error) {
        handleCommandError(program, error);
      }
    });

  program.addCommand(fmtCommand, { hidden: true });

  const addCommand = new Command("add")
    .argument("[target]", "waymark location (file:line)")
    .argument("[type]", "waymark type (todo, fix, note, etc.)")
    .argument("[content]", "waymark content text")
    .option(
      "--from <file>",
      "read waymark(s) from JSON/JSONL file (use - for stdin)"
    )
    .option("--type <type>", "set waymark type when not provided positionally")
    .option(
      "--content <text>",
      "set waymark content when not provided positionally"
    )
    .option(
      "--position <position>",
      "insert relative to line (before or after)",
      parsePositionOption
    )
    .option("--before", "insert before target line")
    .option("--after", "insert after target line")
    .option(
      "--mention <actor>",
      "add mention (@agent, @alice) - can be repeated",
      collectOption,
      []
    )
    .option(
      "--tag <tag>",
      "add hashtag (#perf, #sec) - can be repeated",
      collectOption,
      []
    )
    .option(
      "--property <kv>",
      "add property (owner:@alice) - can be repeated",
      collectValidatedOption(validatePropertyOption),
      []
    )
    .option(
      "--continuation <text>",
      "add continuation line (repeatable)",
      collectOption,
      []
    )
    .option(
      "--order <n>",
      "insertion order for batch operations",
      parseOrderOption
    )
    .option("--id <id>", "reserve specific ID ([[abcdef]])")
    .option("--flagged, -F", "add flagged (~) signal")
    .option("--starred", "add starred (*) signal")
    .option("--write, -w", "apply changes to file (default: preview)", false)
    .option("--json", "output as JSON")
    .option("--jsonl", "output as JSON Lines")
    .description("add waymarks into files")
    .addHelpText(
      "after",
      `
Arguments:
  <file:line>  Location to add waymark (e.g., src/auth.ts:42)
  <type>       Waymark type (todo, fix, note, tldr, etc.)
  <content>    Waymark content text (quote if contains spaces)

Examples:
  $ wm add src/auth.ts:42 todo "implement rate limiting"
  $ wm add src/db.ts:15 note "assumes UTC" --mention @alice --tag "#time"
  $ wm add src/api.ts:100 fix "validate input" --flagged
  $ wm add src/pay.ts:200 todo "add retry" --tag "#infra/queue"
  $ wm add src/auth.ts:10 todo "insert above" --before
  $ wm add --from waymarks.json
  $ echo '{"file":"src/a.ts","line":10,"type":"todo","content":"test"}' | wm add --from -

Signals:
  ~  Flagged (in-progress work, clear before merging)
  *  Starred (high priority, important)

Types:
  Work:       todo, fix, wip, done, review, test, check
  Info:       note, context, tldr, about, example, idea, comment
  Caution:    warn, alert, deprecated, temp, hack
  Workflow:   blocked, needs
  Inquiry:    question

See 'wm skill show add' for agent-facing documentation.
    `
    )
    .action(async function (this: Command, ..._actionArgs: unknown[]) {
      try {
        await handleAddCommand(program, this);
      } catch (error) {
        handleCommandError(program, error);
      }
    });

  program.addCommand(addCommand);

  const editCommand = new Command("edit")
    .argument("[target]", "waymark location (file:line)")
    .option("--id <id>", "waymark ID to edit")
    .option("--type <marker>", "change waymark type")
    .option("--flagged, -F", "add ~ (flagged) signal", false)
    .option(
      "--starred",
      "add * (starred) signal to mark as important/valuable",
      false
    )
    .option("--clear-signals", "remove all signals", false)
    .option(
      "--content <text>",
      "replace waymark content (use '-' to read from stdin)"
    )
    .option("--write, -w", "apply modifications (default: preview)", false)
    .option(
      "--no-interactive",
      "skip interactive prompts when no target is provided"
    )
    .option("--json", "output as JSON")
    .option("--jsonl", "output as JSON Lines")
    .description("edit existing waymarks");

  editCommand
    .addHelpText(
      "after",
      `
Examples:
  $ wm edit src/auth.ts:42 --type fix                    # Preview type change
  $ wm edit src/auth.ts:42 --flagged --starred           # Preview adding flagged + starred
  $ wm edit --id [[a3k9m2p]] --starred --write          # Apply starred flag by ID
  $ wm edit src/auth.ts:42 --clear-signals --write       # Remove all signals
  $ wm edit src/auth.ts:42 --content "new text" --write
  $ printf "new text" | wm edit src/auth.ts:42 --content - --write
  $ wm edit                                           # Interactive workflow (default when no args)
  $ wm edit --no-interactive                          # Skip prompts if default interactive would trigger

Notes:
  - Provide either FILE:LINE or --id (not both)
  - Preview is default; add --write to apply
  - --content '-' reads replacement text from stdin (like wm add)
  - Running without arguments launches interactive mode automatically
  - Use --no-interactive to print the preview without prompts
      `
    )
    .action(async function (
      this: Command,
      target: string | undefined,
      options: ModifyCliOptions
    ) {
      try {
        const mergedOptions =
          typeof this.optsWithGlobals === "function"
            ? this.optsWithGlobals()
            : { ...program.opts(), ...options };
        await handleModifyCommand(program, this, target, mergedOptions);
      } catch (error) {
        handleCommandError(program, error);
      }
    });

  program.addCommand(editCommand);

  const removeCommand = new Command("rm")
    .argument("[targets...]", "waymark locations (file:line)")
    .option("--id <id>", "remove waymark by ID ([[hash]])", collectOption, [])
    .option(
      "--from <file>",
      "read removal targets from JSON file (use - for stdin)"
    )
    .option("--reason <text>", "record a removal reason in history")
    .option("--type <marker>", "filter by waymark type")
    .option("--tag <tag>", "filter by tag (repeatable)", collectOption, [])
    .option(
      "--mention <actor>",
      "filter by mention (repeatable)",
      collectOption,
      []
    )
    .option(
      "--property <kv>",
      "filter by property (repeatable)",
      collectValidatedOption(validatePropertyOption),
      []
    )
    .option(
      "--file <path>",
      "filter by file path (repeatable)",
      collectOption,
      []
    )
    .option("--content-pattern <regex>", "filter by content regex")
    .option("--contains <text>", "filter by content substring")
    .option("--flagged, -F", "filter by flagged signal (~)")
    .option("--starred, -S", "filter by starred signal (*)")
    .option("--write, -w", "actually remove (default is preview)", false)
    .option("--json", "output as JSON")
    .option("--jsonl", "output as JSON Lines")
    .description("remove waymarks from files")
    .addHelpText(
      "after",
      `
Removal Methods:
  1. By Location:     wm rm src/auth.ts:42
  2. By ID:           wm rm --id [[a3k9m2p]]
  3. By Filter:       wm rm --type todo --mention @agent --file src/
  4. From JSON Input: wm rm --from waymarks.json

Examples:
  $ wm rm src/auth.ts:42                      # Preview removal
  $ wm rm src/auth.ts:42 --write              # Actually remove
  $ wm rm --id [[a3k9m2p]] --write            # Remove by ID
  $ wm rm --type todo --mention @agent --file src/ --write
  $ wm rm --from removals.json --write
  $ wm rm src/auth.ts:42 --write --reason "cleanup"

Filter Flags:
  --type <marker>       Match waymark type (todo, fix, note, etc.)
  --mention <actor>     Match mention (@agent, @alice)
  --tag <hashtag>       Match tag (#perf, #sec)
  --property <kv>       Match property key:value
  --file <path>         Limit to matching file paths
  --contains <text>     Match content containing text
  --content-pattern <r> Match content using regex pattern
  --flagged             Match flagged waymarks
  --starred             Match starred waymarks (important/valuable)

Safety Features:
  - Default mode is preview (shows what would be removed)
  - --write flag required for actual removal
  - Multi-line waymarks removed atomically
  - Removed waymarks tracked in .waymark/history.json (with optional --reason)

See 'wm skill show rm' for agent-facing documentation.
    `
    )
    .action(async function (this: Command, ..._actionArgs: unknown[]) {
      try {
        await handleRemoveCommand(program, this);
      } catch (error) {
        handleCommandError(program, error);
      }
    });

  program.addCommand(removeCommand);

  const updateCommand = new Command("update")
    .description("check for and install CLI updates (npm global installs)")
    .option("--dry-run, -n", "print the npm command without executing it")
    .option("--force, -f", "run even if the install method cannot be detected")
    .option("--yes, -y", "skip the confirmation prompt")
    .option(
      "--command <command>",
      "override the underlying update command (defaults to npm)"
    )
    .action(async (options) => {
      try {
        await handleUpdateAction(options);
      } catch (error) {
        handleCommandError(program, error);
      }
    });

  program.addCommand(updateCommand);

  // Lint command
  const lintCommand = new Command("lint")
    .argument("[paths...]", "files or directories to lint")
    .option("--json", "output JSON", false)
    .description("validate waymark structure and enforce quality rules")
    .addHelpText(
      "after",
      `
Examples:
  $ wm lint src/auth.ts              # Lint single file
  $ wm lint src/**/*.ts              # Lint multiple files
  $ wm lint src/                     # Lint directory
  $ wm lint src/ --json              # JSON output for CI
  $ git diff --name-only --cached | xargs wm lint    # Pre-commit hook

Lint Rules:
  duplicate-property   Duplicate property key (warn)
  unknown-marker       Unknown marker (warn)
  multiple-tldr        Multiple tldr in file (error)
  codetag-pattern      Codetag pattern (warn)

Exit Codes:
  0   No errors (warnings allowed)
  1   Lint errors found
  2   Internal/tooling error

Example Output:
  src/auth.ts:12:1 - error multiple-tldr: File already has tldr at line 1
  src/auth.ts:34:1 - warn duplicate-property: Duplicate property key 'owner'
  ✖ 2 errors, 1 warning

See 'wm skill show lint' for agent-facing documentation.
    `
    )
    .action(async (paths: string[], options: { json?: boolean }) => {
      try {
        await handleLintCommand(program, paths, options);
      } catch (error) {
        handleCommandError(program, error);
      }
    });

  program.addCommand(lintCommand, { hidden: true });

  // Init command
  const initCommand = new Command("init")
    .option("--format <format>, -f", "config format (yaml|yml)", "yaml")
    .option("--preset <preset>, -p", "config preset (full|minimal)", "full")
    .option("--scope <scope>, -s", "config scope (project|user)", "project")
    .option("--force", "overwrite existing config", false)
    .description("initialize waymark configuration")
    .action(async (options) => {
      try {
        await handleInitCommand(options);
      } catch (error) {
        handleCommandError(program, error);
      }
    });

  program.addCommand(initCommand);

  const configCommand = new Command("config")
    .option("--print", "print merged configuration", false)
    .option("--json", "output compact JSON", false)
    .description("print resolved configuration")
    .addHelpText(
      "after",
      `
Examples:
  $ wm config --print                 # Show merged configuration
  $ wm --scope user config --print    # Show user-level configuration
  $ wm --config ./custom.yaml config --print
  $ wm config --print --json          # Output compact JSON
      `
    )
    .action(async (options: ConfigCommandOptions) => {
      try {
        await handleConfigCommand(program, options);
      } catch (error) {
        handleCommandError(program, error);
      }
    });

  program.addCommand(configCommand);

  const skillCommand = new Command("skill")
    .description("show agent-facing skill documentation")
    .option("--json", "output structured JSON")
    .action(async (options: SkillCommandOptions) => {
      try {
        await handleSkillCommand(options);
      } catch (error) {
        handleCommandError(program, error);
      }
    });

  const skillShowCommand = new Command("show")
    .argument("<section>", "command, reference, or example to display")
    .option("--json", "output structured JSON")
    .description("show a specific skill section")
    .action(async (section: string, options: SkillCommandOptions) => {
      try {
        await handleSkillShowCommand(section, options);
      } catch (error) {
        handleCommandError(program, error);
      }
    });

  const skillListCommand = new Command("list")
    .description("list available skill sections")
    .action(async () => {
      try {
        await handleSkillListCommand();
      } catch (error) {
        handleCommandError(program, error);
      }
    });

  const skillPathCommand = new Command("path")
    .description("print the skill directory path")
    .action(() => {
      try {
        handleSkillPathCommand();
      } catch (error) {
        handleCommandError(program, error);
      }
    });

  skillCommand.addCommand(skillShowCommand);
  skillCommand.addCommand(skillListCommand);
  skillCommand.addCommand(skillPathCommand);
  program.addCommand(skillCommand);

  // Doctor command - health checks and diagnostics (WAY-47)
  const doctorCommand = new Command("doctor")
    .argument("[paths...]", "files or directories to check")
    .option("--strict", "fail on warnings (CI mode)", false)
    .option("--fix", "attempt automatic repairs", false)
    .option("--json", "output as JSON")
    .description("run health checks and diagnostics")
    .addHelpText(
      "after",
      `
Examples:
  $ wm doctor                      # Check current directory
  $ wm doctor src/                 # Check specific directory
  $ wm doctor --strict             # CI mode (fail on warnings)
  $ wm doctor --fix                # Auto-repair safe issues
  $ wm doctor --json               # JSON output for tooling

Health Checks:
  Configuration:
    - Config file exists and is valid
    - Config values are within valid ranges
    - Cache directory is writable
    - Index files are valid JSON

  Waymark Integrity:
    - All waymarks parse correctly
    - No duplicate canonical references
    - No dangling relations (depends:, needs:, etc.)
    - TLDRs are in correct positions
    - Raised/starred signals on protected branches

  Environment:
    - Git repository detected
    - Ignore patterns working correctly
    - Index size is reasonable

  Performance:
    - Cache functioning correctly
    - Index size warnings

Auto-Fix Support (--fix):
  - Rebuild corrupted cache/index files
  - Remove duplicate canonicals (keeps first)
  - Fix TLDR positioning issues
  - Run formatter on waymarks with syntax issues
  - Clear flagged signals on protected branches (with confirmation)

Exit Codes:
  0  No errors (warnings only if not --strict)
  1  Errors found or warnings in --strict mode
  2  Internal/tooling error

See 'wm skill show doctor' for agent-facing documentation.
    `
    )
    .action(async (paths: string[], options: DoctorCommandOptions) => {
      try {
        await handleDoctorCommand(program, { ...options, paths });
      } catch (error) {
        handleCommandError(program, error);
      }
    });

  program.addCommand(doctorCommand);

  // Find command - explicit scan and filter (WAY-31)
  const findCommand = new Command("find")
    .argument("[paths...]", "files or directories to scan")
    .option("--type <types...>, -t", "filter by waymark type(s)")
    .option("--tag <tags...>", "filter by tag(s)")
    .option("--mention <mentions...>", "filter by mention(s)")
    .option("--flagged, -F", "filter for flagged (~) waymarks")
    .option("--starred, -S", "filter for starred (*) waymarks")
    .option("--tldr", "shorthand for --type tldr")
    .option("--graph", "show dependency graph")
    .option("--long", "show detailed record information")
    .option("--tree", "group output by directory structure")
    .option("--flat", "show flat list (default)")
    .option("--compact", "compact output format")
    .option("--no-wrap", "disable line wrapping")
    .option("--group <by>", "group by: file, dir, type")
    .option("--sort <by>", "sort by: file, line, type, modified")
    .option("--context <n>, -C", "show N lines of context", Number.parseInt)
    .option(
      "--after <n>, -A, --after-context <n>",
      "show N lines after match",
      Number.parseInt
    )
    .option(
      "--before <n>, -B, --before-context <n>",
      "show N lines before match",
      Number.parseInt
    )
    .option("--limit <n>, -n", "limit number of results", Number.parseInt)
    .option("--page <n>", "page number (with --limit)", Number.parseInt)
    .option("--interactive", "interactively select a waymark")
    .option("--pretty", "output as pretty-printed JSON")
    .description("scan and filter waymarks in files or directories")
    .addHelpText(
      "after",
      `
Examples:
  $ wm find                                   # Scan current directory
  $ wm find src/ --type todo --mention @agent
  $ wm find --graph --json                   # Export dependency graph as JSON
  $ wm find --starred --tag "#sec"           # Find high-priority security issues
  $ wm find src/ --type todo --type fix --flagged --mention @agent
  $ wm find --interactive                    # Interactively select a waymark

Filter Options:
  -t, --type <types...>       Filter by waymark type(s)
  --tag <tags...>             Filter by tag(s)
  --mention <mentions...>     Filter by mention(s)
  -F, --flagged               Filter for flagged (~) waymarks
  -S, --starred               Filter for starred (*) waymarks
  --tldr                      Shorthand for --type tldr

  Multiple filters of the same type use OR logic:
    --type todo --type fix    → Shows todos OR fixes

  Different filter types use AND logic:
    --type todo --tag "#perf" → Shows todos AND tagged with #perf

Mode Options:
  --graph                     Dependency graph (canonicals and relations)
  --interactive               Interactively select a waymark

Display Options:
  --long                      Show detailed record information
  --tree                      Group output by directory structure
  --flat                      Show flat list (default)
  --compact                   Compact output format
  --no-color                  (global) Disable colored output

Grouping & Sorting:
  --group <by>                Group by: file, dir, type
  --sort <by>                 Sort by: file, line, type, modified

Context Display:
  -C, --context <n>           Show N lines of context around matches
  -A, --after <n>, --after-context <n>
                             Show N lines after each match
  -B, --before <n>, --before-context <n>
                             Show N lines before each match

Pagination:
  -n, --limit <n>             Limit number of results
  --page <n>                  Page number (with --limit)

  Output Formats:
  --json                      (global) Compact JSON array
  --jsonl                     (global) Newline-delimited JSON (one record per line)
  --text                      (global) Human-readable formatted text (default)
  --pretty                    Pretty-printed JSON

See 'wm skill show find' for agent-facing documentation.
    `
    )
    .action(async function (
      this: Command,
      paths: string[],
      options: Record<string, unknown>
    ) {
      try {
        const mergedOptions =
          typeof this.optsWithGlobals === "function"
            ? this.optsWithGlobals()
            : { ...program.opts(), ...options };
        await handleUnifiedCommand(program, paths, mergedOptions);
      } catch (error) {
        handleCommandError(program, error);
      }
    });

  program.addCommand(findCommand);

  // Default action - unified command
  program
    .argument("[paths...]", "files or directories to scan")
    .addHelpText(
      "after",
      `
Examples:
  $ wm                                      # Scan current directory
  $ wm find src/ --type todo --mention @agent
  $ wm find --graph --json                  # Export dependency graph as JSON
  $ wm find --starred --tag "#sec"          # Find high-priority security issues

See 'wm find --help' for all available options and comprehensive documentation.
    `
    )
    .action(async (paths: string[], options: Record<string, unknown>) => {
      try {
        const mergedOptions = { ...program.opts(), ...options };
        await handleUnifiedCommand(program, paths, mergedOptions);
      } catch (error) {
        handleCommandError(program, error);
      }
    });
}

function collectOption(value: string, previous: string[] = []): string[] {
  return [...previous, value];
}

function collectValidatedOption(
  parser: (value: string) => string
): (value: string, previous?: string[]) => string[] {
  return (value: string, previous: string[] = []) => [
    ...previous,
    parser(value),
  ];
}

function parsePositionOption(value: string): string {
  if (value !== "before" && value !== "after") {
    throw new InvalidArgumentError(POSITION_ERROR);
  }
  return value;
}

function parseOrderOption(value: string): number {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) {
    throw new InvalidArgumentError(ORDER_ERROR);
  }
  return parsed;
}

function validatePropertyOption(value: string): string {
  try {
    parsePropertyEntry(value);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new InvalidArgumentError(message);
  }
  return value;
}
