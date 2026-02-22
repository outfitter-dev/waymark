// tldr ::: waymark CLI program builder and command routing

import tab from "@bomb.sh/tab/commander";
import { createCLI } from "@outfitter/cli/command";
import { colorPreset, interactionPreset } from "@outfitter/cli/flags";
import {
  type AnyKitError,
  type ErrorCategory,
  getExitCode,
  InternalError,
  ValidationError,
} from "@outfitter/contracts";
import type { WaymarkConfig } from "@waymarks/core";
import { type Command, CommanderError, Option } from "commander";
import simpleUpdateNotifier from "simple-update-notifier";
import {
  type AddCommandInput,
  type AddCommandInputOptions,
  buildAddArgs,
  runAddCommand,
} from "./commands/add.ts";
import {
  type CheckCommandOptions,
  formatCheckReport,
  runCheckCommand,
} from "./commands/check.ts";
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
import { helpTopicNames } from "./commands/help/index.ts";
import { runInitCommand } from "./commands/init.ts";
import { lintFiles as runLint } from "./commands/lint.ts";
import { type ModifyOptions, runModifyCommand } from "./commands/modify.ts";
import { registerCommands } from "./commands/register.ts";
import {
  buildRemoveArgs,
  type ParsedRemoveArgs,
  type RemoveCommandInputOptions,
  runRemoveCommand,
} from "./commands/remove.ts";
import { type ScanRuntimeOptions, scanRecords } from "./commands/scan.ts";
import {
  buildSeedArgs,
  runSeedCommand,
  type SeedCommandOptions,
} from "./commands/seed.ts";
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
import type {
  CommandContext,
  GlobalOptions,
  ModifyCliOptions,
} from "./types.ts";
import { createContext } from "./utils/context.ts";
import { logger } from "./utils/logger.ts";
import { normalizeScope } from "./utils/options.ts";
import { selectWaymark, setPromptPolicy } from "./utils/prompts.ts";
import { createSpinner } from "./utils/spinner.ts";
import { shouldUseColor } from "./utils/terminal.ts";

const STDOUT = process.stdout;
const STDERR = process.stderr;

function writeStdout(message: string): void {
  STDOUT.write(`${message}\n`);
}

function writeStderr(message: string): void {
  STDERR.write(`${message}\n`);
}

function shouldEnableSpinner(options: {
  quiet?: boolean;
  structuredOutput?: boolean;
}): boolean {
  if (options.structuredOutput) {
    return false;
  }
  if (options.quiet) {
    return false;
  }
  return Boolean(process.stderr.isTTY);
}

// about ::: resolves --color/--no-color preset output to a noColor boolean for spinner/terminal helpers
function resolveNoColorFromOpts(opts: Record<string, unknown>): boolean {
  const colorValue = opts.color;
  // colorPreset resolves color to "auto"|"always"|"never"; Commander negation sets it to false
  if (colorValue === false || colorValue === "never") {
    return true;
  }
  return false;
}

function resolveGlobalOptions(program: Command): GlobalOptions {
  const opts = program.opts();
  const scopeValue = typeof opts.scope === "string" ? opts.scope : "default";
  const configPathRaw = typeof opts.config === "string" ? opts.config : "";
  const configPath =
    configPathRaw.trim().length > 0 ? configPathRaw : undefined;
  const cacheEnabled = Boolean(opts.cache);
  const includeIgnored = Boolean(opts.includeIgnored);

  return {
    scope: normalizeScope(scopeValue),
    ...(configPath ? { configPath } : {}),
    ...(cacheEnabled ? { cache: true } : {}),
    ...(includeIgnored ? { includeIgnored: true } : {}),
  };
}

function resolveCommanderExitCode(error: {
  exitCode: number;
  code: string;
}): number {
  if (error.exitCode === 0) {
    return 0;
  }
  if (error.code.startsWith("commander.")) {
    return getExitCode("validation");
  }
  return error.exitCode ?? 1;
}

// about ::: duck-type check for CommanderError since createCLI() may bundle its own Commander copy
function isCommanderLikeError(
  error: unknown
): error is { exitCode: number; code: string } {
  return (
    error !== null &&
    typeof error === "object" &&
    "exitCode" in error &&
    typeof (error as { exitCode: unknown }).exitCode === "number" &&
    "code" in error &&
    typeof (error as { code: unknown }).code === "string" &&
    (error as { code: string }).code.startsWith("commander.")
  );
}

// note ::: Commander already writes help/version to stdout before throwing;
// suppress duplicate output in runMain() and runCli() error handlers
function isCommanderOutputError(error: unknown): boolean {
  if (error instanceof CommanderError) {
    return (
      error.code === "commander.helpDisplayed" ||
      error.code === "commander.version"
    );
  }
  if (isCommanderLikeError(error)) {
    return (
      error.code === "commander.helpDisplayed" ||
      error.code === "commander.version"
    );
  }
  return false;
}

// about ::: maps thrown errors to CLI exit codes using @outfitter/contracts categories
function resolveExitCode(error: unknown): number {
  if (error instanceof CommanderError) {
    return resolveCommanderExitCode(error);
  }
  // Handle CommanderError from a different Commander copy (e.g., via createCLI bundle)
  if (isCommanderLikeError(error)) {
    return resolveCommanderExitCode(error);
  }
  // Check for @outfitter/contracts tagged errors with a category property
  if (
    error &&
    typeof error === "object" &&
    "category" in error &&
    typeof (error as { category: unknown }).category === "string"
  ) {
    return getExitCode((error as { category: ErrorCategory }).category);
  }
  if (
    error &&
    typeof error === "object" &&
    "code" in error &&
    typeof (error as NodeJS.ErrnoException).code === "string"
  ) {
    const errnoCode = (error as NodeJS.ErrnoException).code;
    if (errnoCode === "ENOENT") {
      return getExitCode("not_found");
    }
    if (errnoCode === "EACCES" || errnoCode === "EPERM") {
      return getExitCode("permission");
    }
    return getExitCode("internal");
  }
  return 1;
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

function resolveCommandOptions<T extends object>(command: Command): T {
  return typeof command.optsWithGlobals === "function"
    ? (command.optsWithGlobals() as T)
    : (command.opts() as T);
}

function handleCommandError(program: Command, error: unknown): never {
  if (error instanceof CommanderError || isCommanderLikeError(error)) {
    throw error;
  }
  const message = resolveErrorMessage(error);
  const exitCode = resolveExitCode(error);
  const isValidation =
    error &&
    typeof error === "object" &&
    "category" in error &&
    (error as { category: string }).category === "validation";
  const code = isValidation ? "WAYMARK_USAGE" : "WAYMARK_ERROR";
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

/**
 * Unwrap a Result, throwing the contracts error on failure.
 * Bridges Result-returning core functions to the throw-based CLI error flow.
 */
async function runCommand<T>(
  fn: () => Promise<import("@outfitter/contracts").Result<T, AnyKitError>>
): Promise<T> {
  const result = await fn();
  if (result.isErr()) {
    throw result.error;
  }
  return result.value;
}

// Command handlers extracted for complexity management
async function handleFormatCommand(
  program: Command,
  paths: string[],
  options: { yes?: boolean }
): Promise<void> {
  const context = await createContext(resolveGlobalOptions(program));

  // If no paths provided, default to current directory
  const pathsToFormat = paths.length > 0 ? paths : ["."];
  const expandedPaths = await runCommand(() =>
    expandFormatPaths(pathsToFormat, context.config)
  );

  if (expandedPaths.length === 0) {
    writeStdout("format: no waymarks found");
    return;
  }

  for (const filePath of expandedPaths) {
    // First, format without writing to see what changes would be made
    const { formattedText, edits } = await runCommand(() =>
      formatFile({ filePath, write: false }, context)
    );

    if (edits.length === 0) {
      writeStdout(`${filePath}: no changes`);
      continue;
    }

    // If --yes flag is set, write changes without confirmation
    if (options.yes) {
      await runCommand(() => formatFile({ filePath, write: true }, context));
      writeStdout(`${filePath}: formatted (${edits.length} edits)`);
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
  const programOpts = program.opts();

  // If no paths provided, default to current directory
  const pathsToLint = paths.length > 0 ? paths : ["."];

  const spinner = createSpinner({
    enabled: shouldEnableSpinner({
      quiet: Boolean(programOpts.quiet),
      structuredOutput: Boolean(options.json),
    }),
    text: "Linting waymarks...",
    noColor: resolveNoColorFromOpts(programOpts),
  });

  spinner.start();
  let report: import("./commands/lint.ts").LintReport;
  try {
    report = await runCommand(() =>
      runLint(pathsToLint, context.config.allowTypes, context.config)
    );
  } finally {
    spinner.stop();
  }

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
    throw InternalError.create("Lint errors detected");
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
    const addInput: AddCommandInput = { options };
    if (targetArg !== undefined) {
      addInput.targetArg = targetArg;
    }
    if (typeArg !== undefined) {
      addInput.typeArg = typeArg;
    }
    if (contentArg !== undefined) {
      addInput.contentArg = contentArg;
    }
    parsed = buildAddArgs(addInput);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw ValidationError.fromMessage(message);
  }

  const result = await runCommand(() => runAddCommand(parsed, context));

  if (result.output.length > 0) {
    writeStdout(result.output);
  }

  if (result.summary.failed > 0) {
    process.exitCode = 1;
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
    throw ValidationError.fromMessage(message);
  }
  const preview = await runCommand(() =>
    runRemoveCommand(parsedArgs, context, { writeOverride: false })
  );

  if (parsedArgs.options.write) {
    if (preview.summary.failed > 0) {
      outputRemovalPreview(preview);
      process.exitCode = 1;
      return;
    }
    await executeRemovalWriteFlow(preview, parsedArgs, context);
    return;
  }

  outputRemovalPreview(preview);
}

async function executeRemovalWriteFlow(
  preview: import("./commands/remove.ts").RemoveCommandResult,
  parsedArgs: ParsedRemoveArgs,
  context: CommandContext
): Promise<void> {
  const structuredOutput = preview.options.json || preview.options.jsonl;
  if (!structuredOutput && preview.output.length > 0) {
    writeStdout(preview.output);
  }

  const actual = await runCommand(() =>
    runRemoveCommand(parsedArgs, context, { writeOverride: true })
  );

  if (actual.output.length > 0) {
    writeStdout(actual.output);
  }
}

// Match [[hash]], [[hash|alias]], or [[alias]]
const ID_PATTERN_REGEX = /\[\[[^\]]+\]\]/i;

async function resolveInteractiveTarget(
  workspaceRoot: string,
  config: WaymarkConfig,
  scanOptions?: ScanRuntimeOptions
): Promise<{ target: string; id?: string | undefined }> {
  const scanResult = await scanRecords([workspaceRoot], config, scanOptions);
  if (scanResult.isErr()) {
    throw InternalError.create(scanResult.error.message);
  }
  const records = scanResult.value;
  if (records.length === 0) {
    throw InternalError.create("No waymarks found to edit.");
  }

  const selected = await selectWaymark({ records });
  if (!selected) {
    throw InternalError.create("No waymark selected.");
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
    throw ValidationError.fromMessage(
      "--json and --jsonl cannot be used together"
    );
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
    const interactiveOptions =
      context.globalOptions.cache === undefined
        ? {}
        : { cache: context.globalOptions.cache };
    const { target: interactiveTarget, id: interactiveId } =
      await resolveInteractiveTarget(
        context.workspaceRoot,
        context.config,
        interactiveOptions
      );
    resolvedTarget = interactiveTarget;
    resolvedId = interactiveId;
  }

  const options = buildModifyOptions(
    resolvedId,
    rawOptions,
    interactiveOverride
  );

  const result = await runCommand(() =>
    runModifyCommand(context, resolvedTarget, options, {
      stdin: process.stdin,
    })
  );

  if (result.output.length > 0) {
    writeStdout(result.output);
  }
}

function outputRemovalPreview(
  preview: import("./commands/remove.ts").RemoveCommandResult
): void {
  if (preview.output.length > 0) {
    writeStdout(preview.output);
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

  const result = await runCommand(() => runUpdateCommand(updateOptions));

  if (result.message) {
    writeStdout(result.message);
  }

  if (!result.skipped) {
    writeStdout("wm update completed.");
  }
}

async function handleInitCommand(options: {
  format?: string;
  preset?: string;
  scope?: string;
  force?: boolean;
}): Promise<void> {
  await runCommand(() => runInitCommand(options));
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
    throw InternalError.create("Config command failed");
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
    throw InternalError.create(failureMessage);
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
  { key: "pretty", flag: "--pretty" }, // Pretty-printed JSON output
  { key: "long", flag: "--long" },
  { key: "tree", flag: "--tree" },
  { key: "flat", flag: "--flat" },
  { key: "compact", flag: "--compact" },
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

// note ::: negatable flags that map to --no-<flag> when their condition is met
function appendNegatableArgs(
  args: string[],
  options: Record<string, unknown>
): void {
  if (options.wrap === false) {
    args.push("--no-wrap");
  }
  // color preset: --no-color when color is "never" or false (Commander negation)
  if (options.color === "never" || options.color === false) {
    args.push("--no-color");
  }
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

  appendNegatableArgs(args, options);

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
      writeStdout(`${key}: ${value}`);
    }
  }

  if (selected.relations.length > 0) {
    writeStdout("\nRelations:");
    for (const rel of selected.relations) {
      writeStdout(`${rel.kind}: ${rel.token}`);
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

  const spinner = createSpinner({
    enabled: shouldEnableSpinner({
      quiet: Boolean(programOpts.quiet),
      structuredOutput: Boolean(options.json || programOpts.json),
    }),
    text: "Running diagnostics...",
    noColor: resolveNoColorFromOpts(programOpts),
  });

  spinner.start();
  let report: import("./commands/doctor.ts").DoctorReport;
  try {
    report = await runCommand(() => runDoctorCommand(context, options));
  } finally {
    spinner.stop();
  }

  // Output based on format (check both local and global options)
  if (options.json || programOpts.json) {
    writeStdout(JSON.stringify(report, null, 2));
  } else {
    const formatted = formatDoctorReport(report);
    writeStdout(formatted);
  }

  // Exit with appropriate code
  if (!report.healthy) {
    throw InternalError.create("Doctor found issues");
  }
}

// about ::: executes content integrity checks and outputs report
async function handleCheckCommand(
  program: Command,
  options: CheckCommandOptions
): Promise<void> {
  const programOpts = program.opts();
  const context = await createContext(resolveGlobalOptions(program));

  const spinner = createSpinner({
    enabled: shouldEnableSpinner({
      quiet: Boolean(programOpts.quiet),
      structuredOutput: Boolean(options.json || programOpts.json),
    }),
    text: "Checking content integrity...",
    noColor: resolveNoColorFromOpts(programOpts),
  });

  spinner.start();
  let report: import("./commands/check.ts").CheckReport;
  try {
    report = await runCommand(() => runCheckCommand(context, options));
  } finally {
    spinner.stop();
  }

  // Output based on format (check both local and global options)
  if (options.json || programOpts.json) {
    writeStdout(JSON.stringify(report, null, 2));
  } else {
    const formatted = formatCheckReport(report);
    writeStdout(formatted);
  }

  // Exit with appropriate code
  if (!report.passed) {
    throw InternalError.create("Check found issues");
  }
}

// about ::: executes seed command to auto-generate TLDRs from docstrings
async function handleSeedCommand(
  program: Command,
  paths: string[],
  options: SeedCommandOptions
): Promise<void> {
  const context = await createContext(resolveGlobalOptions(program));

  // If no paths provided, default to current directory
  const pathsToSeed = paths.length > 0 ? paths : ["."];

  const parsed = buildSeedArgs({
    paths: pathsToSeed,
    options,
  });

  const result = await runSeedCommand(parsed, context);

  if (result.output.length > 0) {
    writeStdout(result.output);
  }

  if (result.exitCode !== 0) {
    throw InternalError.create("Seed command failed");
  }
}

function parseUnifiedOptions(
  args: string[]
): ReturnType<typeof parseUnifiedArgs> {
  try {
    return parseUnifiedArgs(args);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw ValidationError.fromMessage(message);
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
  result: import("./commands/unified/index.ts").UnifiedCommandResult
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
  const structuredOutput =
    unifiedOptions.outputFormat === "json" ||
    unifiedOptions.outputFormat === "jsonl";
  const spinner = createSpinner({
    enabled: shouldEnableSpinner({
      quiet: Boolean(options.quiet),
      structuredOutput,
    }),
    text: "Scanning waymarks...",
    noColor: Boolean(unifiedOptions.noColor),
  });

  spinner.start();
  let result: import("./commands/unified/index.ts").UnifiedCommandResult;
  try {
    result = await runCommand(() => runUnifiedCommand(unifiedOptions, context));
  } finally {
    spinner.stop();
  }

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
  "check",
  "seed",
  "init",
  "config",
  "skill",
  "doctor",
  "completions",
  "update",
  "help",
];

const HIDDEN_COMMANDS = new Set(["fmt", "lint"]);

/**

- Sort comparator for commands based on predefined order.
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

- Filter and sort commands for help display.
 */
function getVisibleCommands(commands: readonly Command[]): Command[] {
  return commands
    .filter((command) => !HIDDEN_COMMANDS.has(command.name()))
    .sort(compareCommandOrder);
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
    longs: ["--color", "--no-color"],
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
    section += `${helper.optionTerm(opt).padEnd(termWidth)}  ${helper.optionDescription(opt)}\n`;
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
      output += `${name.padEnd(termWidth)}  ${c.description()}\n`;
    }
  }

  if (helpTopicNames.length > 0) {
    output += "\n\nTopics:\n";
    output += `Run 'wm help <topic>' for syntax guides (${helpTopicNames.join(
      ", "
    )})\n`;
  }

  return `${output}\n`;
}

/**

- Format help text for commander with custom command ordering.
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
      output += `${helper.argumentTerm(arg).padEnd(termWidth)}  ${helper.argumentDescription(arg)}\n`;
    }
  }

  // Add options section
  const optionList = helper.visibleOptions(cmd);
  if (optionList.length > 0) {
    output += "\n\nOptions:\n";
    for (const opt of optionList) {
      output += `${helper.optionTerm(opt).padEnd(termWidth)}  ${helper.optionDescription(opt)}\n`;
    }
  }

  // Add commands section
  if (visibleCommands.length > 0) {
    output += "\n\nCommands:\n";
    for (const c of visibleCommands) {
      const name = c.name() + (c.alias() ? `|${c.alias()}` : "");
      output += `${name.padEnd(termWidth)}  ${c.description()}\n`;
    }
  }

  return `${output}\n`;
}

/**

- Build custom help formatter for commander.
- Filters out hidden commands and reorders visible commands.
 */
function buildCustomHelpFormatter() {
  return (cmd: Command, helper: ReturnType<Command["createHelp"]>) => {
    const visibleCommands = getVisibleCommands(cmd.commands);
    return formatCustomHelp(cmd, helper, visibleCommands);
  };
}

/**
 * Build a CLI instance with all commands registered.
 * Uses createCLI() from @outfitter/cli for program bootstrap, error handling,
 * and --json env-var bridging. Returns both the CLI wrapper and the underlying
 * Commander program for backward compatibility.
 * @returns CLI instance and the underlying Commander program.
 */
export async function createProgram(): Promise<Command> {
  // Read version from package.json
  const packageJsonPath = new URL("../package.json", import.meta.url);
  const packageJson = await import(packageJsonPath.href);
  const version = packageJson.default.version as string;

  await simpleUpdateNotifier({
    pkg: packageJson.default,
    shouldNotifyInNpmScript: true,
  });

  // about ::: createCLI provides: name, version, --json flag with OUTFITTER_JSON bridge,
  // exitOverride, and structured error/exit handling via onError/onExit callbacks
  const cli = createCLI({
    name: "wm",
    version,
    description:
      "Waymark CLI - scan, filter, format, and manage waymarks\n\n" +
      "Quick Start:\n" +
      "  wm [paths...]             Scan and filter waymarks (default: current directory)\n" +
      "  wm find --graph           Show dependency graph\n" +
      "  wm fmt <file> --write     Format waymarks in file\n" +
      "  wm rm <file:line> --write Remove waymark from file\n" +
      "  wm init                   Initialize waymark configuration",
    onError: (error) => {
      const message = resolveErrorMessage(error);
      writeStderr(message);
    },
    onExit: (code) => {
      process.exit(code);
    },
  });

  const program = cli.program;

  // note ::: createCLI() already adds --json; configure conflicts and add --jsonl, --text
  const existingJsonOption = program.options.find(
    (opt) => opt.long === "--json"
  );
  if (existingJsonOption) {
    existingJsonOption.conflicts("jsonl");
    existingJsonOption.conflicts("text");
  }
  const jsonlOption = new Option(
    "--jsonl",
    "Output as JSON Lines (newline-delimited)"
  );
  const textOption = new Option(
    "--text",
    "Output as human-readable formatted text"
  );
  jsonlOption.conflicts("json");
  jsonlOption.conflicts("text");
  textOption.conflicts("json");
  textOption.conflicts("jsonl");

  // note ::: createCLI() already calls .version() with default -V flag;
  // patch the short flag to -v (lowercase) to match waymark convention
  const existingVersionOption = program.options.find(
    (opt) => opt.long === "--version"
  );
  if (existingVersionOption) {
    // biome-ignore lint/suspicious/noExplicitAny: patching Commander option internals to change -V to -v
    (existingVersionOption as any).short = "-v";
    // biome-ignore lint/suspicious/noExplicitAny: patching Commander option internals for display
    (existingVersionOption as any).flags = "-v, --version";
    existingVersionOption.description = "output the current version";
  }

  program
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
    .option("--include-ignored", "include waymarks inside wm:ignore fences")
    .option("--verbose", "enable verbose logging (info level)")
    .option("--debug", "enable debug logging")
    .option("--quiet, -q", "only show errors")
    .addOption(jsonlOption)
    .addOption(textOption)
    .addHelpText(
      "afterAll",
      `
Exit Codes:
  0  Success
  1  Validation error (invalid flags, arguments, or waymark syntax)
  2  Not found (file, waymark, or resource missing)
  3  Conflict (concurrent modification or merge conflict)
  4  Permission error
  8  Internal error (unexpected failure)
  130  Cancelled (user interrupted)

Note: For agent-facing documentation, use "wm skill".
`
    )
    .hook("preAction", (thisCommand) => {
      // Configure logger based on flags
      const opts = thisCommand.opts();
      const resolvedInteraction = interactionPreset().resolve(opts);
      setPromptPolicy({ noInput: !resolvedInteraction.interactive });
      if (opts.debug) {
        logger.level = "debug";
      } else if (opts.verbose) {
        logger.level = "info";
      } else if (opts.quiet) {
        logger.level = "error";
      }
    });

  // note ::: apply flag presets to program — interactionPreset adds --non-interactive/--no-input/-y/--yes,
  // colorPreset adds --color [mode]/--no-color; register after other options to preserve option order
  const interactionOpts = interactionPreset().options;
  const colorOpts = colorPreset().options;

  // hide options that are aliases or internal — we surface only the canonical flags in help sections
  const hiddenInteractionFlags = new Set(["--non-interactive", "-y, --yes"]);

  for (const opt of [...interactionOpts, ...colorOpts]) {
    if (opt.required === true) {
      program.requiredOption(opt.flags, opt.description, opt.defaultValue);
    } else {
      program.option(opt.flags, opt.description, opt.defaultValue);
    }
    if (hiddenInteractionFlags.has(opt.flags)) {
      const added = program.options.find((o) => o.flags === opt.flags);
      added?.hideHelp();
    }
  }

  registerCommands(program, {
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
    handleCheckCommand,
    handleUnifiedCommand,
    handleSeedCommand,
    writeStdout,
  });

  tab(program);

  // Rename 'complete' command to 'completions' (WAY-32)
  // The tab library adds a 'complete' command automatically, but we want 'completions' as primary
  const completeCommand = program.commands.find(
    (cmd) => cmd.name() === "complete"
  );
  if (completeCommand) {
    // note ::: keep `wm complete` as alias for completions ref:#cli/completions
    // Update the name to 'completions' while preserving the alias
    // biome-ignore lint/suspicious/noExplicitAny: accessing internal Commander.js structure to rename command
    (completeCommand as any)._name = "completions";
    completeCommand.alias("complete");
  }

  return program;
}

/**
 * Run the CLI using process.argv when invoked as a script.
 * Exits the process with appropriate exit code.
 * @returns No return value; process exits after execution.
 */
export function runMain(): void {
  registerSignalHandlers();
  createProgram()
    .then((program) => program.parseAsync(process.argv))
    .catch((error) => {
      const exitCode = resolveExitCode(error);
      // note ::: Commander already printed help/version to stdout; don't echo again
      if (!isCommanderOutputError(error)) {
        const message = resolveErrorMessage(error);
        writeStderr(message);
      }
      process.exit(exitCode);
    });
}

/**

- Run the CLI with a custom argv array, capturing stdout/stderr.
- @param argv - Command-line arguments (excluding node and binary).
- @returns Exit code and captured stdout/stderr.
 */
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

  let exitCode = 0;
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

/** @internal */
export const __test = {
  createProgram,
};
