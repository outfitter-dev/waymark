// tldr ::: context creation helpers for waymark CLI commands

import { loadConfigFromDisk } from "@waymarks/core";
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

  const config = await loadConfigFromDisk(loadOptions);
  const workspaceRoot = resolveWorkspaceRoot(loadOptions.cwd);

  return { config, globalOptions, workspaceRoot };
}
