// tldr ::: shared CLI types

import type { WaymarkConfig } from "@waymarks/core";

export type CliScopeOption = "default" | "project" | "global";

export type GlobalOptions = {
  configPath?: string;
  scope?: CliScopeOption;
};

export type CommandContext = {
  config: WaymarkConfig;
  globalOptions: GlobalOptions;
};
