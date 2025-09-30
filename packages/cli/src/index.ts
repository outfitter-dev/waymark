#!/usr/bin/env bun
// tldr ::: waymark CLI entry point wiring formatter, lint, map, and utility commands

import { existsSync } from "node:fs";

import { formatFile, parseFormatArgs } from "./commands/fmt.ts";
import { getHelp } from "./commands/help/index.ts";
import { parseLintArgs, lintFiles as runLint } from "./commands/lint.ts";
import { migrateFile, parseMigrateArgs } from "./commands/migrate.ts";
import { runUnifiedCommand } from "./commands/unified/index.ts";
import { parseUnifiedArgs } from "./commands/unified/parser.ts";
import type { CommandContext } from "./types.ts";
import { loadHelp, loadPrompt } from "./utils/content-loader.ts";
import { createContext } from "./utils/context.ts";
import { parseGlobalOptions } from "./utils/options.ts";

// Re-export utilities used by tests
// biome-ignore lint/performance/noBarrelFile: explicit test exports
export { formatMapOutput, serializeMap } from "./utils/map-rendering.ts";

const STDOUT = process.stdout;
const STDERR = process.stderr;

type CliResult = {
  exitCode: number;
};

type CommandHandler = (
  args: string[],
  context: CommandContext
) => Promise<number>;

const formatHandler: CommandHandler = async (args, context) => {
  // Handle --help for this command
  if (args.includes("--help") || args.includes("-h")) {
    const helpText = loadHelp("format") || getHelp("format");
    writeStdout(helpText);
    return 0;
  }

  // Handle --prompt for this command
  if (args.includes("--prompt")) {
    const promptText = loadPrompt("format");
    if (promptText) {
      writeStdout(promptText);
      return 0;
    }
    writeStderr("No agent prompt available for this command");
    return 1;
  }

  const options = parseFormatArgs(args);
  ensureFileExists(options.filePath);
  const { formattedText, edits } = await formatFile(options, context);

  if (edits.length === 0) {
    writeStdout(`${options.filePath}: no changes`);
  } else if (options.write) {
    writeStdout(`${options.filePath}: formatted (${edits.length} edits)`);
  } else {
    writeStdout(formattedText);
  }

  return 0;
};

const commandHandlers: Record<string, CommandHandler> = {
  format: formatHandler,
  lint: async (args, context) => {
    // Handle --help for this command
    if (args.includes("--help") || args.includes("-h")) {
      const helpText = loadHelp("lint") || getHelp("lint");
      writeStdout(helpText);
      return 0;
    }

    // Handle --prompt for this command
    if (args.includes("--prompt")) {
      const promptText = loadPrompt("lint");
      if (promptText) {
        writeStdout(promptText);
        return 0;
      }
      writeStderr("No agent prompt available for this command");
      return 1;
    }

    const options = parseLintArgs(args);
    const report = await runLint(options.filePaths, context.config.allowTypes);
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
    return report.issues.length > 0 ? 1 : 0;
  },
  migrate: async (args, context) => {
    // Handle --help for this command
    if (args.includes("--help") || args.includes("-h")) {
      const helpText = loadHelp("migrate") || getHelp("migrate");
      writeStdout(helpText);
      return 0;
    }

    // Handle --prompt for this command
    if (args.includes("--prompt")) {
      const promptText = loadPrompt("migrate");
      if (promptText) {
        writeStdout(promptText);
        return 0;
      }
      writeStderr("No agent prompt available for this command");
      return 1;
    }

    const options = parseMigrateArgs(args);
    ensureFileExists(options.filePath);
    const result = await migrateFile(options, context);
    if (options.write) {
      writeStdout(
        `${options.filePath}: ${result.changed ? "migrated" : "no changes"}`
      );
    } else {
      writeStdout(result.output);
    }
    return 0;
  },
  help: (args) => {
    const commandName = args[0];
    writeStdout(getHelp(commandName));
    return Promise.resolve(0);
  },
};

if (import.meta.main) {
  runCli(process.argv.slice(2)).then(({ exitCode }) => {
    process.exit(exitCode);
  });
}

// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: main CLI orchestration function
export async function runCli(argv: string[]): Promise<CliResult> {
  // Handle global --help/-h before parsing (takes precedence)
  if (argv.length === 1 && (argv[0] === "--help" || argv[0] === "-h")) {
    const helpText = loadHelp("unified") || getHelp();
    writeStdout(helpText);
    return { exitCode: 0 };
  }

  // Handle global --prompt before parsing (takes precedence)
  if (argv.length === 1 && argv[0] === "--prompt") {
    const promptText = loadPrompt("unified");
    if (promptText) {
      writeStdout(promptText);
      return { exitCode: 0 };
    }
    writeStderr("No agent prompt available");
    return { exitCode: 1 };
  }

  // Handle --version/-v before parsing (takes precedence)
  if (argv.length === 1 && (argv[0] === "--version" || argv[0] === "-v")) {
    // Read version from package.json (navigate up from dist/wm.js to package root)
    const packageJsonPath = new URL("../package.json", import.meta.url);
    const packageJson = await import(packageJsonPath.href);
    writeStdout(`wm version ${packageJson.default.version}`);
    return { exitCode: 0 };
  }

  const { globalOptions, rest } = parseGlobalOptions(argv);
  const [first, ...remainingArgs] = rest;

  // If no args provided, show help
  if (!first) {
    writeStderr(getHelp());
    return { exitCode: 1 };
  }

  // Check if first arg is a known command
  const handler = commandHandlers[first];

  try {
    const context = await createContext(globalOptions);

    // If it's a known command, dispatch to that handler
    if (handler) {
      const exitCode = await handler(remainingArgs, context);
      return { exitCode };
    }

    // Otherwise, treat everything as unified command args (files + flags)
    const options = parseUnifiedArgs(rest);
    const output = await runUnifiedCommand(options, context);
    if (output.length > 0) {
      writeStdout(output);
    }
    return { exitCode: 0 };
  } catch (error) {
    writeStderr(error instanceof Error ? error.message : String(error));
    return { exitCode: 1 };
  }
}

function ensureFileExists(path: string): void {
  if (!existsSync(path)) {
    throw new Error(`File not found: ${path}`);
  }
}

function writeStdout(message: string): void {
  STDOUT.write(`${message}\n`);
}

function writeStderr(message: string): void {
  STDERR.write(`${message}\n`);
}
