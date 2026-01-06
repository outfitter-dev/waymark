import { afterEach, beforeEach, describe, expect, spyOn, test } from "bun:test";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { resolveConfig } from "@waymarks/core";

import type { CommandContext } from "../types";
import { parseAddArgs, runAddCommand } from "./add";

const SAMPLE_LINE = 42;
const TODO_HANDLER_REGEX = /todo ::: document handler/;
const ANY_ID_REGEX = /wm:/;
const JSON_VALIDATION_ERROR_REGEX = /JSON validation failed/;

describe("parseAddArgs", () => {
  test("parses inline arguments", () => {
    const parsed = parseAddArgs([
      `src/auth.ts:${SAMPLE_LINE}`,
      "--type",
      "todo",
      "--content",
      "add rate limiting",
      "--tag",
      "#security",
      "--mention",
      "@alice",
      "--property",
      "owner:@alice",
      "--raised",
      "--starred",
      "--continuation",
      "follow up with team",
      "--order",
      "2",
      "--id",
      "wm:custom123",
    ]);

    expect(parsed.options.write).toBe(false);
    expect(parsed.options.json).toBe(false);
    expect(parsed.specs).toHaveLength(1);

    const spec = parsed.specs[0];
    expect(spec).toBeDefined();
    if (!spec) {
      throw new Error("Expected insertion spec");
    }
    expect(spec.file).toBe("src/auth.ts");
    expect(spec.line).toBe(SAMPLE_LINE);
    expect(spec.type).toBe("todo");
    expect(spec.content).toBe("add rate limiting");
    expect(spec.tags).toEqual(["#security"]);
    expect(spec.mentions).toEqual(["@alice"]);
    expect(spec.properties).toEqual({ owner: "@alice" });
    expect(spec.signals).toEqual({ raised: true, important: true });
    expect(spec.continuations).toEqual(["follow up with team"]);
    expect(spec.order).toBe(2);
    expect(spec.id).toBe("wm:custom123");
  });

  test("supports --from for batch insert", () => {
    const parsed = parseAddArgs(["--from", "batch.json", "--json"]);
    expect(parsed.options.from).toBe("batch.json");
    expect(parsed.options.json).toBe(true);
    expect(parsed.specs).toHaveLength(0);
  });
});

describe("runAddCommand", () => {
  let workspace: string;

  beforeEach(async () => {
    workspace = await mkdtemp(join(tmpdir(), "waymark-insert-cli-"));
  });

  afterEach(async () => {
    await rm(workspace, { recursive: true, force: true });
  });

  test("writes waymark and records ID when --write is set", async () => {
    const sourceDir = join(workspace, "src");
    await mkdir(sourceDir, { recursive: true });
    const sourcePath = join(sourceDir, "service.ts");
    await writeFile(sourcePath, "export const handler = () => {}\n", {
      encoding: "utf8",
    });

    const parsed = parseAddArgs([
      `${sourcePath}:1`,
      "--type",
      "todo",
      "--content",
      "document handler",
      "--write",
    ]);

    // Ensure write flag set for runAddCommand
    parsed.options.write = true;

    const config = resolveConfig({ ids: { mode: "auto" } });
    const context: CommandContext = {
      config,
      workspaceRoot: workspace,
      globalOptions: {},
    };

    const result = await runAddCommand(parsed, context);
    expect(result.exitCode).toBe(0);
    expect(result.summary.successful).toBe(1);

    const fileContents = await readFile(sourcePath, "utf8");
    expect(fileContents).toMatch(TODO_HANDLER_REGEX);
    expect(fileContents).toMatch(ANY_ID_REGEX);

    const indexPath = join(workspace, ".waymark", "index.json");
    const indexRaw = await readFile(indexPath, "utf8");
    const indexData = JSON.parse(indexRaw) as {
      ids: Record<string, { file: string }>;
    };
    const entries = Object.values(indexData.ids);
    expect(entries).toHaveLength(1);
    expect(entries[0]?.file).toBe(sourcePath);
  });

  test("rejects invalid JSON structure with clear errors", async () => {
    const testWorkspace = await mkdtemp(join(tmpdir(), "wm-test-"));
    const invalidJsonPath = join(testWorkspace, "invalid.json");

    // Missing required fields (type and content)
    const invalidJson = JSON.stringify({
      file: "test.ts",
      line: 10,
    });
    await writeFile(invalidJsonPath, invalidJson, "utf8");

    const parsed = parseAddArgs(["--from", invalidJsonPath]);
    const config = resolveConfig({});
    const context: CommandContext = {
      config,
      workspaceRoot: testWorkspace,
      globalOptions: {},
    };

    await expect(runAddCommand(parsed, context)).rejects.toThrow(
      JSON_VALIDATION_ERROR_REGEX
    );

    // Clean up
    await rm(testWorkspace, { recursive: true, force: true });
  });

  test("validates insertion spec types properly", async () => {
    const testWorkspace = await mkdtemp(join(tmpdir(), "wm-test-"));
    const invalidJsonPath = join(testWorkspace, "invalid-types.json");

    // Invalid line type (should be positive integer)
    const invalidJson = JSON.stringify({
      file: "test.ts",
      line: "not-a-number",
      type: "todo",
      content: "test content",
    });
    await writeFile(invalidJsonPath, invalidJson, "utf8");

    const parsed = parseAddArgs(["--from", invalidJsonPath]);
    const config = resolveConfig({});
    const context: CommandContext = {
      config,
      workspaceRoot: testWorkspace,
      globalOptions: {},
    };

    await expect(runAddCommand(parsed, context)).rejects.toThrow(
      JSON_VALIDATION_ERROR_REGEX
    );

    // Clean up
    await rm(testWorkspace, { recursive: true, force: true });
  });

  test("accepts valid JSON with all optional fields", async () => {
    const testWorkspace = await mkdtemp(join(tmpdir(), "wm-test-"));
    const validJsonPath = join(testWorkspace, "valid.json");
    const sourcePath = join(testWorkspace, "test.ts");

    await writeFile(sourcePath, "// test file\nconst x = 1;\n", "utf8");

    const validJson = JSON.stringify({
      file: sourcePath,
      line: 1,
      type: "todo",
      content: "test content",
      position: "after",
      signals: {
        raised: true,
        important: true,
      },
      properties: {
        owner: "@alice",
        priority: "high",
      },
      tags: ["#test", "#validation"],
      mentions: ["@alice", "@bob"],
      continuations: ["first continuation", "second continuation"],
      id: "wm:custom-id",
    });
    await writeFile(validJsonPath, validJson, "utf8");

    const parsed = parseAddArgs(["--from", validJsonPath, "--write", "--json"]);
    const config = resolveConfig({});
    const context: CommandContext = {
      config,
      workspaceRoot: testWorkspace,
      globalOptions: {},
    };

    const result = await runAddCommand(parsed, context);
    expect(result.exitCode).toBe(0);
    expect(result.summary.successful).toBe(1);

    const fileContents = await readFile(sourcePath, "utf8");
    expect(fileContents).toContain("~*todo ::: test content");
    expect(fileContents).toContain("owner:@alice");
    expect(fileContents).toContain("#test");
    expect(fileContents).toContain("@alice");

    // Clean up
    await rm(testWorkspace, { recursive: true, force: true });
  });

  test("--from reads batches from JSON array", async () => {
    const testWorkspace = await mkdtemp(join(tmpdir(), "wm-insert-array-"));
    const source = join(testWorkspace, "source.ts");
    await writeFile(source, "// fixture\n", "utf8");

    const batchJsonPath = join(testWorkspace, "batch.json");
    const batchJson = JSON.stringify([
      { file: source, line: 1, type: "todo", content: "array payload 1" },
      { file: source, line: 1, type: "note", content: "array payload 2" },
    ]);
    await writeFile(batchJsonPath, batchJson, "utf8");

    const parsed = parseAddArgs(["--from", batchJsonPath, "--write"]);
    const config = resolveConfig({});
    const context: CommandContext = {
      config,
      workspaceRoot: testWorkspace,
      globalOptions: {},
    };

    const result = await runAddCommand(parsed, context);
    expect(result.exitCode).toBe(0);
    expect(result.summary.successful).toBe(2);
    expect(result.summary.filesModified).toBe(1);

    const fileContents = await readFile(source, "utf8");
    expect(fileContents).toContain("todo ::: array payload 1");
    expect(fileContents).toContain("note ::: array payload 2");

    // Clean up
    await rm(testWorkspace, { recursive: true, force: true });
  });

  test("--from reads batches from insertions wrapper object", async () => {
    const testWorkspace = await mkdtemp(join(tmpdir(), "wm-insert-wrapper-"));
    const source = join(testWorkspace, "source.ts");
    await writeFile(source, "// fixture\n", "utf8");

    const wrapperJsonPath = join(testWorkspace, "wrapper.json");
    const wrapperJson = JSON.stringify({
      insertions: [
        { file: source, line: 1, type: "todo", content: "wrapper payload 1" },
        { file: source, line: 1, type: "fix", content: "wrapper payload 2" },
      ],
    });
    await writeFile(wrapperJsonPath, wrapperJson, "utf8");

    const parsed = parseAddArgs(["--from", wrapperJsonPath, "--write"]);
    const config = resolveConfig({});
    const context: CommandContext = {
      config,
      workspaceRoot: testWorkspace,
      globalOptions: {},
    };

    const result = await runAddCommand(parsed, context);
    expect(result.exitCode).toBe(0);
    expect(result.summary.successful).toBe(2);
    expect(result.summary.filesModified).toBe(1);

    const fileContents = await readFile(source, "utf8");
    expect(fileContents).toContain("todo ::: wrapper payload 1");
    expect(fileContents).toContain("fix ::: wrapper payload 2");

    // Clean up
    await rm(testWorkspace, { recursive: true, force: true });
  });

  test("--from - reads batch from stdin", async () => {
    const testWorkspace = await mkdtemp(join(tmpdir(), "wm-insert-stdin-"));
    const source = join(testWorkspace, "source.ts");
    await writeFile(source, "// fixture\n", "utf8");

    // Mock stdin data with JSON array
    const stdinData = JSON.stringify([
      { file: source, line: 1, type: "todo", content: "stdin payload 1" },
      { file: source, line: 1, type: "note", content: "stdin payload 2" },
    ]);

    // Spy on readFromStdin to return our test data
    const stdinModule = await import("../utils/stdin.ts");
    const readStdinSpy = spyOn(stdinModule, "readFromStdin").mockResolvedValue(
      stdinData
    );

    try {
      const parsed = parseAddArgs(["--from", "-", "--write"]);
      const config = resolveConfig({});
      const context: CommandContext = {
        config,
        workspaceRoot: testWorkspace,
        globalOptions: {},
      };

      const result = await runAddCommand(parsed, context);
      expect(result.exitCode).toBe(0);
      expect(result.summary.successful).toBe(2);
      expect(result.summary.filesModified).toBe(1);
      expect(readStdinSpy).toHaveBeenCalledTimes(1);

      const fileContents = await readFile(source, "utf8");
      expect(fileContents).toContain("todo ::: stdin payload 1");
      expect(fileContents).toContain("note ::: stdin payload 2");
    } finally {
      // Restore original function
      readStdinSpy.mockRestore();
      // Clean up
      await rm(testWorkspace, { recursive: true, force: true });
    }
  });
});
