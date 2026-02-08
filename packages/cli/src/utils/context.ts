// tldr ::: context creation helpers for waymark CLI commands

import type { WaymarkConfig } from "@waymarks/core";
import { loadConfigFromDisk } from "@waymarks/core";
import { createConfigError } from "../errors.ts";
import type { CommandContext, GlobalOptions } from "../types.ts";
import { resolveWorkspaceRoot } from "./workspace.ts";

/**
 * Create a command context by loading config and workspace info.
 * @param globalOptions - Parsed global CLI options.
 * @returns Command context with config and workspace root.
 */
export async function createContext(
  globalOptions: GlobalOptions
): Promise<CommandContext> {
  const { configPath, scope } = globalOptions;
  const loadOptions = {
    scope: scope ?? "default",
    cwd: process.cwd(),
    env: process.env,
    ...(configPath ? { explicitPath: configPath } : {}),
  } as const;

  const result = await loadConfigFromDisk(loadOptions);

  if (result.isErr()) {
    throw createConfigError(result.error.message);
  }

  let config: WaymarkConfig = result.value;

  // Merge CLI-level scan overrides into config
  if (globalOptions.includeIgnored) {
    config = {
      ...config,
      scan: { ...config.scan, includeIgnored: true },
    };
  }

  const workspaceRoot = resolveWorkspaceRoot(loadOptions.cwd);

  return { config, globalOptions, workspaceRoot };
}
