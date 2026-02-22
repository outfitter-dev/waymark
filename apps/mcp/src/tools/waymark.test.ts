// tldr ::: tests for waymark MCP tool help action and validation

import { describe, expect, test } from "bun:test";

import type { WaymarkToolInput } from "../types";
import { handleWaymarkTool } from "./waymark";

const noopNotify = () => {
  // no-op for test
};

describe("handleWaymarkTool", () => {
  test("returns help text", async () => {
    const result = await handleWaymarkTool(
      { action: "help" } as WaymarkToolInput,
      noopNotify
    );
    expect(result.isOk()).toBe(true);
    const response = result.isOk() ? result.value : null;
    const text = String(response?.content?.[0]?.text ?? "");
    expect(text).toContain("Waymark MCP Tool");
    expect(text).toContain("scan");
  });

  test("returns topic-specific help", async () => {
    const result = await handleWaymarkTool(
      { action: "help", topic: "scan" } as WaymarkToolInput,
      noopNotify
    );
    expect(result.isOk()).toBe(true);
    const response = result.isOk() ? result.value : null;
    const text = String(response?.content?.[0]?.text ?? "");
    expect(text).toContain("Action: scan");
  });
});
