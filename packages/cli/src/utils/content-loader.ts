// tldr ::: convention-based loader for agent-facing prompt content files

import addPrompt from "../commands/add.prompt.ts";
import formatPrompt from "../commands/format.prompt.ts";
import lintPrompt from "../commands/lint.prompt.ts";
import modifyPrompt from "../commands/modify.prompt.ts";
import removePrompt from "../commands/remove.prompt.ts";
import unifiedPrompt from "../commands/unified/index.prompt.ts";

const promptRegistry: Record<string, string> = {
  unified: unifiedPrompt,
  format: formatPrompt,
  add: addPrompt,
  insert: addPrompt, // deprecated alias
  modify: modifyPrompt,
  lint: lintPrompt,
  remove: removePrompt,
};

/**
 * Loads agent-facing prompt content for a command using registry lookup.
 */
export function loadPrompt(commandName: string): string | null {
  return promptRegistry[commandName] || null;
}
