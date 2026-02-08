// tldr ::: scope normalization for waymark CLI options

import type { CliScopeOption } from "../types.ts";

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
