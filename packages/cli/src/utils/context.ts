// tldr ::: context creation helpers for waymark CLI commands

import { loadConfigFromDisk } from "@waymarks/core";
import { createConfigError } from "../errors.ts";
import type { CommandContext, GlobalOptions } from "../types.ts";
import { resolveWorkspaceRoot } from "./workspace.ts";

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

  let config: Awaited<ReturnType<typeof loadConfigFromDisk>>;
  try {
    config = await loadConfigFromDisk(loadOptions);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw createConfigError(message);
  }
  const workspaceRoot = resolveWorkspaceRoot(loadOptions.cwd);

  return { config, globalOptions, workspaceRoot };
}
