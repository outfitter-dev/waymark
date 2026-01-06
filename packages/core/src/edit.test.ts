import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import {
  DEFAULT_CONFIG,
  editWaymark,
  fingerprintContent,
  fingerprintContext,
  JsonIdIndex,
  WaymarkIdManager,
} from "./index.ts";

async function ensureDir(path: string): Promise<void> {
  await mkdir(path, { recursive: true });
}

describe("editWaymark", () => {
  let workspace: string;

  beforeEach(async () => {
    workspace = await mkdtemp(join(tmpdir(), "waymark-edit-"));
  });

  afterEach(async () => {
    await rm(workspace, { recursive: true, force: true });
  });

  function createManager() {
    const index = new JsonIdIndex({ workspaceRoot: workspace });
    const manager = new WaymarkIdManager(
      { ...DEFAULT_CONFIG.ids, mode: "auto" },
      index
    );
    return { index, manager };
  }

  it("updates the waymark type", async () => {
    const filePath = join(workspace, "src/auth.ts");
    await ensureDir(dirname(filePath));
    await writeFile(filePath, "// todo ::: handle auth\n", "utf8");

    const result = await editWaymark(
      { file: filePath, line: 1, type: "fix", write: true },
      DEFAULT_CONFIG
    );

    expect(result.after.type).toBe("fix");
    const contents = await readFile(filePath, "utf8");
    expect(contents).toContain("// fix ::: handle auth");
  });

  it("updates content and preserves IDs", async () => {
    const filePath = join(workspace, "src/rate.ts");
    await ensureDir(dirname(filePath));
    await writeFile(
      filePath,
      "// todo ::: add rate limiting [[test123]]\n",
      "utf8"
    );

    const result = await editWaymark(
      {
        file: filePath,
        line: 1,
        content: "add retry budget",
        write: true,
      },
      DEFAULT_CONFIG
    );

    expect(result.after.raw).toContain("[[test123]]");
    const contents = await readFile(filePath, "utf8");
    expect(contents).toContain("add retry budget [[test123]]");
  });

  it("preserves IDs found outside the header line", async () => {
    const filePath = join(workspace, "src/continuation.ts");
    await ensureDir(dirname(filePath));
    await writeFile(
      filePath,
      [
        "// todo ::: add rate limiting",
        "//      ::: [[test999]] #auth",
        "",
      ].join("\n"),
      "utf8"
    );

    const result = await editWaymark(
      {
        file: filePath,
        line: 1,
        content: "add retry budget",
        write: true,
      },
      DEFAULT_CONFIG
    );

    expect(result.after.raw).toContain("[[test999]]");
    const contents = await readFile(filePath, "utf8");
    expect(contents).toContain("add retry budget [[test999]]");
  });

  it("sets and clears signals", async () => {
    const filePath = join(workspace, "src/signals.ts");
    await ensureDir(dirname(filePath));
    await writeFile(filePath, "// todo ::: audit\n", "utf8");

    await editWaymark(
      { file: filePath, line: 1, raised: true, starred: true, write: true },
      DEFAULT_CONFIG
    );

    let contents = await readFile(filePath, "utf8");
    expect(contents).toContain("// ~*todo ::: audit");

    await editWaymark(
      { file: filePath, line: 1, clearSignals: true, write: true },
      DEFAULT_CONFIG
    );

    contents = await readFile(filePath, "utf8");
    expect(contents).toContain("// todo ::: audit");
  });

  it("edits by id and refreshes the index", async () => {
    const filePath = join(workspace, "src/by-id.ts");
    await ensureDir(dirname(filePath));
    await writeFile(
      filePath,
      "// todo ::: implement OAuth [[abc123]]\n",
      "utf8"
    );

    const { index, manager } = createManager();
    await index.set({
      id: "[[abc123]]",
      file: filePath,
      line: 1,
      type: "todo",
      content: "implement OAuth [[abc123]]",
      contentHash: fingerprintContent("implement OAuth [[abc123]]"),
      contextHash: fingerprintContext(`${filePath}:1`),
      updatedAt: Date.now(),
    });

    await editWaymark(
      {
        id: "[[abc123]]",
        content: "implement OAuth + PKCE",
        write: true,
        idManager: manager,
      },
      DEFAULT_CONFIG
    );

    const refreshed = await index.get("[[abc123]]");
    expect(refreshed?.content).toBe("implement OAuth + PKCE [[abc123]]");

    const contents = await readFile(filePath, "utf8");
    expect(contents).toContain("implement OAuth + PKCE [[abc123]]");
  });

  it("previews edits without writing", async () => {
    const filePath = join(workspace, "src/preview.ts");
    await ensureDir(dirname(filePath));
    await writeFile(filePath, "// todo ::: preview\n", "utf8");

    const result = await editWaymark(
      { file: filePath, line: 1, type: "note" },
      DEFAULT_CONFIG
    );

    expect(result.written).toBe(false);
    const contents = await readFile(filePath, "utf8");
    expect(contents).toContain("// todo ::: preview");
  });
});
