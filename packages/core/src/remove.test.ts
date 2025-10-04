import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import {
  DEFAULT_CONFIG,
  fingerprintContent,
  fingerprintContext,
  JsonIdIndex,
  type RemovalSpec,
  removeWaymarks,
  WaymarkIdManager,
} from "./index.ts";

async function ensureDir(path: string): Promise<void> {
  await mkdir(path, { recursive: true });
}

describe("removeWaymarks", () => {
  let workspace: string;

  beforeEach(async () => {
    workspace = await mkdtemp(join(tmpdir(), "waymark-remove-"));
  });

  afterEach(async () => {
    await rm(workspace, { recursive: true, force: true });
  });

  it("removes a waymark by line number", async () => {
    const filePath = join(workspace, "src/auth.ts");
    await ensureDir(dirname(filePath));
    await writeFile(
      filePath,
      [
        "export function handler() {",
        "  return true;",
        "}",
        "// todo ::: remove me",
        "",
      ].join("\n"),
      "utf8"
    );

    const specs: RemovalSpec[] = [{ file: filePath, line: 4 }];

    const results = await removeWaymarks(specs, { write: true });
    expect(results).toHaveLength(1);
    const first = results[0];
    expect(first).toBeDefined();
    if (!first) {
      throw new Error("Expected removal result");
    }
    expect(first.status).toBe("success");
    expect(first.file).toBe(filePath);

    const contents = await readFile(filePath, "utf8");
    expect(contents).not.toContain("remove me");
  });

  it("removes a waymark by id and updates the index", async () => {
    const filePath = join(workspace, "src/service.ts");
    await ensureDir(dirname(filePath));
    const waymarkLine = "// todo ::: document handler wm:test123";
    await writeFile(
      filePath,
      ["export const handler = () => {};", waymarkLine, ""].join("\n"),
      "utf8"
    );

    const index = new JsonIdIndex({
      workspaceRoot: workspace,
      trackHistory: false,
    });
    const manager = new WaymarkIdManager(
      { ...DEFAULT_CONFIG.ids, mode: "auto" },
      index
    );

    await index.set({
      id: "wm:test123",
      file: filePath,
      line: 2,
      type: "todo",
      content: waymarkLine,
      contentHash: fingerprintContent(waymarkLine),
      contextHash: fingerprintContext(`${filePath}:2`),
      updatedAt: Date.now(),
    });

    const specs: RemovalSpec[] = [{ id: "wm:test123" }];
    const results = await removeWaymarks(specs, {
      write: true,
      idManager: manager,
    });

    expect(results).toHaveLength(1);
    expect(results[0]?.status).toBe("success");

    const indexData = await index.listIds();
    expect(indexData).toHaveLength(0);

    const contents = await readFile(filePath, "utf8");
    expect(contents).not.toContain("wm:test123");
  });

  it("removes waymarks matching criteria across files", async () => {
    const filePath = join(workspace, "src/module.ts");
    await ensureDir(dirname(filePath));
    await writeFile(
      filePath,
      [
        "// todo ::: needs refactor",
        "// note ::: keep this",
        "// todo ::: another task",
        "",
      ].join("\n"),
      "utf8"
    );

    const specs: RemovalSpec[] = [
      {
        files: [filePath],
        criteria: { type: "todo" },
      },
    ];

    const results = await removeWaymarks(specs, { write: true });
    expect(results.filter((r) => r.status === "success")).toHaveLength(2);

    const remaining = await readFile(filePath, "utf8");
    expect(remaining).toContain("note ::: keep this");
    expect(remaining).not.toContain("needs refactor");
    expect(remaining).not.toContain("another task");
  });

  it("supports contains filter for criteria", async () => {
    const filePath = join(workspace, "src/contains.ts");
    await ensureDir(dirname(filePath));
    await writeFile(
      filePath,
      [
        "// todo ::: add rate limiting",
        "// todo ::: update documentation",
        "",
      ].join("\n"),
      "utf8"
    );

    const specs: RemovalSpec[] = [
      {
        files: [filePath],
        criteria: { contains: "documentation" },
      },
    ];

    const results = await removeWaymarks(specs, { write: true });
    expect(results.filter((r) => r.status === "success")).toHaveLength(1);
    const contents = await readFile(filePath, "utf8");
    expect(contents).toContain("add rate limiting");
    expect(contents).not.toContain("documentation");
  });

  it("rejects unsafe content patterns", async () => {
    const filePath = join(workspace, "src/unsafe.ts");
    await ensureDir(dirname(filePath));
    await writeFile(filePath, ["// todo ::: aaaa", ""].join("\n"), "utf8");

    const specs: RemovalSpec[] = [
      {
        files: [filePath],
        criteria: { contentPattern: "(a+)+$" },
      },
    ];

    const results = await removeWaymarks(specs, { write: true });

    expect(results).toHaveLength(1);
    expect(results[0]?.status).toBe("error");
    expect(results[0]?.file).toBe(filePath);
    expect(results[0]?.error).toContain("unsafe");
  });
});
