// tldr ::: CLI error helpers for consistent exit codes [[cli/errors]]

import { ExitCode } from "./exit-codes.ts";

export class CliError extends Error {
  exitCode: ExitCode;

  constructor(message: string, exitCode: ExitCode) {
    super(message);
    this.name = "CliError";
    this.exitCode = exitCode;
  }
}

/**
 * Create a CLI error with a usage exit code.
 * @param message - Error message to display.
 * @returns CLI error instance.
 */
export function createUsageError(message: string): CliError {
  return new CliError(message, ExitCode.usageError);
}

/**
 * Create a CLI error with a config exit code.
 * @param message - Error message to display.
 * @returns CLI error instance.
 */
export function createConfigError(message: string): CliError {
  return new CliError(message, ExitCode.configError);
}
