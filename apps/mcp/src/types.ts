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

export const mapInputSchema = graphInputSchema;

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

// Deprecated alias for backward compatibility
export const insertWaymarkInputSchema = addWaymarkInputSchema;

export type ScanInput = z.infer<typeof scanInputSchema>;
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

export const MAP_RESOURCE_URI = "waymark://map";
export const TODOS_RESOURCE_URI = "waymark://todos";
export const DEFAULT_TLDR_PROMPT_LINES = 200;
export const MAX_TLDR_PROMPT_LINES = 2000;
