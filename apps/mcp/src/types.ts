// tldr ::: shared types and schemas for MCP server

import { z } from "zod";

export const configOptionsSchema = z.object({
  configPath: z.string().optional(),
  scope: z.enum(["default", "project", "user"]).optional(),
});

export const scanInputSchema = configOptionsSchema.extend({
  paths: z.array(z.string().min(1)).nonempty().default(["."]),
  format: z.enum(["text", "json", "jsonl", "pretty"]).default("json"),
});

export const graphInputSchema = configOptionsSchema.extend({
  paths: z.array(z.string().min(1)).nonempty().default(["."]),
});

export const addWaymarkInputSchema = configOptionsSchema.extend({
  filePath: z.string().min(1),
  type: z.string().min(1),
  content: z.string().min(1),
  id: z.string().min(1).optional(),
  line: z.number().int().positive().optional(),
  signals: z
    .object({
      flagged: z.boolean().optional(),
      starred: z.boolean().optional(),
    })
    .optional(),
});

export const helpInputSchema = configOptionsSchema.extend({
  topic: z.string().min(1).optional(),
});

export const WAYMARK_ACTIONS = ["scan", "graph", "add", "help"] as const;
export const waymarkActionSchema = z.enum(WAYMARK_ACTIONS);

export const waymarkToolInputSchema = z.discriminatedUnion("action", [
  scanInputSchema.extend({ action: z.literal("scan") }),
  graphInputSchema.extend({ action: z.literal("graph") }),
  addWaymarkInputSchema.extend({ action: z.literal("add") }),
  helpInputSchema.extend({ action: z.literal("help") }),
]);

export type ScanInput = z.infer<typeof scanInputSchema>;
export type HelpInput = z.infer<typeof helpInputSchema>;
export type WaymarkToolInput = z.infer<typeof waymarkToolInputSchema>;
export type RenderFormat = ScanInput["format"];

/** Optional signal flags supported by the MCP add tool. */
export type SignalFlags = {
  flagged?: boolean | undefined;
  starred?: boolean | undefined;
};

export type CommentStyle = {
  leader: string;
  closing?: string;
};

export const TODOS_RESOURCE_URI = "waymark://todos";

/** MCP tool response shape compatible with the SDK's CallToolResult. */
export type ToolContent = {
  content: Array<{ type: string; text: string; mimeType?: string }>;
};
