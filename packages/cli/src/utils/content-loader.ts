// tldr ::: convention-based loader for help and prompt content files

import formatHelp from "../commands/format.help.ts";
import formatPrompt from "../commands/format.prompt.ts";
import lintHelp from "../commands/lint.help.ts";
import lintPrompt from "../commands/lint.prompt.ts";
import migrateHelp from "../commands/migrate.help.ts";
import migratePrompt from "../commands/migrate.prompt.ts";
import unifiedHelp from "../commands/unified/index.help.ts";
import unifiedPrompt from "../commands/unified/index.prompt.ts";

const helpRegistry: Record<string, string> = {
  unified: unifiedHelp,
  format: formatHelp,
  lint: lintHelp,
  migrate: migrateHelp,
};

const promptRegistry: Record<string, string> = {
  unified: unifiedPrompt,
  format: formatPrompt,
  lint: lintPrompt,
  migrate: migratePrompt,
};

/**
 * Loads help content for a command using registry lookup.
 */
export function loadHelp(commandName: string): string | null {
  return helpRegistry[commandName] || null;
}

/**
 * Loads agent-facing prompt content for a command using registry lookup.
 */
export function loadPrompt(commandName: string): string | null {
  return promptRegistry[commandName] || null;
}
