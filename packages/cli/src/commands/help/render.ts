// tldr ::: help text rendering utilities for CLI commands

import { commands, mainCommand } from "./registry.ts";
import type { CommandConfig, FlagConfig } from "./types.ts";

/**
 * Render a single flag with proper alignment
 */
function renderFlag(flag: FlagConfig): string {
  const nameWithAlias = flag.alias
    ? `--${flag.name}, -${flag.alias}`
    : `--${flag.name}`;

  const placeholder = flag.placeholder ? ` <${flag.placeholder}>` : "";
  // biome-ignore lint/style/noMagicNumbers: formatting constant
  const fullFlag = `${nameWithAlias}${placeholder}`.padEnd(35);

  return `  ${fullFlag} ${flag.description}`;
}

/**
 * Render command-specific help
 */
export function renderCommandHelp(config: CommandConfig): string {
  const sections: string[] = [];

  // Usage
  sections.push(config.usage);
  sections.push("");

  // Description
  sections.push(config.description);

  // Flags (if any)
  if (config.flags && config.flags.length > 0) {
    sections.push("");
    sections.push("Options:");
    for (const flag of config.flags) {
      sections.push(renderFlag(flag));
    }
  }

  // Examples (if any)
  if (config.examples && config.examples.length > 0) {
    sections.push("");
    sections.push("Examples:");
    for (const example of config.examples) {
      sections.push(`  ${example}`);
    }
  }

  return sections.join("\n");
}

/**
 * Render global help (main command overview + command list)
 */
export function renderGlobalHelp(): string {
  const sections: string[] = [];

  // Main usage
  sections.push(mainCommand.usage);
  sections.push("");
  sections.push(mainCommand.description);

  // Quick examples
  sections.push("");
  sections.push("Quick examples:");
  // biome-ignore lint/style/noMagicNumbers: formatting constant for examples
  const quickExamples = mainCommand.examples?.slice(0, 5) ?? [];
  for (const example of quickExamples) {
    sections.push(`  ${example}`);
  }

  // Commands section
  sections.push("");
  sections.push("Commands:");
  for (const [_key, cmd] of Object.entries(commands)) {
    // biome-ignore lint/style/noMagicNumbers: formatting constant
    const usage = cmd.usage.padEnd(40);
    const desc = cmd.description.split("\n")[0]; // First line only
    sections.push(`  ${usage} ${desc}`);
  }

  // Filter options
  sections.push("");
  sections.push("Filter options:");
  const filterFlags = mainCommand.flags?.filter((f) =>
    ["type", "tag", "mention", "flagged", "starred"].includes(f.name)
  );
  for (const flag of filterFlags ?? []) {
    sections.push(renderFlag(flag));
  }

  // Output options
  sections.push("");
  sections.push("Output options:");
  const outputFlags = mainCommand.flags?.filter((f) =>
    ["json", "jsonl", "pretty", "map", "graph", "summary"].includes(f.name)
  );
  for (const flag of outputFlags ?? []) {
    sections.push(renderFlag(flag));
  }

  // Global options
  sections.push("");
  sections.push("Global options:");
  const globalFlags = mainCommand.flags?.filter((f) =>
    ["help", "version", "config", "scope"].includes(f.name)
  );
  for (const flag of globalFlags ?? []) {
    sections.push(renderFlag(flag));
  }

  // Footer
  sections.push("");
  sections.push("Run 'wm help <command|topic>' for detailed help.");

  return sections.join("\n");
}

/**
 * Get help text for a command or global help
 */
export function getHelp(commandName?: string): string {
  if (!commandName) {
    return renderGlobalHelp();
  }

  // Check if it's a known command
  const config = commands[commandName];
  if (config) {
    return renderCommandHelp(config);
  }

  // Check if it's the main command
  if (commandName === "wm" || commandName === "waymark") {
    return renderGlobalHelp();
  }

  // Unknown command
  return `Unknown command: ${commandName}\n\n${renderGlobalHelp()}`;
}
