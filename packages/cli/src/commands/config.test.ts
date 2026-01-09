// tldr ::: tests for config command output [[cli/config-test]]

import { describe, expect, test } from "bun:test";
import { resolveConfig, type WaymarkConfig } from "@waymarks/core";
import type { CommandContext } from "../types.ts";
import { runConfigCommand } from "./config.ts";

const context: CommandContext = {
  config: resolveConfig(),
  globalOptions: {},
  workspaceRoot: process.cwd(),
};

describe("config command", () => {
  test("prints merged configuration when --print is set", async () => {
    const result = await runConfigCommand(context, { print: true });

    expect(result.exitCode).toBe(0);
    const parsed = JSON.parse(result.output) as WaymarkConfig;
    expect(parsed).toEqual(context.config);
  });

  test("prints compact JSON when --json is set", async () => {
    const result = await runConfigCommand(context, { print: true, json: true });
    expect(result.output.includes("\n")).toBe(false);
  });

  test("requires --print flag", async () => {
    await expect(runConfigCommand(context)).rejects.toThrow(
      "Config command requires --print."
    );
  });
});
