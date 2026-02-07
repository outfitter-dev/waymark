// tldr ::: config loading helpers for MCP server

import { resolve } from "node:path";
import type { Result } from "@outfitter/contracts";
import type { ConfigScope, WaymarkConfig } from "@waymarks/core";
import { loadConfigFromDisk } from "@waymarks/core";

/**
 * Load MCP configuration based on scope and optional explicit path.
 * Returns a Result wrapping the resolved configuration or a typed error.
 *
 * @param options - Scope and optional config path.
 * @returns Result containing resolved configuration or an error.
 */
export function loadConfig(options: {
  scope: ConfigScope;
  configPath?: string;
}): Promise<Result<WaymarkConfig, unknown>> {
  const loadOptions = {
    cwd: process.cwd(),
    env: process.env,
    scope: options.scope,
    ...(options.configPath
      ? { explicitPath: resolve(process.cwd(), options.configPath) }
      : {}),
  };

  return loadConfigFromDisk(loadOptions);
}

/**
 * Clamp a numeric value between min and max.
 * @param value - Value to clamp.
 * @param min - Minimum allowed value.
 * @param max - Maximum allowed value.
 * @returns Clamped value.
 */
export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

const NEWLINE_SPLIT_REGEX = /\r?\n/u;

/**
 * Truncate source text to a maximum number of lines.
 * @param source - Source text to truncate.
 * @param maxLines - Maximum number of lines to keep.
 * @returns Truncated text with an ellipsis line when truncated.
 */
export function truncateSource(source: string, maxLines: number): string {
  const lines = source.split(NEWLINE_SPLIT_REGEX);
  if (lines.length <= maxLines) {
    return source;
  }
  const newline = source.includes("\r\n") ? "\r\n" : "\n";
  return `${lines.slice(0, maxLines).join(newline)}${newline}...`;
}
