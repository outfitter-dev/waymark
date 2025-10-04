import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { DEFAULT_CONFIG } from "./config.ts";
import { JsonIdIndex } from "./id-index.ts";
import { WaymarkIdManager } from "./ids.ts";
import type { InsertionSpec } from "./insert.ts";
import { insertWaymarks } from "./insert.ts";
import type { WaymarkIdConfig } from "./types.ts";

const LINE_SPLIT_REGEX = /\r?\n/;

async function ensureDir(path: string): Promise<void> {
  await mkdir(path, { recursive: true });
}

describe("insertWaymarks", () => {
  let workspace: string;

  beforeEach(async () => {
    workspace = await mkdtemp(join(tmpdir(), "waymark-insert-"));
  });

  function createManager(trackHistory = false) {
    const index = new JsonIdIndex({ workspaceRoot: workspace, trackHistory });
    const idConfig: WaymarkIdConfig = {
      ...DEFAULT_CONFIG.ids,
      mode: "auto",
    };
    const manager = new WaymarkIdManager(idConfig, index);
    return { index, manager };
  }

  it("inserts a single waymark and auto-assigns an ID", async () => {
    const filePath = join(workspace, "src/auth.ts");
    await ensureDir(dirname(filePath));
    await writeFile(
      filePath,
      ["export async function handler() {", "  return true;", "}", ""].join(
        "\n"
      ),
      "utf8"
    );

    const { index, manager } = createManager();

    const specs: InsertionSpec[] = [
      {
        file: filePath,
        line: 2,
        type: "todo",
        content: "add rate limiting",
      },
    ];

    const results = await insertWaymarks(specs, {
      write: true,
      idManager: manager,
    });

    expect(results).toHaveLength(1);
    const first = results[0];
    expect(first).toBeDefined();
    if (!first) {
      throw new Error("Expected insertion result");
    }
    expect(first.status).toBe("success");
    const fileContents = await readFile(filePath, "utf8");
    expect(fileContents).toContain("todo ::: add rate limiting");

    const ids = await index.listIds();
    expect(ids).toHaveLength(1);
    const entry = ids[0];
    expect(entry).toBeDefined();
    if (!entry) {
      throw new Error("Expected ID entry");
    }
    expect(entry.file).toBe(filePath);
    expect(entry.type).toBe("todo");
  });

  it("respects explicit ordering when multiple waymarks share an anchor", async () => {
    const filePath = join(workspace, "src/auth.ts");
    await ensureDir(dirname(filePath));
    await writeFile(
      filePath,
      ["async function handler() {", "  return true;", "}", ""].join("\n"),
      "utf8"
    );

    const { manager } = createManager();

    const specs: InsertionSpec[] = [
      {
        file: filePath,
        line: 2,
        type: "note",
        content: "handled in middleware",
        order: 2,
      },
      {
        file: filePath,
        line: 2,
        type: "todo",
        content: "audit rate limiter",
        order: 1,
      },
    ];

    await insertWaymarks(specs, { write: true, idManager: manager });

    const fileContents = await readFile(filePath, "utf8");
    const lines = fileContents.split(LINE_SPLIT_REGEX);
    const noteIndex = lines.findIndex((line) =>
      line.includes("note ::: handled in middleware")
    );
    const todoIndex = lines.findIndex((line) =>
      line.includes("todo ::: audit rate limiter")
    );
    expect(todoIndex).toBeLessThan(noteIndex);
  });

  it("supports multi-line waymarks via continuations", async () => {
    const filePath = join(workspace, "src/service.ts");
    await ensureDir(dirname(filePath));
    await writeFile(filePath, "export const noop = () => {}\n", "utf8");

    const specs: InsertionSpec[] = [
      {
        file: filePath,
        line: 1,
        type: "tldr",
        content: "service container",
        continuations: ["uses singleton pattern", "init in app bootstrap"],
      },
    ];

    await insertWaymarks(specs, { write: true });

    const fileContents = await readFile(filePath, "utf8");
    expect(fileContents).toContain("tldr ::: service container");
    expect(fileContents).toContain("uses singleton pattern");
    expect(fileContents).toContain("init in app bootstrap");
  });

  it("performs a dry-run without touching disk or index", async () => {
    const filePath = join(workspace, "src/auth.ts");
    await ensureDir(dirname(filePath));
    await writeFile(filePath, "console.log('hi')\n", "utf8");

    const { index, manager } = createManager();

    const specs: InsertionSpec[] = [
      { file: filePath, line: 1, type: "todo", content: "dry run" },
    ];

    const results = await insertWaymarks(specs, {
      write: false,
      idManager: manager,
    });
    const first = results[0];
    expect(first).toBeDefined();
    if (!first) {
      throw new Error("Expected insertion result");
    }
    expect(first.status).toBe("success");

    const fileContents = await readFile(filePath, "utf8");
    expect(fileContents).not.toContain("dry run");

    const ids = await index.listIds();
    expect(ids).toHaveLength(0);
  });

  afterEach(async () => {
    if (workspace?.startsWith(join(tmpdir(), "waymark-insert-"))) {
      await rm(workspace, { recursive: true, force: true });
    }
  });
});
