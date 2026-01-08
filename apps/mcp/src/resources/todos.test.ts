// tldr ::: tests for MCP todos resource truncation and output shape

import { describe, expect, test } from "bun:test";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import { handleTodosResource, MAX_TODOS_RESULTS } from "./todos";

const EXTRA_TODO_COUNT = 1;
const SMALL_TODO_COUNT = 2;
const TASK_NUMBER_OFFSET = 1;

async function withWorkspace<T>(
  workspace: string,
  action: () => Promise<T>
): Promise<T> {
  const previousCwd = process.cwd();
  process.chdir(workspace);
  try {
    return await action();
  } finally {
    process.chdir(previousCwd);
  }
}

async function writeFixture(path: string, contents: string): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, contents, "utf8");
}

describe("handleTodosResource", () => {
  test("returns todos without truncation", async () => {
    const workspace = await mkdtemp(join(tmpdir(), "waymark-mcp-todos-"));
    try {
      await writeFixture(
        join(workspace, "src", "sample.ts"),
        [
          "// todo ::: add telemetry",
          "// note ::: ignored for todos",
          "// todo ::: add retries",
          "",
        ].join("\n")
      );

      const response = await withWorkspace(workspace, () =>
        handleTodosResource()
      );
      const text = String(response.contents?.[0]?.text ?? "");
      const payload = JSON.parse(text) as {
        todos: Array<{ content: string }>;
        truncated: boolean;
      };

      expect(payload.truncated).toBe(false);
      expect(payload.todos).toHaveLength(SMALL_TODO_COUNT);
      expect(payload.todos[0]?.content).toContain("add telemetry");
      expect(payload.todos[1]?.content).toContain("add retries");
    } finally {
      await rm(workspace, { recursive: true, force: true });
    }
  });

  test("truncates when todo count exceeds max", async () => {
    const workspace = await mkdtemp(join(tmpdir(), "waymark-mcp-todos-"));
    const todoCount = MAX_TODOS_RESULTS + EXTRA_TODO_COUNT;
    try {
      const lines = Array.from(
        { length: todoCount },
        (_, index) => `// todo ::: task ${index + TASK_NUMBER_OFFSET}`
      );
      await writeFixture(join(workspace, "src", "many.ts"), lines.join("\n"));

      const response = await withWorkspace(workspace, () =>
        handleTodosResource()
      );
      const text = String(response.contents?.[0]?.text ?? "");
      const payload = JSON.parse(text) as {
        todos: Array<{ content: string }>;
        truncated: boolean;
      };

      expect(payload.truncated).toBe(true);
      expect(payload.todos).toHaveLength(MAX_TODOS_RESULTS);
    } finally {
      await rm(workspace, { recursive: true, force: true });
    }
  });
});
