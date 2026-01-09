import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { JsonIdIndex, resolveConfig } from "@waymarks/core";

import type { CommandContext } from "../types";
import { buildRemoveArgs, runRemoveCommand } from "./remove";

const JSON_VALIDATION_ERROR_REGEX = /JSON validation failed/;

async function ensureDir(path: string): Promise<void> {
  await mkdir(path, { recursive: true });
}

describe("buildRemoveArgs", () => {
  test("parses positional file:line arguments and ids", () => {
    const parsed = buildRemoveArgs({
      targets: ["src/auth.ts:10"],
      options: {
        id: ["[[abc]]"],
        type: "todo",
        tag: ["#cleanup"],
        file: ["src/auth.ts"],
        contains: "cleanup",
      },
    });

    const ExpectedSpecCount = 3;
    expect(parsed.specs).toHaveLength(ExpectedSpecCount);
    const [byLine, byId, criteria] = parsed.specs;
    expect(byLine).toEqual({ file: "src/auth.ts", line: 10 });
    expect(byId).toEqual({ id: "[[abc]]" });
    expect(criteria).toEqual({
      files: ["src/auth.ts"],
      criteria: { type: "todo", tags: ["#cleanup"], contains: "cleanup" },
    });
  });
});

describe("runRemoveCommand", () => {
  let workspace: string;
  let context: CommandContext;

  beforeEach(async () => {
    workspace = await mkdtemp(join(tmpdir(), "waymark-remove-cli-"));
    await ensureDir(join(workspace, ".waymark"));
    context = {
      config: resolveConfig({ ids: { mode: "auto" } }),
      workspaceRoot: workspace,
      globalOptions: {},
    };
  });

  afterEach(async () => {
    await rm(workspace, { recursive: true, force: true });
  });

  test("removes waymarks by file and line", async () => {
    const filePath = join(workspace, "src/service.ts");
    await ensureDir(join(workspace, "src"));
    await writeFile(
      filePath,
      [
        "// todo ::: first task",
        "// note ::: keep this",
        "// todo ::: second task",
        "",
      ].join("\n"),
      "utf8"
    );

    const parsed = buildRemoveArgs({
      targets: [`${filePath}:1`, `${filePath}:3`],
      options: { write: true },
    });

    const preview = await runRemoveCommand(parsed, context, {
      writeOverride: false,
    });
    expect(preview.summary.successful).toBe(2);

    const actual = await runRemoveCommand(parsed, context, {
      writeOverride: true,
    });

    expect(actual.summary.successful).toBe(2);
    const contents = await readFile(filePath, "utf8");
    expect(contents).toContain("note ::: keep this");
    expect(contents).not.toContain("first task");
    expect(contents).not.toContain("second task");
  });

  test("removes waymarks by id and updates the JSON index", async () => {
    const filePath = join(workspace, "src/module.ts");
    await ensureDir(join(workspace, "src"));
    const waymarkLine = "// todo ::: needs docs [[test-456]]";
    await writeFile(
      filePath,
      ["function noop() {}", waymarkLine, ""].join("\n"),
      "utf8"
    );

    const index = new JsonIdIndex({
      workspaceRoot: workspace,
      trackHistory: false,
    });
    await index.set({
      id: "[[test-456]]",
      file: filePath,
      line: 2,
      type: "todo",
      content: waymarkLine,
      contentHash: "hash",
      contextHash: "context",
      updatedAt: Date.now(),
    });

    const parsed = buildRemoveArgs({
      targets: [],
      options: { write: true, id: ["[[test-456]]"] },
    });

    const actual = await runRemoveCommand(parsed, context, {
      writeOverride: true,
    });

    expect(actual.summary.successful).toBe(1);
    const remaining = await readFile(filePath, "utf8");
    expect(remaining).not.toContain("[[test-456]]");

    const freshIndex = new JsonIdIndex({
      workspaceRoot: workspace,
      trackHistory: false,
    });
    const ids = await freshIndex.listIds();
    expect(ids).toHaveLength(0);
  });

  test("supports JSON input via --from", async () => {
    const filePath = join(workspace, "src/data.ts");
    await ensureDir(join(workspace, "src"));
    await writeFile(
      filePath,
      ["// todo ::: remove via json", "// note ::: keep", ""].join("\n"),
      "utf8"
    );

    const spec = {
      removals: [
        {
          files: [filePath],
          criteria: { contains: "remove" },
        },
      ],
      options: { write: true },
    };
    const jsonPath = join(workspace, "removals.json");
    await writeFile(jsonPath, JSON.stringify(spec), "utf8");

    const parsed = buildRemoveArgs({
      targets: [],
      options: { from: jsonPath, write: true, json: true },
    });
    const actual = await runRemoveCommand(parsed, context, {
      writeOverride: true,
    });
    expect(actual.summary.successful).toBe(1);
    expect(actual.options.write).toBe(true);
    expect(actual.options.json).toBe(true);
    expect(() => JSON.parse(actual.output)).not.toThrow();

    const contents = await readFile(filePath, "utf8");
    expect(contents).not.toContain("remove via json");
    expect(contents).toContain("keep");
  });

  test("rejects invalid JSON structure with clear errors", async () => {
    const invalidJsonPath = join(workspace, "invalid.json");

    // Invalid removal spec - no valid removal method
    const invalidJson = JSON.stringify({
      invalid: "field",
    });
    await writeFile(invalidJsonPath, invalidJson, "utf8");

    const parsed = buildRemoveArgs({
      targets: [],
      options: { from: invalidJsonPath },
    });

    await expect(runRemoveCommand(parsed, context)).rejects.toThrow(
      JSON_VALIDATION_ERROR_REGEX
    );
  });

  test("rejects invalid criteria with clear errors", async () => {
    const invalidJsonPath = join(workspace, "invalid-criteria.json");

    // Invalid removal spec - empty criteria
    const invalidJson = JSON.stringify({
      criteria: {},
    });
    await writeFile(invalidJsonPath, invalidJson, "utf8");

    const parsed = buildRemoveArgs({
      targets: [],
      options: { from: invalidJsonPath },
    });

    await expect(runRemoveCommand(parsed, context)).rejects.toThrow(
      JSON_VALIDATION_ERROR_REGEX
    );
  });

  test("validates removal spec types properly", async () => {
    const invalidJsonPath = join(workspace, "invalid-types.json");

    // Invalid line type (should be positive integer)
    const invalidJson = JSON.stringify({
      file: "test.ts",
      line: "not-a-number",
    });
    await writeFile(invalidJsonPath, invalidJson, "utf8");

    const parsed = buildRemoveArgs({
      targets: [],
      options: { from: invalidJsonPath },
    });

    await expect(runRemoveCommand(parsed, context)).rejects.toThrow(
      JSON_VALIDATION_ERROR_REGEX
    );
  });

  test("accepts valid JSON with all removal methods", async () => {
    const filePath = join(workspace, "test.ts");
    await writeFile(
      filePath,
      "// todo ::: test removal\n// note ::: keep this\n",
      "utf8"
    );

    const validJsonPath = join(workspace, "valid.json");
    const validJson = JSON.stringify({
      file: filePath,
      line: 1,
      id: "[[test-id]]",
      files: [filePath],
      criteria: {
        type: "todo",
        tags: ["#test"],
        properties: { owner: "@alice" },
        mentions: ["@alice"],
        contentPattern: "test.*",
        contains: "removal",
        signals: {
          flagged: false,
          starred: false,
        },
      },
    });
    await writeFile(validJsonPath, validJson, "utf8");

    const parsed = buildRemoveArgs({
      targets: [],
      options: { from: validJsonPath, write: true, json: true },
    });

    const result = await runRemoveCommand(parsed, context, {
      writeOverride: true,
    });
    // Since we're testing validation, not actual removal logic,
    // we just check that it doesn't throw a validation error
    expect(result.exitCode).toBeDefined();
  });
});
