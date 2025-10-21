// tldr ::: help system exports for waymark CLI

// biome-ignore lint/performance/noBarrelFile: module API exports used by help command
export { commands, mainCommand } from "./registry.ts";
export { getHelp, renderCommandHelp, renderGlobalHelp } from "./render.ts";
export type { CommandConfig, FlagConfig, HelpRegistry } from "./types.ts";

import { getHelp } from "./render.ts";

/**
 * Display help and exit
 */
export function displayHelp(commandName?: string): number {
  const helpText = getHelp(commandName);
  process.stdout.write(`${helpText}\n`);
  return 0;
}
