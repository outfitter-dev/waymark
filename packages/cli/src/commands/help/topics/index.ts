// tldr ::: topic-based help text for wm help <topic>

import signals from "./signals.txt";
import syntax from "./syntax.txt";
import tags from "./tags.txt";
import tldr from "./tldr.txt";
import todo from "./todo.txt";

export const helpTopics = {
  syntax,
  tldr,
  todo,
  signals,
  tags,
} as const;

export type HelpTopic = keyof typeof helpTopics;

export const helpTopicNames = Object.keys(helpTopics) as HelpTopic[];

export function getTopicHelp(name: string): string | null {
  const normalized = name.trim().toLowerCase();
  if (!normalized) {
    return null;
  }
  return helpTopics[normalized as HelpTopic] ?? null;
}
