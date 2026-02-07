// tldr ::: centralized Result-to-exit-code mapping for CLI command handlers

import type { AnyKitError, ErrorCategory } from "@outfitter/contracts";
import { CliError } from "../errors.ts";
import { ExitCode } from "../exit-codes.ts";

/** Map an @outfitter/contracts error category to a CLI exit code. */
export function mapErrorToExitCode(category: ErrorCategory): ExitCode {
  switch (category) {
    case "validation":
    case "not_found":
    case "conflict":
      return ExitCode.failure;
    case "internal":
      return ExitCode.failure;
    case "cancelled":
      return ExitCode.success;
    default:
      return ExitCode.failure;
  }
}

/**
 * Unwrap a Result, throwing a CliError on failure.
 * Use in program.ts handlers to bridge Result -> exit code flow.
 */
export async function runCommand<T>(
  fn: () => Promise<import("@outfitter/contracts").Result<T, AnyKitError>>
): Promise<T> {
  const result = await fn();
  if (result.isErr()) {
    const exitCode = mapErrorToExitCode(result.error.category);
    throw new CliError(result.error.message, exitCode);
  }
  return result.value;
}
