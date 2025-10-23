#!/usr/bin/env bun

// tldr ::: waymark CLI entry point using commander for command routing and parsing

import { existsSync } from "node:fs";
import tab from "@bomb.sh/tab/commander";
import type { WaymarkConfig } from "@waymarks/core";
import { Command, Option } from "commander";
import simpleUpdateNotifier from "simple-update-notifier";
import { parseAddArgs, runAddCommand } from "./commands/add.ts";
import { formatFile } from "./commands/fmt.ts";
import { runInitCommand } from "./commands/init.ts";
import { lintFiles as runLint } from "./commands/lint.ts";
import { migrateFile } from "./commands/migrate.ts";
import { type ModifyOptions, runModifyCommand } from "./commands/modify.ts";
import {
  maybeConfirmRemoval,
  type ParsedRemoveArgs,
  parseRemoveArgs,
  runRemoveCommand,
} from "./commands/remove.ts";
import { scanRecords } from "./commands/scan.ts";
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
  paths: string[],
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

  // If no paths provided, default to current directory
  const pathsToFormat = paths.length > 0 ? paths : ["."];

  for (const filePath of pathsToFormat) {
    ensureFileExists(filePath);

    // First, format without writing to see what changes would be made
    const { formattedText, edits } = await formatFile(
      { filePath, write: false },
      context
    );

    if (edits.length === 0) {
      writeStdout(`${filePath}: no changes`);
      continue;
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
}

async function handleLintCommand(
  program: Command,
  paths: string[],
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

  // If no paths provided, default to current directory
  const pathsToLint = paths.length > 0 ? paths : ["."];

  const report = await runLint(
    pathsToLint,
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
  paths: string[],
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

  // If no paths provided, default to current directory
  const pathsToMigrate = paths.length > 0 ? paths : ["."];

  for (const filePath of pathsToMigrate) {
    ensureFileExists(filePath);

    // First, migrate without writing to see what changes would be made
    const result = await migrateFile({ filePath, write: false }, context);

    if (!result.changed) {
      writeStdout(`${filePath}: no changes`);
      continue;
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
}

async function handleAddCommand(
  program: Command,
  command: Command,
  options: { prompt?: boolean }
): Promise<void> {
  if (options.prompt) {
    const promptText = loadPrompt("add");
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
    const parsed = parseAddArgs(filteredTokens);
    const result = await runAddCommand(parsed, context);

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
  key: "insert" | "remove" | "modify",
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

type ModifyCliOptions = {
  id?: string;
  type?: string;
  content?: string;
  raise?: boolean;
  markStarred?: boolean;
  clearSignals?: boolean;
  write?: boolean;
  json?: boolean;
  jsonl?: boolean;
  interactive?: boolean;
  prompt?: boolean;
};

const ID_PATTERN_REGEX = /wm:[a-z0-9-]+/i;

async function resolveInteractiveTarget(
  workspaceRoot: string,
  config: WaymarkConfig
): Promise<{ target: string; id?: string | undefined }> {
  const records = await scanRecords([workspaceRoot], config);
  if (records.length === 0) {
    writeStderr("No waymarks found to modify.");
    process.exit(1);
  }

  const selected = await selectWaymark({ records });
  if (!selected) {
    writeStderr("No waymark selected.");
    process.exit(1);
  }

  const target = `${selected.file}:${selected.startLine}`;
  let id: string | undefined;

  if (selected.raw.includes("wm:")) {
    const idMatch = selected.raw.match(ID_PATTERN_REGEX);
    if (idMatch) {
      id = idMatch[0];
    }
  }

  return { target, id };
}

function buildModifyOptions(
  resolvedId: string | undefined,
  rawOptions: ModifyCliOptions,
  interactiveOverride: boolean | undefined
): ModifyOptions {
  const options: ModifyOptions = {};

  if (resolvedId) {
    options.id = resolvedId;
  }
  if (rawOptions.type) {
    options.type = rawOptions.type;
  }
  if (rawOptions.content) {
    options.content = rawOptions.content;
  }
  if (rawOptions.clearSignals) {
    options.noSignal = true;
  }
  if (rawOptions.write) {
    options.write = rawOptions.write;
  }
  if (rawOptions.json) {
    options.json = rawOptions.json;
  }
  if (rawOptions.jsonl) {
    options.jsonl = rawOptions.jsonl;
  }
  if (interactiveOverride !== undefined) {
    options.interactive = interactiveOverride;
  }
  if (rawOptions.raise) {
    options.raised = true;
  }
  if (rawOptions.markStarred) {
    options.starred = true;
  }

  return options;
}

function determineInteractiveOverride(
  command: Command,
  target: string | undefined,
  rawOptions: ModifyCliOptions
): boolean | undefined {
  const source =
    typeof command.getOptionValueSource === "function"
      ? command.getOptionValueSource("interactive")
      : undefined;
  const interactiveUnset = source === undefined || source === "default";

  if (!interactiveUnset) {
    return rawOptions.interactive ?? undefined;
  }

  const noTarget = typeof target !== "string" || target.length === 0;
  const noId = !rawOptions.id;
  const hasMutationFlag = Boolean(
    rawOptions.type ||
      rawOptions.content ||
      rawOptions.raise ||
      rawOptions.markStarred ||
      rawOptions.clearSignals
  );
  const hasOutputFlag = Boolean(rawOptions.json || rawOptions.jsonl);
  const hasWriteFlag = Boolean(rawOptions.write);

  if (noTarget && noId && !hasMutationFlag && !hasOutputFlag && !hasWriteFlag) {
    return true;
  }

  return;
}

async function handleModifyCommand(
  program: Command,
  command: Command,
  target: string | undefined,
  rawOptions: ModifyCliOptions
): Promise<void> {
  if (handlePromptOption("modify", rawOptions)) {
    return;
  }

  if (rawOptions.json && rawOptions.jsonl) {
    throw new Error("--json and --jsonl cannot be used together");
  }

  const scopeValue = program.opts().scope as string;
  const interactiveOverride = determineInteractiveOverride(
    command,
    target,
    rawOptions
  );

  const context = await createContext({ scope: normalizeScope(scopeValue) });

  let resolvedTarget = target;
  let resolvedId = rawOptions.id;

  if (interactiveOverride === true && !resolvedTarget && !resolvedId) {
    const { target: interactiveTarget, id: interactiveId } =
      await resolveInteractiveTarget(context.workspaceRoot, context.config);
    resolvedTarget = interactiveTarget;
    resolvedId = interactiveId;
  }

  const options = buildModifyOptions(
    resolvedId,
    rawOptions,
    interactiveOverride
  );

  const result = await runModifyCommand(context, resolvedTarget, options, {
    stdin: process.stdin,
  });

  if (result.output.length > 0) {
    writeStdout(result.output);
  }

  if (result.exitCode !== 0) {
    process.exit(result.exitCode);
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
  { key: "text", flag: "--text" },
  { key: "pretty", flag: "--pretty" }, // Pretty-printed JSON (deprecated)
  { key: "long", flag: "--long" },
  { key: "tree", flag: "--tree" },
  { key: "flat", flag: "--flat" },
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

const _DEFAULT_HELP_WIDTH = 80;

const COMMAND_ORDER = [
  "find",
  "add",
  "modify",
  "remove",
  "init",
  "migrate",
  "completions",
  "update",
  "help",
];

const HIDDEN_COMMANDS = ["format", "lint"];

/**
 * Sort comparator for commands based on predefined order.
 */
function compareCommandOrder(a: Command, b: Command): number {
  const aIndex = COMMAND_ORDER.indexOf(a.name());
  const bIndex = COMMAND_ORDER.indexOf(b.name());
  if (aIndex === -1 && bIndex === -1) {
    return 0;
  }
  if (aIndex === -1) {
    return 1;
  }
  if (bIndex === -1) {
    return -1;
  }
  return aIndex - bIndex;
}

/**
 * Filter and sort commands for help display.
 */
function getVisibleCommands(commands: readonly Command[]): Command[] {
  return commands
    .filter((c) => !HIDDEN_COMMANDS.includes(c.name()))
    .sort(compareCommandOrder);
}

/**
 * Format help text for commander with custom command ordering.
 */
function formatCustomHelp(
  cmd: Command,
  helper: ReturnType<Command["createHelp"]>,
  visibleCommands: Command[]
): string {
  const termWidth = helper.padWidth(cmd, helper);

  let output = helper.commandUsage(cmd);
  output += "\n";
  output += helper.commandDescription(cmd);

  // Add arguments section
  const argumentList = helper.visibleArguments(cmd);
  if (argumentList.length > 0) {
    output += "\n\nArguments:\n";
    for (const arg of argumentList) {
      output += `  ${helper.argumentTerm(arg).padEnd(termWidth)}  ${helper.argumentDescription(arg)}\n`;
    }
  }

  // Add options section
  const optionList = helper.visibleOptions(cmd);
  if (optionList.length > 0) {
    output += "\n\nOptions:\n";
    for (const opt of optionList) {
      output += `  ${helper.optionTerm(opt).padEnd(termWidth)}  ${helper.optionDescription(opt)}\n`;
    }
  }

  // Add commands section
  if (visibleCommands.length > 0) {
    output += "\n\nCommands:\n";
    for (const c of visibleCommands) {
      const name = c.name() + (c.alias() ? `|${c.alias()}` : "");
      output += `  ${name.padEnd(termWidth)}  ${c.description()}\n`;
    }
  }

  return `${output}\n`;
}

/**
 * Build custom help formatter for commander.
 * Filters out soft-deprecated commands and reorders visible commands.
 */
function buildCustomHelpFormatter() {
  return (cmd: Command, helper: ReturnType<Command["createHelp"]>) => {
    const visibleCommands = getVisibleCommands(cmd.commands);
    return formatCustomHelp(cmd, helper, visibleCommands);
  };
}

export async function createProgram(): Promise<Command> {
  // Read version from package.json
  const packageJsonPath = new URL("../package.json", import.meta.url);
  const packageJson = await import(packageJsonPath.href);
  const version = packageJson.default.version as string;

  await simpleUpdateNotifier({
    pkg: packageJson.default,
    shouldNotifyInNpmScript: true,
  });

  const program = new Command();

  const jsonOption = new Option("--json", "Output as JSON array");
  const jsonlOption = new Option(
    "--jsonl",
    "Output as JSON Lines (newline-delimited)"
  );
  const textOption = new Option(
    "--text",
    "Output as human-readable formatted text"
  );
  jsonOption.conflicts("jsonl");
  jsonOption.conflicts("text");
  jsonlOption.conflicts("json");
  jsonlOption.conflicts("text");
  textOption.conflicts("json");
  textOption.conflicts("jsonl");

  program
    .name("wm")
    .description(
      "Waymark CLI - scan, filter, format, and manage waymarks\n\n" +
        "Quick Start:\n" +
        "  wm find [paths...]        Scan and filter waymarks (default: current directory)\n" +
        "  wm find --map             Show file tree with TLDR summaries\n" +
        "  wm find --graph           Show dependency graph\n" +
        "  wm format <file> --write  Format waymarks in file\n" +
        "  wm init                   Initialize waymark configuration"
    )
    .version(version, "--version, -v", "output the current version")
    .helpOption("--help, -h", "display help for command")
    .addHelpCommand(false) // Disable default help command, we'll add custom one
    .configureHelp({
      formatHelp: buildCustomHelpFormatter(),
    })
    .option(
      "--scope <scope>, -s",
      "config scope (default|project|user)",
      "default"
    )
    .option("--prompt", "show agent-facing documentation")
    .option("--verbose", "enable verbose logging (info level)")
    .option("--debug", "enable debug logging")
    .option("--quiet, -q", "only show errors")
    .option("--json", "output as JSON")
    .option("--jsonl", "output as JSON Lines")
    .option("--text", "output as human-readable formatted text")
    .option("--no-color", "disable colored output")
    .addHelpText(
      "afterAll",
      "\nNote: Use --prompt flag with any command to see agent-facing documentation"
    )
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
      } else if (commandName) {
        // Use Commander's built-in help for specific command
        const cmd = program.commands.find((c) => c.name() === commandName);
        if (cmd) {
          cmd.help();
        } else {
          writeStderr(`Unknown command: ${commandName}`);
          program.help();
        }
      } else {
        // Show general help
        program.help();
      }
    });

  // Format command
  program
    .command("format")
    .argument("[paths...]", "files or directories to format")
    .option("--write, -w", "write changes to file", false)
    .option("--prompt", "show agent-facing prompt instead of help")
    .description("format and normalize waymark syntax in files")
    .addHelpText(
      "after",
      `
Examples:
  $ wm format src/auth.ts              # Preview formatting single file
  $ wm format src/auth.ts --write      # Apply formatting to single file
  $ wm format src/**/*.ts --write      # Format multiple files
  $ wm format src/ --write             # Format all files in directory

Formatting Rules:
  - Exactly one space before and after ::: sigil
  - Marker case normalized (default: lowercase)
  - Multi-line continuations aligned to parent :::
  - Property ordering: relations after free text
  - Signal order: ^ before * when combined

Before Formatting:
  //todo:::implement auth
  // *  fix  ::: validate input

After Formatting:
  // todo ::: implement auth
  // *fix ::: validate input

See 'wm format --prompt' for agent-facing documentation.
    `
    )
    .action(
      async (
        paths: string[],
        options: { write?: boolean; prompt?: boolean }
      ) => {
        try {
          await handleFormatCommand(program, paths, options);
        } catch (error) {
          writeStderr(error instanceof Error ? error.message : String(error));
          process.exit(1);
        }
      }
    );

  program
    .command("add")
    .allowUnknownOption(true)
    .allowExcessArguments(true)
    .option(
      "--from <file>",
      "read waymark(s) from JSON/JSONL file (use - for stdin)"
    )
    .option(
      "--mention <actor>",
      "add mention (@agent, @alice) - can be repeated"
    )
    .option("--tag <tag>", "add hashtag (#perf, #sec) - can be repeated")
    .option("--property <kv>", "add property (owner:@alice) - can be repeated")
    .option("--ref <token>", "set canonical reference (ref:#auth/core)")
    .option("--depends <token>", "add dependency relation")
    .option("--needs <token>", "add needs relation")
    .option("--blocks <token>", "add blocks relation")
    .option("--signal <signal>", "add signal: ^ (raised) or * (starred)")
    .option("--write, -w", "apply changes to file (default: preview)", false)
    .option("--json", "output as JSON")
    .option("--jsonl", "output as JSON Lines")
    .option("--prompt", "show agent-facing prompt instead of help")
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
  $ wm add src/api.ts:100 fix "validate input" --signal *
  $ wm add src/pay.ts:200 todo "add retry" --depends "#infra/queue"
  $ wm add --from waymarks.json
  $ echo '{"file":"src/a.ts","line":10,"type":"todo","content":"test"}' | wm add --from -

Signals:
  ^  Raised (in-progress work, shouldn't merge to main yet)
  *  Important (high priority)

Types:
  Work:       todo, fix, wip, done, review, test, check
  Info:       note, context, tldr, this, example, idea, comment
  Caution:    warn, alert, deprecated, temp, hack
  Workflow:   blocked, needs
  Inquiry:    question

See 'wm add --prompt' for agent-facing documentation.
    `
    )
    .action(async function (this: Command, ...actionArgs: unknown[]) {
      const options = (actionArgs.at(-1) ?? {}) as { prompt?: boolean };
      await handleAddCommand(program, this, options);
    });

  const modifyCmd = program
    .command("modify")
    .argument("[target]", "waymark location (file:line)")
    .option("--id <id>", "waymark ID to modify")
    .option("--type <marker>", "change waymark type")
    .option("--raise", "add ^ (raised) signal", false)
    .option(
      "--mark-starred",
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
    .option("--prompt", "show agent-facing prompt instead of help")
    .description("modify existing waymarks");

  modifyCmd
    .addHelpText(
      "after",
      `
Examples:
  $ wm modify src/auth.ts:42 --type fix                    # Preview type change
  $ wm modify src/auth.ts:42 --raise --mark-starred       # Preview signal updates
  $ wm modify --id wm:a3k9m2p --mark-starred --write      # Apply starred flag by ID
  $ wm modify src/auth.ts:42 --clear-signals --write       # Remove all signals
  $ wm modify src/auth.ts:42 --content "new text" --write
  $ printf "new text" | wm modify src/auth.ts:42 --content - --write
  $ wm modify                                          # Interactive workflow (default when no args)
  $ wm modify --no-interactive                         # Skip prompts if default interactive would trigger

Notes:
  - Provide either FILE:LINE or --id (not both)
  - Preview is default; add --write to apply
  - --content '-' reads replacement text from stdin (like wm insert)
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
        await handleModifyCommand(program, this, target, options);
      } catch (error) {
        writeStderr(error instanceof Error ? error.message : String(error));
        process.exit(1);
      }
    });

  program
    .command("remove")
    .alias("rm")
    .allowUnknownOption(true)
    .allowExcessArguments(true)
    .option("--id <id>", "remove waymark by ID (wm:xxxxx)")
    .option(
      "--from <file>",
      "read removal targets from JSON file (use - for stdin)"
    )
    .option("--criteria <query>", "remove waymarks matching filter criteria")
    .option("--write, -w", "actually remove (default is preview)", false)
    .option("--yes, -y", "skip confirmation prompt", false)
    .option("--confirm", "always show confirmation (even with --write)", false)
    .option("--json", "output as JSON")
    .option("--jsonl", "output as JSON Lines")
    .option("--prompt", "show agent-facing prompt instead of help")
    .description("remove waymarks from files")
    .addHelpText(
      "after",
      `
Removal Methods:
  1. By Location:     wm remove src/auth.ts:42
  2. By ID:           wm remove --id wm:a3k9m2p
  3. By Criteria:     wm remove --criteria "type:todo mention:@agent" src/
  4. From JSON Input: wm remove --from waymarks.json

Examples:
  $ wm remove src/auth.ts:42                  # Preview removal
  $ wm remove src/auth.ts:42 --write          # Actually remove
  $ wm remove --id wm:a3k9m2p --write         # Remove by ID
  $ wm remove --criteria "type:todo mention:@agent" src/ --write
  $ wm remove --from removals.json --write

Filter Criteria Syntax:
  type:<marker>         Match waymark type (todo, fix, note, etc.)
  mention:<actor>       Match mention (@agent, @alice)
  tag:<hashtag>         Match tag (#perf, #sec)
  signal:^              Match raised waymarks
  signal:*              Match starred waymarks (important/valuable)
  contains:<text>       Match content containing text

Safety Features:
  - Default mode is preview (shows what would be removed)
  - --write flag required for actual removal
  - Confirmation prompt before removing (unless --yes)
  - Multi-line waymarks removed atomically
  - Removed waymarks tracked in .waymark/history.json

See 'wm remove --prompt' for agent-facing documentation.
    `
    )
    .action(async function (this: Command, ...actionArgs: unknown[]) {
      const options = (actionArgs.at(-1) ?? {}) as { prompt?: boolean };
      await handleRemoveCommand(program, this, options);
    });

  program
    .command("update")
    .description("check for and install CLI updates (npm global installs)")
    .option("--dry-run, -n", "print the npm command without executing it")
    .option("--force, -f", "run even if the install method cannot be detected")
    .option("--yes, -y", "skip the confirmation prompt")
    .option(
      "--command <command>",
      "override the underlying update command (defaults to npm)"
    )
    .action(handleUpdateAction);

  // Lint command
  program
    .command("lint")
    .argument("[paths...]", "files or directories to lint")
    .option("--json", "output JSON", false)
    .option("--prompt", "show agent-facing prompt instead of help")
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
  WM001   Duplicate property key (warn)
  WM010   Unknown marker (warn)
  WM020   Unterminated multi-line block (error)
  WM030   Multiple tldr in file (error)
  WM040   Canonical collision (error)
  WM041   Dangling relation (error)
  WM050   Signal on protected branch (policy)

Exit Codes:
  0   No errors (warnings allowed)
  1   Lint errors found
  2   Internal/tooling error

Example Output:
  src/auth.ts:12:1 - error WM041: Dangling relation 'depends:#payments/core'
  src/auth.ts:34:1 - warn WM001: Duplicate property key 'owner'
  ✖ 2 errors, 1 warning

See 'wm lint --prompt' for agent-facing documentation.
    `
    )
    .action(
      async (
        paths: string[],
        options: { json?: boolean; prompt?: boolean }
      ) => {
        try {
          await handleLintCommand(program, paths, options);
        } catch (error) {
          writeStderr(error instanceof Error ? error.message : String(error));
          process.exit(1);
        }
      }
    );

  // Migrate command
  program
    .command("migrate")
    .argument("[paths...]", "files or directories to migrate")
    .option("--write, -w", "write changes to file", false)
    .option("--include-legacy", "also migrate non-standard patterns", false)
    .option("--prompt", "show agent-facing prompt instead of help")
    .description("convert legacy comment patterns to waymark syntax")
    .addHelpText(
      "after",
      `
Examples:
  $ wm migrate src/auth.ts                # Preview migration of single file
  $ wm migrate src/auth.ts --write        # Apply migration to single file
  $ wm migrate src/**/*.ts --write        # Migrate multiple files
  $ wm migrate src/ --write               # Migrate directory
  $ wm migrate src/auth.ts --include-legacy --write

Supported Legacy Patterns:
  TODO:           → todo :::
  FIXME:          → fix :::
  HACK:           → hack :::
  NOTE:           → note :::
  XXX:            → warn :::
  @deprecated     → deprecated :::

Before Migration:
  // TODO: implement authentication
  // FIXME: validate email format
  /* XXX: this is a hack */

After Migration:
  // todo ::: implement authentication
  // fix ::: validate email format
  /* hack ::: this is a hack */

See 'wm migrate --prompt' for agent-facing documentation.
    `
    )
    .action(
      async (
        paths: string[],
        options: { write?: boolean; prompt?: boolean }
      ) => {
        try {
          await handleMigrateCommand(program, paths, options);
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
      "--format <format>, -f",
      "config format (toml|jsonc|yaml|yml)",
      "toml"
    )
    .option("--preset <preset>, -p", "config preset (full|minimal)", "full")
    .option("--scope <scope>, -s", "config scope (project|user)", "project")
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

  // Find command - explicit scan and filter (WAY-31)
  program
    .command("find")
    .argument("[paths...]", "files or directories to scan")
    .option("--type <types...>, -t", "filter by waymark type(s)")
    .option("--tag <tags...>", "filter by tag(s)")
    .option("--mention <mentions...>", "filter by mention(s)")
    .option("--raised, -R", "filter for raised (^) waymarks")
    .option("--starred, -S", "filter for starred (*) waymarks")
    .option("--tldr", "shorthand for --type tldr")
    .option("--map", "show file tree with TLDRs")
    .option("--graph", "show dependency graph")
    .option("--summary", "show summary footer (map mode)")
    .option("--long", "show detailed record information")
    .option("--tree", "group output by directory structure")
    .option("--flat", "show flat list (default)")
    .option("--compact", "compact output format")
    .option("--group <by>", "group by: file, dir, type")
    .option("--sort <by>", "sort by: file, line, type, modified")
    .option("--context <n>, -C", "show N lines of context", Number.parseInt)
    .option("--after <n>, -A", "show N lines after match", Number.parseInt)
    .option("--before <n>, -B", "show N lines before match", Number.parseInt)
    .option("--limit <n>, -n", "limit number of results", Number.parseInt)
    .option("--page <n>", "page number (with --limit)", Number.parseInt)
    .option("--interactive", "interactively select a waymark")
    .option("--json", "output as JSON")
    .option("--jsonl", "output as JSON Lines")
    .option("--text", "output as human-readable formatted text")
    .option(
      "--pretty",
      "(deprecated: use --text) output as pretty-printed JSON"
    )
    .option("--no-color", "disable colored output")
    .option("--prompt", "show agent-facing prompt instead of help")
    .description("scan and filter waymarks in files or directories")
    .addHelpText(
      "after",
      `
Examples:
  $ wm find                                   # Scan current directory
  $ wm find src/ --type todo --mention @agent
  $ wm find --map docs/ --type tldr          # Map documentation with TLDRs only
  $ wm find --graph --json                   # Export dependency graph as JSON
  $ wm find --starred --tag "#sec"           # Find high-priority security issues
  $ wm find src/ --type todo --type fix --raised --mention @agent
  $ wm find --interactive                    # Interactively select a waymark

Filter Options:
  -t, --type <types...>       Filter by waymark type(s)
  --tag <tags...>             Filter by tag(s)
  --mention <mentions...>     Filter by mention(s)
  -R, --raised                Filter for raised (^) waymarks
  -S, --starred               Filter for starred (*) waymarks
  --tldr                      Shorthand for --type tldr

  Multiple filters of the same type use OR logic:
    --type todo --type fix    → Shows todos OR fixes

  Different filter types use AND logic:
    --type todo --tag "#perf" → Shows todos AND tagged with #perf

Mode Options:
  --map                       File tree with TLDR summaries
  --graph                     Dependency graph (canonicals and relations)
  --summary                   Show summary footer (map mode)
  --interactive               Interactively select a waymark

Display Options:
  --long                      Show detailed record information
  --tree                      Group output by directory structure
  --flat                      Show flat list (default)
  --compact                   Compact output format
  --no-color                  Disable colored output

Grouping & Sorting:
  --group <by>                Group by: file, dir, type
  --sort <by>                 Sort by: file, line, type, modified

Context Display:
  -C, --context <n>           Show N lines of context around matches
  -A, --after <n>             Show N lines after each match
  -B, --before <n>            Show N lines before each match

Pagination:
  -n, --limit <n>             Limit number of results
  --page <n>                  Page number (with --limit)

Output Formats:
  --json                      Compact JSON array
  --jsonl                     Newline-delimited JSON (one record per line)
  --text                      Human-readable formatted text (default)
  --pretty                    (deprecated: use --text)

See 'wm find --prompt' for agent-facing documentation.
    `
    )
    .action(async function (
      this: Command,
      paths: string[],
      _options: Record<string, unknown>
    ) {
      try {
        const mergedOptions =
          typeof this.optsWithGlobals === "function"
            ? this.optsWithGlobals()
            : program.opts();
        await handleUnifiedCommand(program, paths, mergedOptions);
      } catch (error) {
        writeStderr(error instanceof Error ? error.message : String(error));
        process.exit(1);
      }
    });

  // Default action - unified command (deprecated implicit behavior, use 'wm find' instead)
  program
    .argument("[paths...]", "files or directories to scan")
    .addHelpText(
      "after",
      `
DEPRECATION NOTICE:
  The implicit scan syntax (e.g., 'wm src/') is deprecated.
  Use 'wm find [paths...]' instead. This will be removed in v2.0.

Examples:
  $ wm find                                   # Scan current directory
  $ wm find src/ --type todo --mention @agent
  $ wm find --map docs/ --type tldr          # Map documentation with TLDRs only
  $ wm find --graph --json                   # Export dependency graph as JSON
  $ wm find --starred --tag "#sec"           # Find high-priority security issues

See 'wm find --help' for all available options and comprehensive documentation.
    `
    )
    .action(async (paths: string[], options: Record<string, unknown>) => {
      try {
        // Show deprecation warning to STDERR (won't interfere with piped output)
        writeStderr(
          "Warning: Implicit command syntax is deprecated. Use 'wm find [paths...]' instead. This will be removed in v2.0"
        );
        await handleUnifiedCommand(program, paths, options);
      } catch (error) {
        writeStderr(error instanceof Error ? error.message : String(error));
        process.exit(1);
      }
    });

  tab(program);

  // Rename 'complete' command to 'completions' (WAY-32)
  // The tab library adds a 'complete' command automatically, but we want 'completions' as primary
  const completeCommand = program.commands.find(
    (cmd) => cmd.name() === "complete"
  );
  if (completeCommand) {
    // Update the name to 'completions' without backward-compatible alias
    // biome-ignore lint/suspicious/noExplicitAny: accessing internal Commander.js structure to rename command
    (completeCommand as any)._name = "completions";
  }

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
