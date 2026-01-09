#!/usr/bin/env bun

// tldr ::: waymark CLI entry point using commander for command routing and parsing

import tab from "@bomb.sh/tab/commander";
import type { WaymarkConfig } from "@waymarks/core";
import {
  Command,
  CommanderError,
  InvalidArgumentError,
  Option,
} from "commander";
import simpleUpdateNotifier from "simple-update-notifier";
import {
  type AddCommandInputOptions,
  buildAddArgs,
  runAddCommand,
} from "./commands/add.ts";
import {
  type ConfigCommandOptions,
  runConfigCommand,
} from "./commands/config.ts";
import {
  type DoctorCommandOptions,
  formatDoctorReport,
  runDoctorCommand,
} from "./commands/doctor.ts";
import { expandFormatPaths, formatFile } from "./commands/fmt.ts";
import { getTopicHelp, helpTopicNames } from "./commands/help/index.ts";
import { runInitCommand } from "./commands/init.ts";
import { lintFiles as runLint } from "./commands/lint.ts";
import { type ModifyOptions, runModifyCommand } from "./commands/modify.ts";
import {
  buildRemoveArgs,
  type ParsedRemoveArgs,
  type RemoveCommandInputOptions,
  runRemoveCommand,
} from "./commands/remove.ts";
import { type ScanRuntimeOptions, scanRecords } from "./commands/scan.ts";
import {
  runSkillCommand,
  runSkillListCommand,
  runSkillPathCommand,
  runSkillShowCommand,
  type SkillCommandOptions,
} from "./commands/skill.ts";
import { runUnifiedCommand } from "./commands/unified/index.ts";
import { parseUnifiedArgs } from "./commands/unified/parser.ts";
import {
  runUpdateCommand,
  type UpdateCommandOptions,
} from "./commands/update.ts";
import { CliError, createUsageError } from "./errors.ts";
import { ExitCode } from "./exit-codes.ts";
import type { CommandContext, GlobalOptions } from "./types.ts";
import { createContext } from "./utils/context.ts";
import { logger } from "./utils/logger.ts";
import { normalizeScope } from "./utils/options.ts";
import {
  confirmWrite,
  selectWaymark,
  setPromptPolicy,
} from "./utils/prompts.ts";
import { parsePropertyEntry } from "./utils/properties.ts";
import { shouldUseColor } from "./utils/terminal.ts";

const STDOUT = process.stdout;
const STDERR = process.stderr;

function writeStdout(message: string): void {
  STDOUT.write(`${message}\n`);
}

function writeStderr(message: string): void {
  STDERR.write(`${message}\n`);
}

function resolveGlobalOptions(program: Command): GlobalOptions {
  const opts = program.opts();
  const scopeValue = typeof opts.scope === "string" ? opts.scope : "default";
  const configPathRaw = typeof opts.config === "string" ? opts.config : "";
  const configPath =
    configPathRaw.trim().length > 0 ? configPathRaw : undefined;
  const cacheEnabled = Boolean(opts.cache);

  return {
    scope: normalizeScope(scopeValue),
    ...(configPath ? { configPath } : {}),
    ...(cacheEnabled ? { cache: true } : {}),
  };
}

function resolveCommanderExitCode(error: CommanderError): ExitCode {
  if (error.exitCode === 0) {
    return ExitCode.success;
  }
  if (error.code.startsWith("commander.")) {
    return ExitCode.usageError;
  }
  return (error.exitCode ?? ExitCode.failure) as ExitCode;
}

function resolveExitCode(error: unknown): ExitCode {
  if (error instanceof CliError) {
    return error.exitCode;
  }
  if (error instanceof CommanderError) {
    return resolveCommanderExitCode(error);
  }
  if (
    error &&
    typeof error === "object" &&
    "code" in error &&
    typeof (error as NodeJS.ErrnoException).code === "string"
  ) {
    return ExitCode.ioError;
  }
  return ExitCode.failure;
}

function resolveErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message;
  }
  if (typeof error === "string" && error.trim().length > 0) {
    return error;
  }
  return "Unexpected error";
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

function resolveCommandOptions<T extends object>(command: Command): T {
  return typeof command.optsWithGlobals === "function"
    ? (command.optsWithGlobals() as T)
    : (command.opts() as T);
}

function parsePositionOption(value: string): string {
  if (value !== "before" && value !== "after") {
    throw new InvalidArgumentError("--position must be 'before' or 'after'");
  }
  return value;
}

function parseOrderOption(value: string): number {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) {
    throw new InvalidArgumentError("--order expects an integer");
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

function handleCommandError(program: Command, error: unknown): never {
  if (error instanceof CommanderError) {
    throw error;
  }
  const message = resolveErrorMessage(error);
  const exitCode = resolveExitCode(error);
  const code =
    exitCode === ExitCode.usageError ? "WAYMARK_USAGE" : "WAYMARK_ERROR";
  return program.error(message, { exitCode, code });
}

let signalHandlersRegistered = false;
const SIGINT_EXIT_CODE = 130;
const SIGTERM_EXIT_CODE = 143;

function registerSignalHandlers(): void {
  if (signalHandlersRegistered) {
    return;
  }
  signalHandlersRegistered = true;
  process.once("SIGINT", () => {
    process.exit(SIGINT_EXIT_CODE);
  });
  process.once("SIGTERM", () => {
    process.exit(SIGTERM_EXIT_CODE);
  });
}

// Command handlers extracted for complexity management
async function handleFormatCommand(
  program: Command,
  paths: string[],
  options: { write?: boolean }
): Promise<void> {
  const context = await createContext(resolveGlobalOptions(program));

  // If no paths provided, default to current directory
  const pathsToFormat = paths.length > 0 ? paths : ["."];
  const expandedPaths = await expandFormatPaths(pathsToFormat, context.config);

  if (expandedPaths.length === 0) {
    writeStdout("format: no waymarks found");
    return;
  }

  for (const filePath of expandedPaths) {
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
        throw new CliError("Write cancelled", ExitCode.failure);
      }
    } else {
      writeStdout(formattedText);
    }
  }
}

async function handleLintCommand(
  program: Command,
  paths: string[],
  options: { json?: boolean }
): Promise<void> {
  const context = await createContext(resolveGlobalOptions(program));

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
      writeStderr(
        `${issue.file}:${issue.line} ${issue.severity} ${issue.rule}: ${issue.message}`
      );
    }
    if (report.issues.length === 0) {
      writeStdout("lint: no issues found");
    }
  }

  const errorCount = report.issues.filter(
    (issue) => issue.severity === "error"
  ).length;

  if (errorCount > 0) {
    throw new CliError("Lint errors detected", ExitCode.failure);
  }
}

async function handleAddCommand(
  program: Command,
  command: Command
): Promise<void> {
  const args = command.args.map((arg) => String(arg));
  const [targetArg, typeArg, contentArg] = args;
  const options = resolveCommandOptions<AddCommandInputOptions>(command);
  const context = await createContext(resolveGlobalOptions(program));

  let parsed: ReturnType<typeof buildAddArgs>;
  try {
    parsed = buildAddArgs({ targetArg, typeArg, contentArg, options });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw createUsageError(message);
  }

  const result = await runAddCommand(parsed, context);

  if (result.output.length > 0) {
    writeStdout(result.output);
  }

  if (result.exitCode !== 0) {
    throw new CliError("Add command failed", ExitCode.failure);
  }
}

async function handleRemoveCommand(
  program: Command,
  command: Command
): Promise<void> {
  const targets = command.args.map((arg) => String(arg));
  const options = resolveCommandOptions<RemoveCommandInputOptions>(command);
  const context = await createContext(resolveGlobalOptions(program));

  let parsedArgs: ReturnType<typeof buildRemoveArgs>;
  try {
    parsedArgs = buildRemoveArgs({ targets, options });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw createUsageError(message);
  }
  const preview = await runRemoveCommand(parsedArgs, context, {
    writeOverride: false,
  });

  if (parsedArgs.options.write) {
    await executeRemovalWriteFlow(preview, parsedArgs, context);
    return;
  }

  outputRemovalPreview(preview);
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
    throw new CliError("Remove preview failed", ExitCode.failure);
  }

  const structuredOutput = preview.options.json || preview.options.jsonl;
  if (!structuredOutput && preview.output.length > 0) {
    writeStdout(preview.output);
  }

  const actual = await runRemoveCommand(parsedArgs, context, {
    writeOverride: true,
  });

  if (actual.output.length > 0) {
    writeStdout(actual.output);
  }

  if (actual.exitCode !== 0) {
    throw new CliError("Remove command failed", ExitCode.failure);
  }
}

type ModifyCliOptions = {
  id?: string;
  type?: string;
  content?: string;
  flagged?: boolean;
  starred?: boolean;
  clearSignals?: boolean;
  write?: boolean;
  json?: boolean;
  jsonl?: boolean;
  interactive?: boolean;
};

// Match [[hash]], [[hash|alias]], or [[alias]]
const ID_PATTERN_REGEX = /\[\[[^\]]+\]\]/i;

async function resolveInteractiveTarget(
  workspaceRoot: string,
  config: WaymarkConfig,
  scanOptions?: ScanRuntimeOptions
): Promise<{ target: string; id?: string | undefined }> {
  const records = await scanRecords([workspaceRoot], config, scanOptions);
  if (records.length === 0) {
    throw new CliError("No waymarks found to edit.", ExitCode.failure);
  }

  const selected = await selectWaymark({ records });
  if (!selected) {
    throw new CliError("No waymark selected.", ExitCode.failure);
  }

  const target = `${selected.file}:${selected.startLine}`;
  let id: string | undefined;

  if (selected.raw.includes("[[")) {
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
  if (rawOptions.flagged) {
    options.flagged = true;
  }
  if (rawOptions.starred) {
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
      rawOptions.flagged ||
      rawOptions.starred ||
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
  if (rawOptions.json && rawOptions.jsonl) {
    throw createUsageError("--json and --jsonl cannot be used together");
  }

  const interactiveOverride = determineInteractiveOverride(
    command,
    target,
    rawOptions
  );

  const context = await createContext(resolveGlobalOptions(program));

  let resolvedTarget = target;
  let resolvedId = rawOptions.id;

  if (interactiveOverride === true && !resolvedTarget && !resolvedId) {
    const { target: interactiveTarget, id: interactiveId } =
      await resolveInteractiveTarget(context.workspaceRoot, context.config, {
        cache: context.globalOptions.cache,
      });
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
    throw new CliError("Edit command failed", ExitCode.failure);
  }
}

function outputRemovalPreview(
  preview: Awaited<ReturnType<typeof runRemoveCommand>>
): void {
  if (preview.output.length > 0) {
    writeStdout(preview.output);
  }

  if (preview.exitCode !== 0) {
    throw new CliError("Remove preview failed", ExitCode.failure);
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
    throw new CliError(result.message ?? "wm update failed", ExitCode.failure);
  }
}

async function handleConfigCommand(
  program: Command,
  options: ConfigCommandOptions
): Promise<void> {
  const context = await createContext(resolveGlobalOptions(program));
  const result = await runConfigCommand(context, options);

  if (result.output.length > 0) {
    writeStdout(result.output);
  }

  if (result.exitCode !== 0) {
    throw new CliError("Config command failed", ExitCode.failure);
  }
}

function handleSkillResult(
  result: Awaited<ReturnType<typeof runSkillCommand>>,
  failureMessage: string
): void {
  if (result.output.length > 0) {
    writeStdout(result.output);
  }
  if (result.exitCode !== 0) {
    throw new CliError(failureMessage, ExitCode.failure);
  }
}

async function handleSkillCommand(options: SkillCommandOptions): Promise<void> {
  const result = await runSkillCommand(options);
  handleSkillResult(result, "Skill command failed");
}

async function handleSkillShowCommand(
  section: string,
  options: SkillCommandOptions
): Promise<void> {
  const result = await runSkillShowCommand(section, options);
  handleSkillResult(result, "Skill show failed");
}

async function handleSkillListCommand(): Promise<void> {
  const result = await runSkillListCommand();
  handleSkillResult(result, "Skill list failed");
}

function handleSkillPathCommand(): void {
  const result = runSkillPathCommand();
  handleSkillResult(result, "Skill path failed");
}

const MULTI_VALUE_OPTION_FLAGS = [
  { key: "type", flag: "--type" },
  { key: "tag", flag: "--tag" },
  { key: "mention", flag: "--mention" },
] as const;

const BOOLEAN_OPTION_FLAGS = [
  { key: "flagged", flag: "--flagged" },
  { key: "starred", flag: "--starred" },
  { key: "tldr", flag: "--tldr" },
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

  // Handle negatable flags explicitly
  if (options.wrap === false) {
    args.push("--no-wrap");
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
    `${selected.signals.flagged ? "~" : ""}${selected.signals.starred ? "*" : ""}${selected.type} ::: ${selected.contentText}`
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

// about ::: executes doctor diagnostics and outputs health report
async function handleDoctorCommand(
  program: Command,
  options: DoctorCommandOptions
): Promise<void> {
  const programOpts = program.opts();
  const context = await createContext(resolveGlobalOptions(program));

  const report = await runDoctorCommand(context, options);

  // Output based on format (check both local and global options)
  if (options.json || programOpts.json) {
    writeStdout(JSON.stringify(report, null, 2));
  } else {
    const formatted = formatDoctorReport(report);
    writeStdout(formatted);
  }

  // Exit with appropriate code
  if (!report.healthy) {
    throw new CliError("Doctor found issues", ExitCode.failure);
  }
}

function parseUnifiedOptions(
  args: string[]
): ReturnType<typeof parseUnifiedArgs> {
  try {
    return parseUnifiedArgs(args);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw createUsageError(message);
  }
}

function normalizeUnifiedColor(
  unifiedOptions: ReturnType<typeof parseUnifiedArgs>
): ReturnType<typeof parseUnifiedArgs> {
  const useColor = shouldUseColor(Boolean(unifiedOptions.noColor));
  if (!useColor) {
    return { ...unifiedOptions, noColor: true };
  }
  return unifiedOptions;
}

async function handleUnifiedInteractiveSelection(
  options: Record<string, unknown>,
  result: Awaited<ReturnType<typeof runUnifiedCommand>>
): Promise<boolean> {
  if (!(options.interactive && result.records) || result.records.length === 0) {
    return false;
  }
  const selected = await selectWaymark({ records: result.records });
  if (selected) {
    displaySelectedWaymark(selected);
  }
  return true;
}

function shouldEmitUnifiedOutput(
  unifiedOptions: ReturnType<typeof parseUnifiedArgs>,
  options: Record<string, unknown>
): boolean {
  const structuredOutput =
    unifiedOptions.outputFormat === "json" ||
    unifiedOptions.outputFormat === "jsonl";
  const quiet = Boolean(options.quiet);
  return !quiet || structuredOutput;
}

async function handleUnifiedCommand(
  program: Command,
  paths: string[],
  options: Record<string, unknown>
): Promise<void> {
  const context = await createContext(resolveGlobalOptions(program));

  const args = buildArgsFromOptions(paths, options);
  const unifiedOptions = normalizeUnifiedColor(parseUnifiedOptions(args));
  const result = await runUnifiedCommand(unifiedOptions, context);

  const didSelect = await handleUnifiedInteractiveSelection(options, result);
  if (
    !didSelect &&
    result.output.length > 0 &&
    shouldEmitUnifiedOutput(unifiedOptions, options)
  ) {
    writeStdout(result.output);
  }
}

const _DEFAULT_HELP_WIDTH = 80;

const COMMAND_ORDER = [
  "find",
  "add",
  "edit",
  "rm",
  "fmt",
  "lint",
  "init",
  "config",
  "skill",
  "doctor",
  "completions",
  "update",
  "help",
];

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
  return commands.filter((c) => !c.hidden).sort(compareCommandOrder);
}

type OptionSection = {
  title: string;
  longs: string[];
};

const ROOT_OPTION_SECTIONS: OptionSection[] = [
  {
    title: "Global Options",
    longs: ["--help", "--version", "--no-input", "--scope", "--config"],
  },
  {
    title: "Logging",
    longs: ["--verbose", "--debug", "--quiet"],
  },
  {
    title: "Output Formats",
    longs: ["--json", "--jsonl", "--text"],
  },
  {
    title: "Color",
    longs: ["--no-color"],
  },
];

function findOptionByLong(cmd: Command, longFlag: string): Option | undefined {
  return cmd.options.find((opt) => opt.long === longFlag);
}

function renderOptionSection(
  title: string,
  options: Option[],
  helper: ReturnType<Command["createHelp"]>,
  termWidth: number
): string {
  if (options.length === 0) {
    return "";
  }
  let section = `\n\n${title}:\n`;
  for (const opt of options) {
    section += `  ${helper.optionTerm(opt).padEnd(termWidth)}  ${helper.optionDescription(opt)}\n`;
  }
  return section;
}

function formatRootHelp(
  cmd: Command,
  helper: ReturnType<Command["createHelp"]>,
  visibleCommands: Command[]
): string {
  const termWidth = helper.padWidth(cmd, helper);
  let output = helper.commandUsage(cmd);
  output += "\n";
  output += helper.commandDescription(cmd);

  for (const section of ROOT_OPTION_SECTIONS) {
    const options = section.longs
      .map((flag) => findOptionByLong(cmd, flag))
      .filter((opt): opt is Option => Boolean(opt));
    output += renderOptionSection(section.title, options, helper, termWidth);
  }

  if (visibleCommands.length > 0) {
    output += "\n\nCommands:\n";
    for (const c of visibleCommands) {
      const name = c.name() + (c.alias() ? `|${c.alias()}` : "");
      output += `  ${name.padEnd(termWidth)}  ${c.description()}\n`;
    }
  }

  if (helpTopicNames.length > 0) {
    output += "\n\nTopics:\n";
    output += `  Run 'wm help <topic>' for syntax guides (${helpTopicNames.join(
      ", "
    )})\n`;
  }

  return `${output}\n`;
}

/**
 * Format help text for commander with custom command ordering.
 */
function formatCustomHelp(
  cmd: Command,
  helper: ReturnType<Command["createHelp"]>,
  visibleCommands: Command[]
): string {
  if (!cmd.parent) {
    return formatRootHelp(cmd, helper, visibleCommands);
  }

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
  program.exitOverride((error) => {
    const exitCode = resolveCommanderExitCode(error);
    process.exit(exitCode);
  });

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
        "  wm [paths...]             Scan and filter waymarks (default: current directory)\n" +
        "  wm find --graph           Show dependency graph\n" +
        "  wm fmt <file> --write     Format waymarks in file\n" +
        "  wm rm <file:line> --write Remove waymark from file\n" +
        "  wm init                   Initialize waymark configuration"
    )
    .version(version, "--version, -v", "output the current version")
    .helpOption("--help, -h", "display help for command")
    .addHelpCommand(false) // Disable default help command, we'll add custom one
    .configureHelp({
      formatHelp: buildCustomHelpFormatter(),
    })
    .addOption(
      new Option("--scope <scope>, -s", "config scope (default|project|user)")
        .choices(["default", "project", "user"])
        .default("default")
    )
    .option("--config <path>", "load additional config file (JSON/YAML/TOML)")
    .option("--cache", "use scan cache for faster repeated runs")
    .option("--no-input", "fail if interactive input required")
    .option("--verbose", "enable verbose logging (info level)")
    .option("--debug", "enable debug logging")
    .option("--quiet, -q", "only show errors")
    .addOption(jsonOption)
    .addOption(jsonlOption)
    .addOption(textOption)
    .option("--no-color", "disable ANSI colors")
    .addHelpText(
      "afterAll",
      `
Exit Codes:
  0  Success
  1  Waymark error
  2  Usage error (invalid flags or arguments)
  3  Configuration error
  4  I/O error (file not found, permission denied)

Note: For agent-facing documentation, use "wm skill".
`
    )
    .hook("preAction", (thisCommand) => {
      // Configure logger based on flags
      const opts = thisCommand.opts();
      setPromptPolicy({ noInput: Boolean(opts.noInput) });
      if (opts.debug) {
        logger.level = "debug";
      } else if (opts.verbose) {
        logger.level = "info";
      } else if (opts.quiet) {
        logger.level = "error";
      }
    });

  // Custom help command
  program
    .command("help")
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

  // Format command
  program
    .command("fmt", { hidden: true })
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

  program
    .command("add")
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

  const editCmd = program
    .command("edit")
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

  editCmd
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

  program
    .command("rm")
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
    .action(async (options) => {
      try {
        await handleUpdateAction(options);
      } catch (error) {
        handleCommandError(program, error);
      }
    });

  // Lint command
  program
    .command("lint", { hidden: true })
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
  legacy-pattern       Legacy codetag pattern (warn)

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
          handleCommandError(program, error);
        }
      }
    );

  program
    .command("config")
    .option("--print", "print merged configuration", false)
    .option("--json", "output compact JSON", false)
    .description("print resolved configuration")
    .addHelpText(
      "after",
      `
Examples:
  $ wm config --print                 # Show merged configuration
  $ wm --scope user config --print    # Show user-level configuration
  $ wm --config ./custom.toml config --print
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

  const skillCommand = program
    .command("skill")
    .description("show agent-facing skill documentation")
    .option("--json", "output structured JSON")
    .action(async (options: SkillCommandOptions) => {
      try {
        await handleSkillCommand(options);
      } catch (error) {
        handleCommandError(program, error);
      }
    });

  skillCommand
    .command("show")
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

  skillCommand
    .command("list")
    .description("list available skill sections")
    .action(async () => {
      try {
        await handleSkillListCommand();
      } catch (error) {
        handleCommandError(program, error);
      }
    });

  skillCommand
    .command("path")
    .description("print the skill directory path")
    .action(() => {
      try {
        handleSkillPathCommand();
      } catch (error) {
        handleCommandError(program, error);
      }
    });

  // Doctor command - health checks and diagnostics (WAY-47)
  program
    .command("doctor")
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

  // Find command - explicit scan and filter (WAY-31)
  program
    .command("find")
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
    .option(
      "--pretty",
      "(deprecated: use --text) output as pretty-printed JSON"
    )
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
  --pretty                    (deprecated: use --text)

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

  tab(program);

  // Rename 'complete' command to 'completions' (WAY-32)
  // The tab library adds a 'complete' command automatically, but we want 'completions' as primary
  const completeCommand = program.commands.find(
    (cmd) => cmd.name() === "complete"
  );
  if (completeCommand) {
    // note ::: keep `wm complete` as backward-compatible alias ref:#cli/completions
    // Update the name to 'completions' while preserving the legacy alias
    // biome-ignore lint/suspicious/noExplicitAny: accessing internal Commander.js structure to rename command
    (completeCommand as any)._name = "completions";
    completeCommand.alias("complete");
  }

  return program;
}

if (import.meta.main) {
  registerSignalHandlers();
  createProgram()
    .then((program) => program.parseAsync(process.argv))
    .catch((error) => {
      const message = resolveErrorMessage(error);
      const exitCode = resolveExitCode(error);
      writeStderr(message);
      process.exit(exitCode);
    });
}

// For testing
export async function runCli(argv: string[]): Promise<{
  exitCode: number;
  stdout: string;
  stderr: string;
}> {
  const previousArgv = [...process.argv];
  const cliArgv = ["node", "wm", ...argv];
  process.argv = [...cliArgv];
  const stdoutChunks: string[] = [];
  const stderrChunks: string[] = [];
  const originalStdoutWrite = process.stdout.write.bind(process.stdout);
  const originalStderrWrite = process.stderr.write.bind(process.stderr);

  const capture =
    (chunks: string[]) =>
    (
      chunk: string | Uint8Array,
      encoding?: BufferEncoding,
      callback?: () => void
    ): boolean => {
      const text =
        typeof chunk === "string"
          ? chunk
          : Buffer.from(chunk).toString(encoding ?? "utf8");
      chunks.push(text);
      if (callback) {
        callback();
      }
      return true;
    };

  process.stdout.write = capture(stdoutChunks) as typeof process.stdout.write;
  process.stderr.write = capture(stderrChunks) as typeof process.stderr.write;

  let exitCode = ExitCode.success;
  try {
    const program = await createProgram();
    program.exitOverride((error) => {
      throw error;
    });
    await program.parseAsync(cliArgv);
  } catch (error) {
    exitCode = resolveExitCode(error);
  } finally {
    process.argv = previousArgv;
    process.stdout.write = originalStdoutWrite;
    process.stderr.write = originalStderrWrite;
  }

  return {
    exitCode,
    stdout: stdoutChunks.join(""),
    stderr: stderrChunks.join(""),
  };
}

export const __test = {
  createProgram,
};
