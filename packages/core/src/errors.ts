// tldr ::: shared error types and exit code mapping for waymark domain operations

// biome-ignore lint/performance/noBarrelFile: Intentional re-export of contracts for convenience
export {
  AmbiguousError,
  type AnyKitError,
  AssertionError,
  CancelledError,
  ConflictError,
  type ErrorCategory,
  expect,
  getExitCode,
  InternalError,
  NotFoundError,
  type OutfitterError,
  Result,
  ValidationError,
} from "@outfitter/contracts";

/**
 * Waymark-specific exit codes aligned with PRD conventions:
 * - 0: success / no findings
 * - 1: lint/parse errors found
 * - 2: internal/tooling error
 * - 130: user cancelled (Ctrl+C)
 */
export const WAYMARK_EXIT_CODES = {
  success: 0,
  validation: 1,
  notFound: 1,
  conflict: 1,
  internal: 2,
  cancelled: 130,
} as const;

/** Map an error category to a Waymark-specific exit code. */
export function getWaymarkExitCode(
  category: keyof typeof WAYMARK_EXIT_CODES
): number {
  return WAYMARK_EXIT_CODES[category] ?? WAYMARK_EXIT_CODES.internal;
}

/** Narrow Result error types commonly used across Waymark operations. */
export type WaymarkError =
  | import("@outfitter/contracts").ValidationError
  | import("@outfitter/contracts").NotFoundError
  | import("@outfitter/contracts").ConflictError
  | import("@outfitter/contracts").InternalError
  | import("@outfitter/contracts").CancelledError
  | import("@outfitter/contracts").AmbiguousError;

/** Convenience alias for a Result with a Waymark domain error. */
export type WaymarkResult<T> = import("@outfitter/contracts").Result<
  T,
  WaymarkError
>;
