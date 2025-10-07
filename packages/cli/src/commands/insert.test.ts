import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { resolveConfig } from "@waymarks/core";

import type { CommandContext } from "../types";
import { parseInsertArgs, runInsertCommand } from "./insert";

const SAMPLE_LINE = 42;
const TODO_HANDLER_REGEX = /todo ::: document handler/;
const ANY_ID_REGEX = /wm:/;

describe("parseInsertArgs", () => {
  test("parses inline arguments", () => {
    const parsed = parseInsertArgs([
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
    const parsed = parseInsertArgs(["--from", "batch.json", "--json"]);
    expect(parsed.options.from).toBe("batch.json");
    expect(parsed.options.json).toBe(true);
    expect(parsed.specs).toHaveLength(0);
  });
});

describe("runInsertCommand", () => {
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

    const parsed = parseInsertArgs([
      `${sourcePath}:1`,
      "--type",
      "todo",
      "--content",
      "document handler",
      "--write",
    ]);

    // Ensure write flag set for runInsertCommand
    parsed.options.write = true;

    const config = resolveConfig({ ids: { mode: "auto" } });
    const context: CommandContext = {
      config,
      workspaceRoot: workspace,
      globalOptions: {},
    };

    const result = await runInsertCommand(parsed, context);
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
});
