// tldr ::: prompt registry for waymark MCP server

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { handleTldrPrompt, tldrPromptDefinition } from "./tldr";
import { handleTodoPrompt, todoPromptDefinition } from "./todo";

export function registerPrompts(server: McpServer): void {
  server.registerPrompt("waymark.tldr", tldrPromptDefinition, handleTldrPrompt);

  server.registerPrompt("waymark.todo", todoPromptDefinition, handleTodoPrompt);
}
