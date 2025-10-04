#!/usr/bin/env bun

// tldr ::: waymark CLI entry point using commander for command routing and parsing

import { existsSync } from "node:fs";
import { Command } from "commander";
import simpleUpdateNotifier from "simple-update-notifier";

import { formatFile } from "./commands/fmt.ts";
import { getHelp } from "./commands/help/index.ts";
import { runInitCommand } from "./commands/init.ts";
import { parseInsertArgs, runInsertCommand } from "./commands/insert.ts";
import { lintFiles as runLint } from "./commands/lint.ts";
import { migrateFile } from "./commands/migrate.ts";
import {
  maybeConfirmRemoval,
  type ParsedRemoveArgs,
  parseRemoveArgs,
  runRemoveCommand,
} from "./commands/remove.ts";
import { runUnifiedCommand } from "./commands/unified/index.ts";
import { parseUnifiedArgs } from "./commands/unified/parser.ts";
import {
  runUpdateCommand,
  type UpdateCommandOptions,
} from "./commands/update.ts";
import type { CommandContext } from "./types.ts";
import { loadPrompt } from "./utils/content-loader.ts";
import { createContext } from "./utils/context.ts";
import { logger } from "./utils/logger.ts";
import { normalizeScope } from "./utils/options.ts";
import { confirmWrite, selectWaymark } from "./utils/prompts.ts";

// Re-export utilities used by tests
// biome-ignore lint/performance/noBarrelFile: explicit test exports
export { formatMapOutput, serializeMap } from "./utils/map-rendering.ts";

const STDOUT = process.stdout;
const STDERR = process.stderr;

function writeStdout(message: string): void {
  STDOUT.write(`${message}\n`);
}

function writeStderr(message: string): void {
  STDERR.write(`${message}\n`);
}

function ensureFileExists(path: string): void {
  if (!existsSync(path)) {
    throw new Error(`File not found: ${path}`);
  }
}

// Command handlers extracted for complexity management
async function handleFormatCommand(
  program: Command,
  filePath: string,
  options: { write?: boolean; prompt?: boolean }
): Promise<void> {
  if (options.prompt) {
    const promptText = loadPrompt("format");
    if (promptText) {
      writeStdout(promptText);
      return;
    }
    writeStderr("No agent prompt available for this command");
    process.exit(1);
  }

  const scopeValue = program.opts().scope as string;
  const globalOpts = { scope: normalizeScope(scopeValue) };
  const context = await createContext(globalOpts);

  ensureFileExists(filePath);

  // First, format without writing to see what changes would be made
  const { formattedText, edits } = await formatFile(
    { filePath, write: false },
    context
  );

  if (edits.length === 0) {
    writeStdout(`${filePath}: no changes`);
    return;
  }

  // If --write flag is set, confirm before writing
  if (options.write) {
    const shouldWrite = await confirmWrite({
      filePath,
      changeCount: edits.length,
      actionVerb: "format",
    });

    if (shouldWrite) {
      // Actually write the changes
      await formatFile({ filePath, write: true }, context);
      writeStdout(`${filePath}: formatted (${edits.length} edits)`);
    } else {
      writeStdout("Write cancelled");
      process.exit(1);
    }
  } else {
    writeStdout(formattedText);
  }
}

async function handleLintCommand(
  program: Command,
  filePaths: string[],
  options: { json?: boolean; prompt?: boolean }
): Promise<void> {
  if (options.prompt) {
    const promptText = loadPrompt("lint");
    if (promptText) {
      writeStdout(promptText);
      return;
    }
    writeStderr("No agent prompt available for this command");
    process.exit(1);
  }

  const scopeValue = program.opts().scope as string;
  const globalOpts = { scope: normalizeScope(scopeValue) };
  const context = await createContext(globalOpts);

  const report = await runLint(
    filePaths,
    context.config.allowTypes,
    context.config
  );

  if (options.json) {
    writeStdout(JSON.stringify(report));
  } else {
    for (const issue of report.issues) {
      writeStderr(`${issue.file}:${issue.line} invalid type "${issue.type}"`);
    }
    if (report.issues.length === 0) {
      writeStdout("lint: no issues found");
    }
  }

  if (report.issues.length > 0) {
    process.exit(1);
  }
}

async function handleMigrateCommand(
  program: Command,
  filePath: string,
  options: { write?: boolean; prompt?: boolean }
): Promise<void> {
  if (options.prompt) {
    const promptText = loadPrompt("migrate");
    if (promptText) {
      writeStdout(promptText);
      return;
    }
    writeStderr("No agent prompt available for this command");
    process.exit(1);
  }

  const scopeValue = program.opts().scope as string;
  const globalOpts = { scope: normalizeScope(scopeValue) };
  const context = await createContext(globalOpts);

  ensureFileExists(filePath);

  // First, migrate without writing to see what changes would be made
  const result = await migrateFile({ filePath, write: false }, context);

  if (!result.changed) {
    writeStdout(`${filePath}: no changes`);
    return;
  }

  // If --write flag is set, confirm before writing
  if (options.write) {
    const shouldWrite = await confirmWrite({
      filePath,
      actionVerb: "migrate",
    });

    if (shouldWrite) {
      // Actually write the changes
      await migrateFile({ filePath, write: true }, context);
      writeStdout(`${filePath}: migrated`);
    } else {
      writeStdout("Write cancelled");
      process.exit(1);
    }
  } else {
    writeStdout(result.output);
  }
}

async function handleInsertCommand(
  program: Command,
  command: Command,
  options: { prompt?: boolean }
): Promise<void> {
  if (options.prompt) {
    const promptText = loadPrompt("insert");
    if (promptText) {
      writeStdout(promptText);
      return;
    }
    writeStderr("No agent prompt available for this command");
    process.exit(1);
  }

  const argvTokens = process.argv.slice(2);
  const commandNames = new Set([command.name(), ...command.aliases()]);
  const commandIndex = argvTokens.findIndex((token) => commandNames.has(token));
  const tokens = commandIndex >= 0 ? argvTokens.slice(commandIndex + 1) : [];
  const filteredTokens = tokens.filter((token) => token !== "--prompt");

  const scopeValue = program.opts().scope as string;
  const globalOpts = { scope: normalizeScope(scopeValue) };
  const context = await createContext(globalOpts);

  try {
    const parsed = parseInsertArgs(filteredTokens);
    const result = await runInsertCommand(parsed, context);

    if (result.output.length > 0) {
      writeStdout(result.output);
    }

    if (result.exitCode !== 0) {
      process.exit(result.exitCode);
    }
  } catch (error) {
    writeStderr(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

async function handleRemoveCommand(
  program: Command,
  command: Command,
  options: { prompt?: boolean }
): Promise<void> {
  if (handlePromptOption("remove", options)) {
    return;
  }

  const filteredTokens = extractCommandTokens(program, command);
  const scopeValue = program.opts().scope as string;
  const context = await createContext({ scope: normalizeScope(scopeValue) });

  const parsedArgs = parseRemoveArgsOrExit(filteredTokens);
  const preview = await runRemoveCommand(parsedArgs, context, {
    writeOverride: false,
  });

  if (parsedArgs.options.write) {
    await executeRemovalWriteFlow(preview, parsedArgs, context);
    return;
  }

  outputRemovalPreview(preview);
}

function handlePromptOption(
  key: "insert" | "remove",
  options: { prompt?: boolean }
): boolean {
  if (!options.prompt) {
    return false;
  }
  const promptText = loadPrompt(key);
  if (promptText) {
    writeStdout(promptText);
    return true;
  }
  writeStderr("No agent prompt available for this command");
  process.exit(1);
}

function extractCommandTokens(_program: Command, command: Command): string[] {
  const argvTokens = process.argv.slice(2);
  const names = new Set([command.name(), ...command.aliases()]);
  const commandIndex = argvTokens.findIndex((token) => names.has(token));
  if (commandIndex === -1) {
    return [];
  }
  return argvTokens
    .slice(commandIndex + 1)
    .filter((token) => token !== "--prompt");
}

function parseRemoveArgsOrExit(tokens: string[]): ParsedRemoveArgs {
  try {
    return parseRemoveArgs(tokens);
  } catch (error) {
    writeStderr(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

async function executeRemovalWriteFlow(
  preview: Awaited<ReturnType<typeof runRemoveCommand>>,
  parsedArgs: ParsedRemoveArgs,
  context: CommandContext
): Promise<void> {
  if (preview.exitCode !== 0) {
    if (preview.output.length > 0) {
      writeStdout(preview.output);
    }
    process.exit(preview.exitCode);
  }

  const structuredOutput = preview.options.json || preview.options.jsonl;
  if (!structuredOutput && preview.output.length > 0) {
    writeStdout(preview.output);
  }

  const confirmed = structuredOutput
    ? true
    : await maybeConfirmRemoval(preview.summary, {
        yes: preview.options.yes,
        confirm: preview.options.confirm,
      });

  if (!confirmed) {
    writeStdout("Removal cancelled");
    process.exit(1);
  }

  const actual = await runRemoveCommand(parsedArgs, context, {
    writeOverride: true,
  });

  if (actual.output.length > 0) {
    writeStdout(actual.output);
  }

  if (actual.exitCode !== 0) {
    process.exit(actual.exitCode);
  }
}

function outputRemovalPreview(
  preview: Awaited<ReturnType<typeof runRemoveCommand>>
): void {
  if (preview.output.length > 0) {
    writeStdout(preview.output);
  }

  if (preview.exitCode !== 0) {
    process.exit(preview.exitCode);
  }
}

async function handleUpdateAction(
  options: {
    dryRun?: boolean;
    force?: boolean;
    yes?: boolean;
    command?: string;
  } = {}
): Promise<void> {
  const updateOptions: UpdateCommandOptions = {};
  if (typeof options.dryRun === "boolean") {
    updateOptions.dryRun = options.dryRun;
  }
  if (typeof options.force === "boolean") {
    updateOptions.force = options.force;
  }
  if (typeof options.yes === "boolean") {
    updateOptions.yes = options.yes;
  }
  if (typeof options.command === "string" && options.command.length > 0) {
    updateOptions.command = options.command;
  }

  const result = await runUpdateCommand(updateOptions);

  if (result.message) {
    if (result.exitCode === 0) {
      writeStdout(result.message);
    } else {
      writeStderr(result.message);
    }
  }

  if (!result.skipped && result.exitCode === 0) {
    writeStdout("wm update completed.");
  }

  if (result.exitCode !== 0) {
    process.exit(result.exitCode);
  }
}

const MULTI_VALUE_OPTION_FLAGS = [
  { key: "type", flag: "--type" },
  { key: "tag", flag: "--tag" },
  { key: "mention", flag: "--mention" },
] as const;

const BOOLEAN_OPTION_FLAGS = [
  { key: "raised", flag: "--raised" },
  { key: "starred", flag: "--starred" },
  { key: "map", flag: "--map" },
  { key: "graph", flag: "--graph" },
  { key: "summary", flag: "--summary" },
  { key: "json", flag: "--json" },
  { key: "jsonl", flag: "--jsonl" },
  { key: "pretty", flag: "--pretty" },
  { key: "long", flag: "--long" },
  { key: "tree", flag: "--tree" },
  { key: "flat", flag: "--flat" },
  { key: "keepCommentMarkers", flag: "--keep-comment-markers" },
  { key: "compact", flag: "--compact" },
  { key: "noColor", flag: "--no-color" },
] as const;

const STRING_OPTION_FLAGS = [
  { key: "group", flag: "--group" },
  { key: "sort", flag: "--sort" },
] as const;

const NUMERIC_OPTION_FLAGS = [
  { key: "context", flag: "--context" },
  { key: "after", flag: "--after" },
  { key: "before", flag: "--before" },
  { key: "limit", flag: "--limit" },
  { key: "page", flag: "--page" },
] as const;

function collectOptionValues(value: unknown): string[] {
  if (value === undefined || value === null) {
    return [];
  }
  if (Array.isArray(value)) {
    return value
      .filter((item) => item !== undefined && item !== null)
      .map((item) => String(item));
  }
  return [String(value)];
}

function buildArgsFromOptions(
  paths: string[],
  options: Record<string, unknown>
): string[] {
  const args: string[] = [...paths];

  for (const { key, flag } of MULTI_VALUE_OPTION_FLAGS) {
    const values = collectOptionValues(options[key]);
    for (const value of values) {
      args.push(flag, value);
    }
  }

  for (const { key, flag } of BOOLEAN_OPTION_FLAGS) {
    if (options[key]) {
      args.push(flag);
    }
  }

  for (const { key, flag } of STRING_OPTION_FLAGS) {
    const value = options[key];
    if (typeof value === "string" && value.length > 0) {
      args.push(flag, value);
    }
  }

  for (const { key, flag } of NUMERIC_OPTION_FLAGS) {
    const value = options[key];
    if (value !== undefined && value !== null) {
      args.push(flag, String(value));
    }
  }

  return args;
}

function displaySelectedWaymark(
  selected: import("@waymarks/grammar").WaymarkRecord
): void {
  writeStdout("\nSelected waymark:\n");
  writeStdout(`${selected.file}:${selected.startLine}`);
  writeStdout(
    `${selected.signals.raised ? "^" : ""}${selected.signals.important ? "*" : ""}${selected.type} ::: ${selected.contentText}`
  );

  if (Object.keys(selected.properties).length > 0) {
    writeStdout("\nProperties:");
    for (const [key, value] of Object.entries(selected.properties)) {
      writeStdout(`  ${key}: ${value}`);
    }
  }

  if (selected.relations.length > 0) {
    writeStdout("\nRelations:");
    for (const rel of selected.relations) {
      writeStdout(`  ${rel.kind}: ${rel.token}`);
    }
  }

  if (selected.mentions.length > 0) {
    writeStdout(`\nMentions: ${selected.mentions.join(", ")}`);
  }

  if (selected.tags.length > 0) {
    writeStdout(`\nTags: ${selected.tags.join(", ")}`);
  }

  writeStdout(`\nRaw:\n${selected.raw}`);
}

async function handleUnifiedCommand(
  program: Command,
  paths: string[],
  options: Record<string, unknown>
): Promise<void> {
  if (options.prompt) {
    const promptText = loadPrompt("unified");
    if (promptText) {
      writeStdout(promptText);
      return;
    }
    writeStderr("No agent prompt available");
    process.exit(1);
  }

  const scopeValue = program.opts().scope as string;
  const globalOpts = { scope: normalizeScope(scopeValue) };
  const context = await createContext(globalOpts);

  const args = buildArgsFromOptions(paths, options);
  const unifiedOptions = parseUnifiedArgs(args);
  const result = await runUnifiedCommand(unifiedOptions, context);

  // Handle interactive selection
  if (options.interactive && result.records && result.records.length > 0) {
    const selected = await selectWaymark({ records: result.records });
    if (selected) {
      displaySelectedWaymark(selected);
    }
  } else if (result.output.length > 0) {
    writeStdout(result.output);
  }
}

async function createProgram(): Promise<Command> {
  // Read version from package.json
  const packageJsonPath = new URL("../package.json", import.meta.url);
  const packageJson = await import(packageJsonPath.href);
  const version = packageJson.default.version as string;

  await simpleUpdateNotifier({
    pkg: packageJson.default,
    shouldNotifyInNpmScript: true,
  });

  const program = new Command();

  program
    .name("wm")
    .description("Waymark CLI - scan, filter, format, and manage waymarks")
    .version(version, "-v, --version", "output the current version")
    .option("--scope <scope>", "config scope (default|project|user)", "default")
    .option("--verbose", "enable verbose logging (info level)")
    .option("--debug", "enable debug logging")
    .option("-q, --quiet", "only show errors")
    .helpOption("-h, --help", "display help for command")
    .addHelpCommand(false) // Disable default help command, we'll add custom one
    .hook("preAction", (thisCommand) => {
      // Configure logger based on flags
      const opts = thisCommand.opts();
      if (opts.debug) {
        logger.level = "debug";
      } else if (opts.verbose) {
        logger.level = "info";
      } else if (opts.quiet) {
        logger.level = "error";
      }
    });

  // Custom help command that supports --prompt
  program
    .command("help")
    .argument("[command]", "command to get help for")
    .option("--prompt", "show agent-facing prompt instead of help")
    .description("display help for command")
    .action((commandName?: string, options?: { prompt?: boolean }) => {
      if (options?.prompt) {
        const promptText = loadPrompt(commandName || "unified");
        if (promptText) {
          writeStdout(promptText);
        } else {
          writeStderr("No agent prompt available for this command");
          process.exit(1);
        }
      } else {
        writeStdout(getHelp(commandName));
      }
    });

  // Format command
  program
    .command("format")
    .alias("fmt")
    .argument("<file>", "file to format")
    .option("-w, --write", "write changes to file", false)
    .option("--prompt", "show agent-facing prompt instead of help")
    .description("format waymarks in a file")
    .action(
      async (
        filePath: string,
        options: { write?: boolean; prompt?: boolean }
      ) => {
        try {
          await handleFormatCommand(program, filePath, options);
        } catch (error) {
          writeStderr(error instanceof Error ? error.message : String(error));
          process.exit(1);
        }
      }
    );

  program
    .command("insert")
    .allowUnknownOption(true)
    .allowExcessArguments(true)
    .option("--prompt", "show agent-facing prompt instead of help")
    .description("insert waymarks into files")
    .action(async function (this: Command, ...actionArgs: unknown[]) {
      const options = (actionArgs.at(-1) ?? {}) as { prompt?: boolean };
      await handleInsertCommand(program, this, options);
    });

  program
    .command("remove")
    .allowUnknownOption(true)
    .allowExcessArguments(true)
    .option("--prompt", "show agent-facing prompt instead of help")
    .description("remove waymarks from files")
    .action(async function (this: Command, ...actionArgs: unknown[]) {
      const options = (actionArgs.at(-1) ?? {}) as { prompt?: boolean };
      await handleRemoveCommand(program, this, options);
    });

  program
    .command("update")
    .description("check for and install CLI updates (npm global installs)")
    .option("--dry-run", "print the npm command without executing it")
    .option("--force", "run even if the install method cannot be detected")
    .option("--yes", "skip the confirmation prompt")
    .option(
      "--command <command>",
      "override the underlying update command (defaults to npm)"
    )
    .action(handleUpdateAction);

  // Lint command
  program
    .command("lint")
    .argument("<files...>", "files to lint")
    .option("--json", "output JSON", false)
    .option("--prompt", "show agent-facing prompt instead of help")
    .description("validate waymark structure and types")
    .action(
      async (
        filePaths: string[],
        options: { json?: boolean; prompt?: boolean }
      ) => {
        try {
          await handleLintCommand(program, filePaths, options);
        } catch (error) {
          writeStderr(error instanceof Error ? error.message : String(error));
          process.exit(1);
        }
      }
    );

  // Migrate command
  program
    .command("migrate")
    .argument("<file>", "file to migrate")
    .option("-w, --write", "write changes to file", false)
    .option("--prompt", "show agent-facing prompt instead of help")
    .description("migrate legacy comments to waymark format")
    .action(
      async (
        filePath: string,
        options: { write?: boolean; prompt?: boolean }
      ) => {
        try {
          await handleMigrateCommand(program, filePath, options);
        } catch (error) {
          writeStderr(error instanceof Error ? error.message : String(error));
          process.exit(1);
        }
      }
    );

  // Init command
  program
    .command("init")
    .option(
      "-f, --format <format>",
      "config format (toml|jsonc|yaml|yml)",
      "toml"
    )
    .option("-p, --preset <preset>", "config preset (full|minimal)", "full")
    .option("-s, --scope <scope>", "config scope (project|user)", "project")
    .option("--force", "overwrite existing config", false)
    .description("initialize waymark configuration")
    .action(
      async (options: {
        format?: string;
        preset?: string;
        scope?: string;
        force?: boolean;
      }) => {
        try {
          await runInitCommand(options);
        } catch (error) {
          writeStderr(error instanceof Error ? error.message : String(error));
          process.exit(1);
        }
      }
    );

  // Default action - unified command (handles everything else)
  program
    .argument("[paths...]", "files or directories to scan")
    .option("-t, --type <types...>", "filter by waymark type(s)")
    .option("--tag <tags...>", "filter by tag(s)")
    .option("--mention <mentions...>", "filter by mention(s)")
    .option("-r, --raised", "filter for raised (^) waymarks")
    .option("-s, --starred", "filter for starred (*) waymarks")
    .option("-i, --interactive", "enable interactive fuzzy selection")
    .option("--map", "show file tree with TLDRs")
    .option("--graph", "show dependency graph")
    .option("--summary", "show summary footer (map mode)")
    .option("--json", "output as JSON")
    .option("--jsonl", "output as JSON Lines")
    .option("--pretty", "output as pretty-printed JSON")
    .option("--long", "show detailed record information")
    .option("--tree", "group output by directory structure")
    .option("--flat", "show flat list (default)")
    .option("--keep-comment-markers", "keep comment syntax in output")
    .option("--compact", "compact output format")
    .option("--no-color", "disable colored output")
    .option("--group <by>", "group by: file, dir, type")
    .option("--sort <by>", "sort by: file, line, type, modified")
    .option("-C, --context <n>", "show N lines of context", Number.parseInt)
    .option("-A, --after <n>", "show N lines after match", Number.parseInt)
    .option("-B, --before <n>", "show N lines before match", Number.parseInt)
    .option("--limit <n>", "limit number of results", Number.parseInt)
    .option("--page <n>", "page number (with --limit)", Number.parseInt)
    .option("--prompt", "show agent-facing prompt instead of help")
    .action(async (paths: string[], options: Record<string, unknown>) => {
      try {
        await handleUnifiedCommand(program, paths, options);
      } catch (error) {
        writeStderr(error instanceof Error ? error.message : String(error));
        process.exit(1);
      }
    });

  return program;
}

if (import.meta.main) {
  createProgram()
    .then((program) => program.parseAsync(process.argv))
    .catch((error) => {
      writeStderr(error instanceof Error ? error.message : String(error));
      process.exit(1);
    });
}

// For testing
export async function runCli(argv: string[]): Promise<{ exitCode: number }> {
  try {
    const program = await createProgram();
    // Parse without executing (for testing)
    await program.parseAsync(["node", "wm", ...argv]);
    return { exitCode: 0 };
  } catch (_error) {
    return { exitCode: 1 };
  }
}
