// tldr ::: tldr prompt handler for waymark MCP server

import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { z } from "zod";
import { DEFAULT_TLDR_PROMPT_LINES, MAX_TLDR_PROMPT_LINES } from "../types";
import { clamp, truncateSource } from "../utils/config";
import { normalizePathForOutput } from "../utils/filesystem";

export async function handleTldrPrompt({
  filePath,
  maxLines,
}: {
  filePath: string;
  maxLines?: string | undefined;
}) {
  const absolutePath = resolve(process.cwd(), filePath);
  const source = await readFile(absolutePath, "utf8").catch(() => "");
  const limit = maxLines ? Number.parseInt(maxLines, 10) : undefined;
  const boundedLimit = Number.isFinite(limit)
    ? clamp(Number(limit), 1, MAX_TLDR_PROMPT_LINES)
    : DEFAULT_TLDR_PROMPT_LINES;
  const snippet = truncateSource(source, boundedLimit);
  return {
    messages: [
      {
        role: "user" as const,
        content: {
          type: "text" as const,
          text: [
            "Write a single-sentence TLDR waymark that summarizes the file.",
            "Use active voice, cite the primary capability, and end with key technologies or domains.",
            `File path: ${normalizePathForOutput(absolutePath)}`,
            "",
            "File snippet:",
            snippet,
          ].join("\n"),
        },
      },
    ],
  };
}

export const tldrPromptDefinition = {
  title: "Draft TLDR Waymark",
  description: "Generate a concise TLDR comment for a file",
  argsSchema: {
    filePath: z.string().min(1),
    maxLines: z.string().optional(),
  },
};
