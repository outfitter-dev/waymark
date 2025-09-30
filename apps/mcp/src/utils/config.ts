// tldr ::: config loading helpers for MCP server

import { resolve } from "node:path";
import type { ConfigScope } from "@waymarks/core";
import { loadConfigFromDisk } from "@waymarks/core";
import type { ExpandedConfig } from "../types";

export function loadConfig(options: {
  scope: ConfigScope;
  configPath?: string;
}): Promise<Awaited<ReturnType<typeof loadConfigFromDisk>>> {
  const loadOptions: ExpandedConfig = {
    cwd: process.cwd(),
    env: process.env,
    scope: options.scope,
    ...(options.configPath
      ? { explicitPath: resolve(process.cwd(), options.configPath) }
      : {}),
  };

  return loadConfigFromDisk(loadOptions);
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

const NEWLINE_SPLIT_REGEX = /\r?\n/u;

export function truncateSource(source: string, maxLines: number): string {
  const lines = source.split(NEWLINE_SPLIT_REGEX);
  if (lines.length <= maxLines) {
    return source;
  }
  return `${lines.slice(0, maxLines).join("\n")}\n...`;
}
