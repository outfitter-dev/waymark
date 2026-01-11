// tldr ::: global option parsing utilities for waymark CLI

import type { CliScopeOption, GlobalOptions } from "../types.ts";

/**
 * Parse global CLI options and return remaining args.
 * @param argv - Raw CLI arguments.
 * @returns Parsed global options and the rest of args.
 */
export function parseGlobalOptions(argv: string[]): {
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

    if (consumeLogLevelOption(globalOptions, arg)) {
      continue;
    }

    rest.push(arg);
  }

  return { globalOptions, rest };
}

/**
 * Consume the --config option from the argument stream.
 * @param globalOptions - Options object to mutate.
 * @param iterator - Iterator over CLI args.
 * @param arg - Current argument token.
 * @returns Whether the token was consumed.
 */
export function consumeConfigOption(
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

/**
 * Consume the --scope option from the argument stream.
 * @param globalOptions - Options object to mutate.
 * @param iterator - Iterator over CLI args.
 * @param arg - Current argument token.
 * @returns Whether the token was consumed.
 */
export function consumeScopeOption(
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

/**
 * Normalize a scope string into a valid scope value.
 * @param value - Scope string from CLI.
 * @returns Normalized scope option.
 */
export function normalizeScope(value: string): CliScopeOption {
  if (value === "default" || value === "project" || value === "user") {
    return value;
  }
  throw new Error(
    `Invalid scope "${value}". Use one of: default, project, user.`
  );
}

/**
 * Consume log level flags from the argument stream.
 * @param globalOptions - Options object to mutate.
 * @param arg - Current argument token.
 * @returns Whether the token was consumed.
 */
export function consumeLogLevelOption(
  globalOptions: GlobalOptions,
  arg: string
): boolean {
  if (arg === "--verbose" || arg === "-v") {
    globalOptions.logLevel = "info";
    return true;
  }

  if (arg === "--debug" || arg === "-d") {
    globalOptions.logLevel = "debug";
    return true;
  }

  if (arg === "--quiet" || arg === "-q") {
    globalOptions.logLevel = "error";
    return true;
  }

  return false;
}
