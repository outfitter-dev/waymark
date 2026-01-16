// tldr ::: help system exports for waymark CLI

// biome-ignore lint/performance/noBarrelFile: module API exports used by help command
export { commands, mainCommand } from "./registry.ts";
export { getHelp, renderCommandHelp, renderGlobalHelp } from "./render.ts";
export {
  getTopicHelp,
  type HelpTopic,
  helpTopicNames,
  helpTopics,
} from "./topics/index.ts";
export type { CommandConfig, FlagConfig, HelpRegistry } from "./types.ts";

import { getHelp } from "./render.ts";

/**
 * Display help text to stdout.
 * @param commandName - Optional command name to scope output.
 * @returns Exit code to use for the CLI.
 */
export function displayHelp(commandName?: string): number {
  const helpText = getHelp(commandName);
  process.stdout.write(`${helpText}\n`);
  return 0;
}
