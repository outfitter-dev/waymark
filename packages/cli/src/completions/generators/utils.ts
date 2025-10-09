// tldr ::: shared utilities for completion generators

import { MARKER_DEFINITIONS } from "@waymarks/grammar";

/**
 * Extract all types including aliases from grammar definitions
 */
export function getAllTypes(): readonly string[] {
  return MARKER_DEFINITIONS.flatMap((def) => [
    def.name,
    ...(def.aliases || []),
  ]);
}

/**
 * Format types as space-separated string
 */
export function getTypesString(types: readonly string[]): string {
  return types.join(" ");
}

/**
 * Common commands available in the CLI
 */
export const COMMANDS = [
  "format",
  "insert",
  "modify",
  "remove",
  "lint",
  "migrate",
  "init",
  "update",
  "help",
] as const;

/**
 * Config scopes
 */
export const CONFIG_SCOPES = ["default", "project", "user"] as const;

/**
 * Group by options
 */
export const GROUP_BY_OPTIONS = ["file", "dir", "type"] as const;

/**
 * Sort by options
 */
export const SORT_BY_OPTIONS = ["file", "line", "type", "modified"] as const;

/**
 * Signal options
 */
export const SIGNAL_OPTIONS = ["^", "*"] as const;

/**
 * Config format options
 */
export const FORMAT_OPTIONS = ["toml", "jsonc", "yaml", "yml"] as const;

/**
 * Config preset options
 */
export const PRESET_OPTIONS = ["full", "minimal"] as const;

/**
 * Init scope options
 */
export const INIT_SCOPE_OPTIONS = ["project", "user"] as const;
