// tldr ::: help action handler for waymark MCP tool

import type { HelpInput, ToolContent } from "../types";

type HelpActionInput = HelpInput & { action: "help" };

type HelpTopic = {
  title: string;
  body: string;
};

const HELP_TOPICS: Record<string, HelpTopic> = {
  scan: {
    title: "scan",
    body: [
      "Action: scan",
      "Find waymarks in files or directories.",
      "",
      "Inputs:",
      '- paths?: string[] (defaults to ["."])',
      "- format?: text | json | jsonl | pretty (default: json)",
      "- configPath?: string",
      "- scope?: default | project | user",
      "",
      "Example:",
      '{"action":"scan","paths":["src/"]}',
    ].join("\n"),
  },
  graph: {
    title: "graph",
    body: [
      "Action: graph",
      "Build relation edges from waymark references.",
      "",
      "Inputs:",
      '- paths?: string[] (defaults to ["."])',
      "- configPath?: string",
      "- scope?: default | project | user",
      "",
      "Example:",
      '{"action":"graph","paths":["src/"]}',
    ].join("\n"),
  },
  add: {
    title: "add",
    body: [
      "Action: add",
      "Insert a new waymark into a file.",
      "",
      "Inputs:",
      "- filePath: string",
      "- type: string",
      "- content: string",
      "- id?: string (wikilink [[hash]], [[hash|alias]], [[alias]] or bare)",
      "- line?: number",
      "- signals?: { flagged?: boolean; starred?: boolean }",
      "- configPath?: string",
      "- scope?: default | project | user",
      "",
      "Example:",
      '{"action":"add","filePath":"src/app.ts","type":"todo","content":"add retry","id":"auth-refresh"}',
    ].join("\n"),
  },
};

const DEFAULT_HELP = [
  "Waymark MCP Tool",
  "",
  "Single tool with action dispatch.",
  "",
  "Actions:",
  "- scan  (paths?, format?, configPath?, scope?)",
  "- graph (paths?, configPath?, scope?)",
  "- add   (filePath, type, content, id?, line?, signals?)",
  "- help  (topic?)",
  "",
  "Defaults:",
  '- scan/graph paths default to ["."]',
  "- scan format defaults to json",
  "- scope defaults to default",
  "",
  "Examples:",
  '{"action":"scan"}',
  '{"action":"graph","paths":["src/"]}',
  '{"action":"add","filePath":"src/app.ts","type":"todo","content":"add retry","id":"auth-refresh"}',
  '{"action":"help","topic":"scan"}',
].join("\n");

/**
 * Handle the help action for the MCP tool.
 * @param input - Help action input payload.
 * @returns MCP tool result with help text.
 */
export function handleHelp(input: HelpActionInput): ToolContent {
  const topic = input.topic?.trim().toLowerCase();
  const selected = topic ? HELP_TOPICS[topic] : undefined;
  const text = selected ? selected.body : DEFAULT_HELP;

  return {
    content: [
      {
        type: "text",
        mimeType: "text/plain",
        text,
      },
    ],
  };
}
