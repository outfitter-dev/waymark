import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Readable } from "node:stream";

import {
  fingerprintContent,
  fingerprintContext,
  JsonIdIndex,
  parse,
  resolveConfig,
  type WaymarkRecord,
} from "@waymarks/core";

import type { CommandContext } from "../types.ts";
import {
  type ApplyArgs,
  applyModifications,
  preserveId,
  resolveContentInput,
  runModifyCommand,
} from "./modify.ts";

const SAMPLE_FILE = "src/auth.ts";

function createRecord(source: string): WaymarkRecord {
  const records = parse(source, { file: SAMPLE_FILE });
  if (records.length === 0) {
    throw new Error("Expected at least one waymark record");
  }
  const first = records[0];
  if (!first) {
    throw new Error(
      "Unexpected: records array is non-empty but first element is undefined"
    );
  }
  return first;
}

describe("preserveId", () => {
  test("preserves ID at end of content", () => {
    const result = preserveId("implement OAuth [[a3k9m2p]]", "validate JWT");
    expect(result).toBe("validate JWT [[a3k9m2p]]");
  });

  test("removes duplicate ID from new content", () => {
    const result = preserveId(
      "old content [[a3k9m2p]]",
      "new content [[a3k9m2p]]"
    );
    expect(result).toBe("new content [[a3k9m2p]]");
  });

  test("returns content as-is when no ID present", () => {
    const result = preserveId("implement OAuth", "validate JWT");
    expect(result).toBe("validate JWT");
  });
});

describe("applyModifications", () => {
  const config = resolveConfig();

  test("changes waymark type", () => {
    const record = createRecord("// todo ::: implement OAuth");
    const result = applyModifications({
      record,
      config,
      baseContent: "implement OAuth",
      options: { type: "fix" },
    } satisfies ApplyArgs);
    expect(result.type).toBe("fix");
    expect(result.firstLine).toBe("// fix ::: implement OAuth");
  });

  test("adds starred signal", () => {
    const record = createRecord("// todo ::: implement OAuth");
    const result = applyModifications({
      record,
      config,
      baseContent: "implement OAuth",
      options: { starred: true },
    } satisfies ApplyArgs);
    expect(result.signals.important).toBe(true);
    expect(result.firstLine).toBe("// *todo ::: implement OAuth");
  });

  test("combines signals correctly", () => {
    const record = createRecord("// *todo ::: implement OAuth");
    const result = applyModifications({
      record,
      config,
      baseContent: "implement OAuth",
      options: { raised: true },
    } satisfies ApplyArgs);
    expect(result.signals.raised).toBe(true);
    expect(result.signals.important).toBe(true);
    expect(result.firstLine).toBe("// ~*todo ::: implement OAuth");
  });

  test("removes all signals", () => {
    const record = createRecord("// ~*todo ::: implement OAuth");
    const result = applyModifications({
      record,
      config,
      baseContent: "implement OAuth",
      options: { noSignal: true },
    } satisfies ApplyArgs);
    expect(result.signals.raised).toBe(false);
    expect(result.signals.important).toBe(false);
    expect(result.firstLine).toBe("// todo ::: implement OAuth");
  });
});

describe("resolveContentInput", () => {
  test("returns inline content", async () => {
    const result = await resolveContentInput(
      { content: "inline" },
      Readable.from([])
    );
    expect(result).toBe("inline");
  });

  test("reads content from stdin sentinel", async () => {
    const stream = Readable.from(["stdin payload\n"]);
    const result = await resolveContentInput({ content: "-" }, stream);
    expect(result).toBe("stdin payload");
  });
});

describe("runModifyCommand integration", () => {
  let workspace: string;
  let context: CommandContext;

  beforeEach(async () => {
    workspace = await mkdtemp(join(tmpdir(), "waymark-modify-"));
    context = {
      config: resolveConfig(),
      workspaceRoot: workspace,
      globalOptions: {},
    };
  });

  afterEach(async () => {
    await rm(workspace, { recursive: true, force: true });
  });

  test("modifies waymark type", async () => {
    const filePath = join(workspace, "auth.ts");
    await writeFile(filePath, "// todo ::: implement OAuth\n", "utf8");

    const result = await runModifyCommand(
      context,
      `${filePath}:1`,
      { type: "fix", write: true },
      { stdin: Readable.from([]) }
    );

    expect(result.payload.applied).toBe(true);
    const text = await readFile(filePath, "utf8");
    expect(text).toBe("// fix ::: implement OAuth\n");
  });

  test("preserves ID when modifying content", async () => {
    const filePath = join(workspace, "auth.ts");
    await writeFile(
      filePath,
      "// todo ::: implement OAuth [[a3k9m2p]]\n",
      "utf8"
    );

    const result = await runModifyCommand(
      context,
      `${filePath}:1`,
      { content: "validate JWT", write: true },
      { stdin: Readable.from([]) }
    );

    expect(result.payload.after.content).toBe("validate JWT [[a3k9m2p]]");
    const text = await readFile(filePath, "utf8");
    expect(text).toBe("// todo ::: validate JWT [[a3k9m2p]]\n");
  });

  test("preserves multi-line structure when adding signals", async () => {
    const filePath = join(workspace, "auth.ts");
    await writeFile(
      filePath,
      ["// todo ::: implement OAuth", "//      ::: with PKCE flow"].join("\n"),
      "utf8"
    );

    const result = await runModifyCommand(
      context,
      `${filePath}:1`,
      { starred: true, write: true },
      { stdin: Readable.from([]) }
    );

    expect(result.payload.after.raw).toBe("// *todo ::: implement OAuth");
    const text = await readFile(filePath, "utf8");
    expect(text).toContain("// *todo ::: implement OAuth");
    expect(text).toContain("//      ::: with PKCE flow");
  });

  test("accepts content from stdin", async () => {
    const filePath = join(workspace, "auth.ts");
    await writeFile(filePath, "// todo ::: implement OAuth\n", "utf8");

    const stdin = Readable.from(["validate JWT"]);
    const result = await runModifyCommand(
      context,
      `${filePath}:1`,
      { content: "-", write: true },
      { stdin }
    );

    expect(result.payload.after.content).toBe("validate JWT");
    const text = await readFile(filePath, "utf8");
    expect(text).toBe("// todo ::: validate JWT\n");
  });

  test("refreshes index after write", async () => {
    const filePath = join(workspace, "auth.ts");
    await writeFile(
      filePath,
      "// todo ::: implement OAuth [[test123]]\n",
      "utf8"
    );

    const index = new JsonIdIndex({ workspaceRoot: workspace });
    await index.set({
      id: "[[test123]]",
      file: filePath,
      line: 1,
      type: "todo",
      content: "// todo ::: implement OAuth [[test123]]",
      contentHash: fingerprintContent(
        "// todo ::: implement OAuth [[test123]]"
      ),
      contextHash: fingerprintContext(
        `${filePath}:1:// todo ::: implement OAuth`
      ),
      updatedAt: Date.now(),
    });

    await runModifyCommand(
      context,
      `${filePath}:1`,
      { starred: true, write: true },
      { stdin: Readable.from([]) }
    );

    const refreshedIndex = new JsonIdIndex({ workspaceRoot: workspace });
    const updated = await refreshedIndex.get("[[test123]]");
    expect(updated).not.toBeNull();
    expect(updated?.type).toBe("todo");
    expect(updated?.content).toBe("implement OAuth [[test123]]");

    const modifiedFile = await readFile(filePath, "utf8");
    expect(modifiedFile).toContain("// *todo ::: implement OAuth [[test123]]");
  });

  test("resolves target via ID", async () => {
    const filePath = join(workspace, "auth.ts");
    await writeFile(
      filePath,
      "// todo ::: implement OAuth [[abc123]]\n",
      "utf8"
    );

    const index = new JsonIdIndex({ workspaceRoot: workspace });
    await index.set({
      id: "[[abc123]]",
      file: filePath,
      line: 1,
      type: "todo",
      content: "// todo ::: implement OAuth [[abc123]]",
      contentHash: fingerprintContent("// todo ::: implement OAuth [[abc123]]"),
      contextHash: fingerprintContext(
        `${filePath}:1:// todo ::: implement OAuth`
      ),
      updatedAt: Date.now(),
    });

    await runModifyCommand(
      context,
      undefined,
      { id: "[[abc123]]", noSignal: true, write: true },
      { stdin: Readable.from([]) }
    );

    const text = await readFile(filePath, "utf8");
    expect(text).toBe("// todo ::: implement OAuth [[abc123]]\n");
  });
});
