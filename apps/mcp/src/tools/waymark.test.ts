// tldr ::: tests for waymark MCP tool help action and validation

import { describe, expect, test } from "bun:test";

import { handleWaymarkTool } from "./waymark";

const VALID_ACTIONS_REGEX = /Valid actions:/u;

class TestServer {
  sendResourceListChanged(): void {
    // no-op
  }
}

describe("handleWaymarkTool", () => {
  test("returns help text", async () => {
    const response = await handleWaymarkTool(
      { action: "help" },
      new TestServer()
    );
    const text = String(response.content?.[0]?.text ?? "");
    expect(text).toContain("Waymark MCP Tool");
    expect(text).toContain("scan");
  });

  test("returns topic-specific help", async () => {
    const response = await handleWaymarkTool(
      { action: "help", topic: "scan" },
      new TestServer()
    );
    const text = String(response.content?.[0]?.text ?? "");
    expect(text).toContain("Action: scan");
  });

  test("rejects unknown action with valid list", async () => {
    await expect(
      handleWaymarkTool({ action: "bogus" }, new TestServer())
    ).rejects.toThrow(VALID_ACTIONS_REGEX);
  });
});
