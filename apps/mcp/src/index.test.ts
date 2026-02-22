// tldr ::: tests for MCP waymark insertion utilities

import { describe, expect, test } from "bun:test";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { handleAddWaymark } from "./tools/add";
import type { SignalFlags } from "./types";
import { truncateSource } from "./utils/config";

function createNotifyTracker() {
  let changes = 0;
  return {
    notify: () => {
      changes += 1;
    },
    get changes() {
      return changes;
    },
  };
}

const ABOUT_INSERT_LINE = 3;
const SAMPLE_SOURCE = ["line 1", "line 2", "line 3", "line 4", "line 5"].join(
  "\n"
);
const TRUNCATION_LIMIT = 3;
const EXPECTED_TRUNCATED_LINES = 4;
const TLDR_EXISTS_REGEX = /already contains a tldr waymark/u;
const DIFFERENT_ID_REGEX = /different waymark id/u;
const EMPTY_ID_REGEX = /cannot be empty/u;
const WM_ID_REGEX = /wm:/u;

describe("handleAddWaymark", () => {
  test("inserts TLDR at top of file", async () => {
    const dir = await mkdtemp(join(tmpdir(), "waymark-mcp-tldr-"));
    const file = join(dir, "example.ts");
    await writeFile(
      file,
      [
        'import { something } from "./module";',
        "",
        "export function main() {",
        "  return something();",
        "}",
        "",
      ].join("\n"),
      "utf8"
    );

    const tracker = createNotifyTracker();
    const result = await handleAddWaymark({
      notifyResourceChanged: tracker.notify,
      filePath: file,
      type: "tldr",
      content: "Summarizes example module export",
    });

    expect(result.isOk()).toBe(true);
    const response = result.isOk() ? result.value : null;
    expect(tracker.changes).toBe(1);
    const payload = JSON.parse(String(response?.content?.[0]?.text ?? "")) as {
      type: string;
      startLine: number;
      content: string;
    };
    expect(payload.type).toBe("tldr");
    expect(payload.startLine).toBe(1);
    expect(payload.content).toBe("Summarizes example module export");

    const updated = await readFile(file, "utf8");
    const [firstLine] = updated.split("\n");
    expect(firstLine).toBe("// tldr ::: Summarizes example module export");

    await rm(dir, { recursive: true, force: true });
  });

  test("inserts THIS type at specified line with signal", async () => {
    const dir = await mkdtemp(join(tmpdir(), "waymark-mcp-this-"));
    const file = join(dir, "feature.ts");
    await writeFile(
      file,
      [
        "export function feature() {",
        "  // implementation placeholder",
        "  const value = 42;",
        "  return value;",
        "}",
        "",
      ].join("\n"),
      "utf8"
    );

    const signals: SignalFlags = { flagged: true };
    const tracker = createNotifyTracker();
    const result = await handleAddWaymark({
      notifyResourceChanged: tracker.notify,
      filePath: file,
      type: "about",
      content: "documents the feature body",
      line: ABOUT_INSERT_LINE,
      signals,
    });

    expect(result.isOk()).toBe(true);
    const response = result.isOk() ? result.value : null;
    const payload = JSON.parse(String(response?.content?.[0]?.text ?? "")) as {
      type: string;
      startLine: number;
      content: string;
    };
    expect(payload.type).toBe("about");
    expect(payload.startLine).toBe(ABOUT_INSERT_LINE);
    expect(payload.content).toBe("documents the feature body");

    const updated = await readFile(file, "utf8");
    const lines = updated.split("\n");
    expect(lines[ABOUT_INSERT_LINE - 1]).toBe(
      "  // ~about ::: documents the feature body"
    );

    await rm(dir, { recursive: true, force: true });
  });

  test("returns error when TLDR already exists", async () => {
    const dir = await mkdtemp(join(tmpdir(), "waymark-mcp-duplicate-"));
    const file = join(dir, "duplicate.ts");
    await writeFile(
      file,
      ["// tldr ::: existing summary", "const value = 1;"].join("\n"),
      "utf8"
    );

    const tracker = createNotifyTracker();
    const result = await handleAddWaymark({
      notifyResourceChanged: tracker.notify,
      filePath: file,
      type: "tldr",
      content: "another summary",
    });

    expect(result.isErr()).toBe(true);
    const errorMessage = result.isErr() ? result.error.message : "";
    expect(errorMessage).toMatch(TLDR_EXISTS_REGEX);

    const updated = await readFile(file, "utf8");
    expect(updated).toContain("existing summary");
    expect(tracker.changes).toBe(0);

    await rm(dir, { recursive: true, force: true });
  });

  test("supports custom type in markdown using HTML comments", async () => {
    const dir = await mkdtemp(join(tmpdir(), "waymark-mcp-custom-"));
    const file = join(dir, "notes.md");
    await writeFile(
      file,
      ["# Notes", "", "Some discussion"].join("\n"),
      "utf8"
    );

    const tracker = createNotifyTracker();
    const result = await handleAddWaymark({
      notifyResourceChanged: tracker.notify,
      filePath: file,
      type: "idea",
      content: "capture ideas for follow-up",
      line: 1,
    });

    expect(result.isOk()).toBe(true);
    const response = result.isOk() ? result.value : null;
    const payload = JSON.parse(String(response?.content?.[0]?.text ?? "")) as {
      type: string;
      startLine: number;
    };
    expect(payload.type).toBe("idea");
    expect(payload.startLine).toBe(1);

    const updated = await readFile(file, "utf8");
    const [firstLine] = updated.split("\n");
    expect(firstLine).toBe("<!-- idea ::: capture ideas for follow-up -->");

    await rm(dir, { recursive: true, force: true });
  });

  test("normalizes provided id to lowercase", async () => {
    const dir = await mkdtemp(join(tmpdir(), "waymark-mcp-id-"));
    const file = join(dir, "feature.ts");
    await writeFile(
      file,
      ["export function feature() {", "  return true;", "}"].join("\n"),
      "utf8"
    );

    const tracker = createNotifyTracker();
    const result = await handleAddWaymark({
      notifyResourceChanged: tracker.notify,
      filePath: file,
      type: "todo",
      content: "add retry",
      line: 1,
      id: "Auth-Refresh",
    });

    expect(result.isOk()).toBe(true);
    const updated = await readFile(file, "utf8");
    const [firstLine] = updated.split("\n");
    expect(firstLine).toBe("// todo ::: add retry [[auth-refresh]]");

    await rm(dir, { recursive: true, force: true });
  });

  test("accepts bracketed ids and lowercases them", async () => {
    const dir = await mkdtemp(join(tmpdir(), "waymark-mcp-id-bracket-"));
    const file = join(dir, "feature.ts");
    await writeFile(
      file,
      ["export function feature() {", "  return true;", "}"].join("\n"),
      "utf8"
    );

    const tracker = createNotifyTracker();
    const result = await handleAddWaymark({
      notifyResourceChanged: tracker.notify,
      filePath: file,
      type: "todo",
      content: "add retry",
      line: 1,
      id: "[[Auth-Refresh]]",
    });

    expect(result.isOk()).toBe(true);
    const updated = await readFile(file, "utf8");
    const [firstLine] = updated.split("\n");
    expect(firstLine).toBe("// todo ::: add retry [[auth-refresh]]");

    await rm(dir, { recursive: true, force: true });
  });

  test("returns error when content already contains a different id", async () => {
    const dir = await mkdtemp(join(tmpdir(), "waymark-mcp-id-conflict-"));
    const file = join(dir, "feature.ts");
    await writeFile(
      file,
      ["export function feature() {", "  return true;", "}"].join("\n"),
      "utf8"
    );

    const tracker = createNotifyTracker();
    const result = await handleAddWaymark({
      notifyResourceChanged: tracker.notify,
      filePath: file,
      type: "todo",
      content: "add retry [[existing-id]]",
      line: 1,
      id: "other-id",
    });

    expect(result.isErr()).toBe(true);
    const errorMessage = result.isErr() ? result.error.message : "";
    expect(errorMessage).toMatch(DIFFERENT_ID_REGEX);

    await rm(dir, { recursive: true, force: true });
  });

  test("trims whitespace around ids", async () => {
    const dir = await mkdtemp(join(tmpdir(), "waymark-mcp-id-trim-"));
    const file = join(dir, "feature.ts");
    await writeFile(
      file,
      ["export function feature() {", "  return true;", "}"].join("\n"),
      "utf8"
    );

    const tracker = createNotifyTracker();
    const result = await handleAddWaymark({
      notifyResourceChanged: tracker.notify,
      filePath: file,
      type: "todo",
      content: "add retry",
      line: 1,
      id: "  AUTH  ",
    });

    expect(result.isOk()).toBe(true);
    const updated = await readFile(file, "utf8");
    const [firstLine] = updated.split("\n");
    expect(firstLine).toBe("// todo ::: add retry [[auth]]");

    await rm(dir, { recursive: true, force: true });
  });

  test("returns error for empty ids", async () => {
    const dir = await mkdtemp(join(tmpdir(), "waymark-mcp-id-empty-"));
    const file = join(dir, "feature.ts");
    await writeFile(
      file,
      ["export function feature() {", "  return true;", "}"].join("\n"),
      "utf8"
    );

    const tracker = createNotifyTracker();
    const result = await handleAddWaymark({
      notifyResourceChanged: tracker.notify,
      filePath: file,
      type: "todo",
      content: "add retry",
      line: 1,
      id: "   ",
    });

    expect(result.isErr()).toBe(true);
    const errorMessage = result.isErr() ? result.error.message : "";
    expect(errorMessage).toMatch(EMPTY_ID_REGEX);

    await rm(dir, { recursive: true, force: true });
  });

  test("returns error for wm ids", async () => {
    const dir = await mkdtemp(join(tmpdir(), "waymark-mcp-wm-"));
    const file = join(dir, "wm-id.ts");
    await writeFile(file, ["export const sample = true;"].join("\n"), "utf8");

    const tracker = createNotifyTracker();
    const result = await handleAddWaymark({
      notifyResourceChanged: tracker.notify,
      filePath: file,
      type: "todo",
      content: "add retry",
      id: "wm:abc123",
    });

    expect(result.isErr()).toBe(true);
    const errorMessage = result.isErr() ? result.error.message : "";
    expect(errorMessage).toMatch(WM_ID_REGEX);

    await rm(dir, { recursive: true, force: true });
  });
});

describe("truncateSource", () => {
  test("returns original content when under limit", () => {
    const result = truncateSource(SAMPLE_SOURCE, 10);
    expect(result).toBe(SAMPLE_SOURCE);
  });

  test("truncates and appends ellipsis when limit exceeded", () => {
    const result = truncateSource(SAMPLE_SOURCE, TRUNCATION_LIMIT);
    const parts = result.split("\n");
    expect(parts).toHaveLength(EXPECTED_TRUNCATED_LINES);
    expect(result.endsWith("...")).toBe(true);
  });
});
