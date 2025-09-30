// tldr ::: todo prompt handler for waymark MCP server

import { z } from "zod";

export function handleTodoPrompt({
  summary,
  filePath,
  context,
}: {
  summary: string;
  filePath?: string | undefined;
  context?: string | undefined;
}) {
  const lines: string[] = [
    "Write a TODO waymark content line (no marker) that captures the essential follow-up work.",
    "Keep it short, actionable, and mention owners or references if provided.",
    `Summary: ${summary}`,
  ];
  if (filePath) {
    lines.push(`File path: ${filePath}`);
  }
  if (context) {
    lines.push(`Context:\n${context}`);
  }

  return {
    messages: [
      {
        role: "user" as const,
        content: {
          type: "text" as const,
          text: lines.join("\n"),
        },
      },
    ],
  };
}

export const todoPromptDefinition = {
  title: "Draft TODO Waymark",
  description: "Produce a focused TODO entry for follow-up work",
  argsSchema: {
    summary: z.string().min(1),
    filePath: z.string().optional(),
    context: z.string().optional(),
  },
};
