// tldr ::: shared types and schemas for MCP server

import type { ConfigScope } from "@waymarks/core";
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

export const waymarkToolInputShape = {
  action: waymarkActionSchema,
  configPath: configOptionsSchema.shape.configPath,
  scope: configOptionsSchema.shape.scope,
  paths: scanInputSchema.shape.paths.optional(),
  format: scanInputSchema.shape.format.optional(),
  filePath: addWaymarkInputSchema.shape.filePath.optional(),
  type: addWaymarkInputSchema.shape.type.optional(),
  content: addWaymarkInputSchema.shape.content.optional(),
  id: addWaymarkInputSchema.shape.id.optional(),
  line: addWaymarkInputSchema.shape.line.optional(),
  signals: addWaymarkInputSchema.shape.signals.optional(),
  topic: helpInputSchema.shape.topic.optional(),
};

export type ScanInput = z.infer<typeof scanInputSchema>;
export type HelpInput = z.infer<typeof helpInputSchema>;
export type WaymarkToolInput = z.infer<typeof waymarkToolInputSchema>;
export type RenderFormat = ScanInput["format"];

export type SignalFlags = {
  flagged?: boolean | undefined;
  starred?: boolean | undefined;
};

export type CommentStyle = {
  leader: string;
  closing?: string;
};

export type ExpandedConfig = {
  cwd: string;
  env: NodeJS.ProcessEnv;
  scope: ConfigScope;
  explicitPath?: string;
};

export const TODOS_RESOURCE_URI = "waymark://todos";
