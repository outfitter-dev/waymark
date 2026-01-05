// tldr ::: shared types and schemas for MCP server

import type { ConfigScope } from "@waymarks/core";
import { z } from "zod";

export const configOptionsSchema = z.object({
  configPath: z.string().optional(),
  scope: z.enum(["default", "project", "user"]).optional(),
});

export const scanInputSchema = configOptionsSchema.extend({
  paths: z.array(z.string().min(1)).nonempty(),
  format: z.enum(["text", "json", "jsonl", "pretty"]).default("json"),
});

export const graphInputSchema = configOptionsSchema.extend({
  paths: z.array(z.string().min(1)).nonempty(),
});

export const addWaymarkInputSchema = configOptionsSchema.extend({
  filePath: z.string().min(1),
  type: z.string().min(1),
  content: z.string().min(1),
  line: z.number().int().positive().optional(),
  signals: z
    .object({
      raised: z.boolean().optional(),
      important: z.boolean().optional(),
    })
    .optional(),
});

const waymarkActionSchema = z.enum(["scan", "graph", "add"]);

export const waymarkToolInputSchema = z.discriminatedUnion("action", [
  scanInputSchema.extend({ action: z.literal("scan") }),
  graphInputSchema.extend({ action: z.literal("graph") }),
  addWaymarkInputSchema.extend({ action: z.literal("add") }),
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
  line: addWaymarkInputSchema.shape.line.optional(),
  signals: addWaymarkInputSchema.shape.signals.optional(),
};

export type ScanInput = z.infer<typeof scanInputSchema>;
export type WaymarkToolInput = z.infer<typeof waymarkToolInputSchema>;
export type RenderFormat = ScanInput["format"];

export type SignalFlags = {
  raised?: boolean | undefined;
  important?: boolean | undefined;
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
