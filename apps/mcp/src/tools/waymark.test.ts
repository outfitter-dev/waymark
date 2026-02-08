// tldr ::: tests for waymark MCP tool help action and validation

import { describe, expect, test } from "bun:test";

import type { WaymarkToolInput } from "../types";
import { handleWaymarkTool } from "./waymark";

const noopNotify = () => {
  // no-op for test
};

describe("handleWaymarkTool", () => {
  test("returns help text", async () => {
    const response = await handleWaymarkTool(
      { action: "help" } as WaymarkToolInput,
      noopNotify
    );
    const text = String(response.content?.[0]?.text ?? "");
    expect(text).toContain("Waymark MCP Tool");
    expect(text).toContain("scan");
  });

  test("returns topic-specific help", async () => {
    const response = await handleWaymarkTool(
      { action: "help", topic: "scan" } as WaymarkToolInput,
      noopNotify
    );
    const text = String(response.content?.[0]?.text ?? "");
    expect(text).toContain("Action: scan");
  });
});
