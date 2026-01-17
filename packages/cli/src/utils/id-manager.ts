// tldr ::: helpers for wiring the Waymark ID manager inside CLI commands

import { JsonIdIndex, WaymarkIdManager } from "@waymarks/core";

import type { CommandContext } from "../types.ts";
import { confirm } from "./prompts.ts";

export type CreateIdManagerOptions = {
  interactive?: boolean;
};

/**
 * Create a WaymarkIdManager configured for the current CLI context.
 * @param context - CLI context with config and workspace root.
 * @param options - Options controlling interactive behavior.
 * @returns ID manager instance or undefined when disabled.
 */
export async function createIdManager(
  context: CommandContext,
  options: CreateIdManagerOptions = {}
): Promise<WaymarkIdManager | undefined> {
  const { config, workspaceRoot } = context;
  const interactive = options.interactive ?? process.stdout.isTTY;

  const idConfig = { ...config.ids };

  if (idConfig.mode === "off") {
    return;
  }

  if (idConfig.mode === "prompt") {
    if (interactive) {
      const shouldGenerate = await confirm({
        message: "Auto-generate IDs for inserted waymarks?",
        default: true,
      });
      idConfig.mode = shouldGenerate ? "auto" : "manual";
    } else {
      // Emit structured warning to stderr without cluttering stdout
      const warning = {
        level: "warn",
        msg: "ID mode 'prompt' requires interactive terminal; using 'manual'",
      };
      process.stderr.write(`${JSON.stringify(warning)}\n`);
      idConfig.mode = "manual";
    }
  }

  const index = new JsonIdIndex({
    workspaceRoot,
    trackHistory: idConfig.trackHistory,
  });

  return new WaymarkIdManager(idConfig, index);
}
