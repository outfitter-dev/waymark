// tldr ::: shared CLI types

import type { WaymarkConfig } from "@waymarks/core";
import type { LogLevel } from "./utils/logger.ts";

export type CliScopeOption = "default" | "project" | "user";

export type GlobalOptions = {
  configPath?: string;
  scope?: CliScopeOption;
  logLevel?: LogLevel;
  cache?: boolean;
  includeIgnored?: boolean;
};

export type CommandContext = {
  config: WaymarkConfig;
  globalOptions: GlobalOptions;
  workspaceRoot: string;
};

export type ModifyCliOptions = {
  id?: string;
  type?: string;
  content?: string;
  flagged?: boolean;
  starred?: boolean;
  clearSignals?: boolean;
  write?: boolean;
  json?: boolean;
  jsonl?: boolean;
  interactive?: boolean;
};
