#!/usr/bin/env bun
// tldr ::: waymark CLI entry point wiring formatter, lint, map, and utility commands

import { existsSync } from "node:fs";

import { loadConfigFromDisk, type WaymarkMap } from "@waymarks/core";
import { findRecords, parseFindArgs } from "./commands/find";
import { formatFile, parseFormatArgs } from "./commands/fmt";
import { graphRecords, parseGraphArgs } from "./commands/graph";
import { displayHelp as renderHelp } from "./commands/help";
import { parseLintArgs, lintFiles as runLint } from "./commands/lint";
import { mapFiles, parseMapArgs } from "./commands/map";
import { migrateFile, parseMigrateArgs } from "./commands/migrate";
import { parseScanArgs, scanRecords } from "./commands/scan";
import { displayTuiMessage } from "./commands/tui";
import type { CliScopeOption, CommandContext, GlobalOptions } from "./types";
import { renderRecords } from "./utils/output";

const STDOUT = process.stdout;
const STDERR = process.stderr;

const usage = `waymark <command> [options]

Commands:
  fmt <file> [--write|-w] [--config <path>]    Format a file (stdout by default)
  scan <file> [--json|--jsonl|--pretty]       Parse waymarks in a file
  map [--json] <file...>                      Summarize TLDRs and markers
  graph [--json] <file...>                    Emit relation edges as JSON
  find <file> [--marker <m>] [--tag <t>]      Filter waymarks by markers/tags/mentions
       [--mention <handle>]
  lint <file...> [--json]                     Validate markers against config
  migrate <file> [--write|-w]                 Convert legacy TODO/FIXME comments
  tui                                         Placeholder for TUI mode (coming soon)
  help                                        Show this message

Global options:
  --config <path>                             Load additional config (JSON)
  --scope <project|global|default>            Select config scope (default behaviour scans project/global)
`;

type CliResult = {
  exitCode: number;
};

type CommandHandler = (
  args: string[],
  context: CommandContext
) => Promise<number>;

if (import.meta.main) {
  runCli(process.argv.slice(2)).then(({ exitCode }) => {
    process.exit(exitCode);
  });
}

const commandHandlers: Record<string, CommandHandler> = {
  fmt: async (args, context) => {
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
  },
  scan: async (args) => {
    const { filePaths, format } = parseScanArgs(args);
    const records = await scanRecords(filePaths);
    const rendered = renderRecords(records, format ?? "text");
    if (rendered.length > 0) {
      writeStdout(rendered);
    }
    return 0;
  },
  map: async (args, _context) => {
    const { filePaths, json } = parseMapArgs(args);
    const map = await mapFiles(filePaths);
    if (json) {
      writeStdout(JSON.stringify(serializeMap(map)));
    } else {
      printMap(map);
    }
    return 0;
  },
  graph: async (args, _context) => {
    const { filePaths, json } = parseGraphArgs(args);
    const edges = await graphRecords(filePaths);
    if (json) {
      writeStdout(JSON.stringify(edges));
    } else {
      for (const edge of edges) {
        writeStdout(JSON.stringify(edge));
      }
    }
    return 0;
  },
  find: async (args) => {
    const options = parseFindArgs(args);
    const records = await findRecords(options);
    const rendered = renderRecords(records, options.json ? "json" : "text");
    if (rendered.length > 0) {
      writeStdout(rendered);
    }
    return 0;
  },
  lint: async (args, context) => {
    const options = parseLintArgs(args);
    const report = await runLint(
      options.filePaths,
      context.config.allowMarkers
    );
    if (options.json) {
      writeStdout(JSON.stringify(report));
    } else {
      for (const issue of report.issues) {
        writeStderr(
          `${issue.file}:${issue.line} invalid marker "${issue.marker}"`
        );
      }
      if (report.issues.length === 0) {
        writeStdout("lint: no issues found");
      }
    }
    return report.issues.length > 0 ? 1 : 0;
  },
  migrate: async (args, context) => {
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
  tui: () => Promise.resolve(displayTuiMessage()),
  help: () => Promise.resolve(renderHelp(usage)),
  "--help": () => Promise.resolve(renderHelp(usage)),
  "-h": () => Promise.resolve(renderHelp(usage)),
};

export async function runCli(argv: string[]): Promise<CliResult> {
  const { globalOptions, rest } = parseGlobalOptions(argv);
  const [command, ...commandArgs] = rest;

  if (!command) {
    writeStderr(usage.trim());
    return { exitCode: 1 };
  }

  const handler = commandHandlers[command];
  if (!handler) {
    writeStderr(`Unknown command: ${command}`);
    writeStderr(usage.trim());
    return { exitCode: 1 };
  }

  try {
    const context = await createContext(globalOptions);
    const exitCode = await handler(commandArgs, context);
    return { exitCode };
  } catch (error) {
    writeStderr(error instanceof Error ? error.message : String(error));
    return { exitCode: 1 };
  }
}

async function createContext(
  globalOptions: GlobalOptions
): Promise<CommandContext> {
  const { configPath, scope } = globalOptions;
  const loadOptions = {
    scope: scope ?? "default",
    cwd: process.cwd(),
    env: process.env,
    ...(configPath ? { explicitPath: configPath } : {}),
  } as const;

  const config = await loadConfigFromDisk(loadOptions);
  return { config, globalOptions };
}

function parseGlobalOptions(argv: string[]): {
  globalOptions: GlobalOptions;
  rest: string[];
} {
  const globalOptions: GlobalOptions = {};
  const rest: string[] = [];

  const iterator = argv[Symbol.iterator]();
  for (
    let current = iterator.next();
    !current.done;
    current = iterator.next()
  ) {
    const arg = current.value;
    if (consumeConfigOption(globalOptions, iterator, arg)) {
      continue;
    }

    if (consumeScopeOption(globalOptions, iterator, arg)) {
      continue;
    }

    rest.push(arg);
  }

  return { globalOptions, rest };
}

function consumeConfigOption(
  globalOptions: GlobalOptions,
  iterator: IterableIterator<string>,
  arg: string
): boolean {
  if (arg === "--config") {
    const next = iterator.next();
    if (!next.done && next.value) {
      globalOptions.configPath = next.value;
    }
    return true;
  }

  if (arg.startsWith("--config=")) {
    const value = arg.split("=", 2)[1];
    if (value) {
      globalOptions.configPath = value;
    }
    return true;
  }

  return false;
}

function consumeScopeOption(
  globalOptions: GlobalOptions,
  iterator: IterableIterator<string>,
  arg: string
): boolean {
  if (arg === "--scope") {
    const next = iterator.next();
    if (!next.done && next.value) {
      globalOptions.scope = normalizeScope(next.value);
    }
    return true;
  }

  if (arg.startsWith("--scope=")) {
    const value = arg.split("=", 2)[1];
    if (value) {
      globalOptions.scope = normalizeScope(value);
    }
    return true;
  }

  return false;
}

function normalizeScope(value: string): CliScopeOption {
  if (value === "default" || value === "project" || value === "global") {
    return value;
  }
  throw new Error(
    `Invalid scope "${value}". Use one of: default, project, global.`
  );
}

function printMap(map: WaymarkMap): void {
  const lines: string[] = [];
  for (const [file, summary] of map.files.entries()) {
    lines.push(file);
    if (summary.tldr) {
      lines.push(`  tldr: ${summary.tldr.contentText}`);
    }
    for (const [marker, details] of summary.markers.entries()) {
      lines.push(`  ${marker}: ${details.entries.length}`);
    }
    lines.push("");
  }
  if (lines.length > 0) {
    writeStdout(lines.join("\n"));
  }
}

export function serializeMap(map: WaymarkMap): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [file, summary] of map.files.entries()) {
    result[file] = {
      tldr: summary.tldr?.contentText,
      markers: Object.fromEntries(
        Array.from(summary.markers.entries()).map(([marker, details]) => [
          marker,
          details.entries.length,
        ])
      ),
    };
  }
  return result;
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
