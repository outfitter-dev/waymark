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

export function createUsageError(message: string): CliError {
  return new CliError(message, ExitCode.usageError);
}

export function createConfigError(message: string): CliError {
  return new CliError(message, ExitCode.configError);
}
