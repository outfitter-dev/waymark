// tldr ::: shared CLI types

import type { WaymarkConfig } from "@waymarks/core";
import type { LogLevel } from "./utils/logger.ts";

export type CliScopeOption = "default" | "project" | "user";

export type GlobalOptions = {
  configPath?: string;
  scope?: CliScopeOption;
  logLevel?: LogLevel;
};

export type CommandContext = {
  config: WaymarkConfig;
  globalOptions: GlobalOptions;
  workspaceRoot: string;
};
