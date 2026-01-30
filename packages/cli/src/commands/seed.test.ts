// tldr ::: unit tests for wm seed command

import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { resolveConfig } from "@waymarks/core";

import type { CommandContext } from "../types";
import { buildSeedArgs, runSeedCommand } from "./seed";

describe("buildSeedArgs", () => {
  test("parses paths argument", () => {
    const parsed = buildSeedArgs({
      paths: ["src/"],
      options: {},
    });

    expect(parsed.paths).toEqual(["src/"]);
    expect(parsed.options.write).toBe(false);
    expect(parsed.options.json).toBe(false);
    expect(parsed.options.jsonl).toBe(false);
  });

  test("parses --write flag", () => {
    const parsed = buildSeedArgs({
      paths: ["src/"],
      options: { write: true },
    });

    expect(parsed.options.write).toBe(true);
  });

  test("parses --json flag", () => {
    const parsed = buildSeedArgs({
      paths: ["src/"],
      options: { json: true },
    });

    expect(parsed.options.json).toBe(true);
  });

  test("parses --jsonl flag", () => {
    const parsed = buildSeedArgs({
      paths: ["src/"],
      options: { jsonl: true },
    });

    expect(parsed.options.jsonl).toBe(true);
  });

  test("defaults to current directory when no paths provided", () => {
    const parsed = buildSeedArgs({
      paths: [],
      options: {},
    });

    expect(parsed.paths).toEqual(["."]);
  });
});

describe("runSeedCommand", () => {
  let workspace: string;

  beforeEach(async () => {
    workspace = await mkdtemp(join(tmpdir(), "waymark-seed-"));
  });

  afterEach(async () => {
    await rm(workspace, { recursive: true, force: true });
  });

  test("detects docstring and generates TLDR in preview mode", async () => {
    const sourceDir = join(workspace, "src");
    await mkdir(sourceDir, { recursive: true });
    const sourcePath = join(sourceDir, "service.ts");
    await writeFile(
      sourcePath,
      `/**
 * Handles user authentication and session management.
 * @param request - The authentication request
 */
export function authenticate(request: AuthRequest) {
  // implementation
}
`,
      "utf8"
    );

    const parsed = buildSeedArgs({
      paths: [sourcePath],
      options: {},
    });

    const config = resolveConfig({});
    const context: CommandContext = {
      config,
      workspaceRoot: workspace,
      globalOptions: {},
    };

    const result = await runSeedCommand(parsed, context);
    expect(result.exitCode).toBe(0);
    expect(result.summary.total).toBe(1);
    expect(result.summary.wouldInsert).toBe(1);
    expect(result.output).toContain("Would insert");
    expect(result.output).toContain("tldr");
    expect(result.output).toContain(
      "Handles user authentication and session management"
    );

    // File should not be modified in preview mode
    const fileContents = await readFile(sourcePath, "utf8");
    expect(fileContents).not.toContain("tldr :::");
  });

  test("inserts TLDR when --write is set", async () => {
    const sourceDir = join(workspace, "src");
    await mkdir(sourceDir, { recursive: true });
    const sourcePath = join(sourceDir, "handler.ts");
    await writeFile(
      sourcePath,
      `/**
 * Processes incoming webhook events.
 */
export function handleWebhook(event: WebhookEvent) {
  // implementation
}
`,
      "utf8"
    );

    const parsed = buildSeedArgs({
      paths: [sourcePath],
      options: { write: true },
    });

    const config = resolveConfig({});
    const context: CommandContext = {
      config,
      workspaceRoot: workspace,
      globalOptions: {},
    };

    const result = await runSeedCommand(parsed, context);
    expect(result.exitCode).toBe(0);
    expect(result.summary.total).toBe(1);
    expect(result.summary.inserted).toBe(1);

    const fileContents = await readFile(sourcePath, "utf8");
    expect(fileContents).toContain(
      "tldr ::: Processes incoming webhook events"
    );
  });

  test("skips files that already have TLDRs", async () => {
    const sourceDir = join(workspace, "src");
    await mkdir(sourceDir, { recursive: true });
    const sourcePath = join(sourceDir, "existing.ts");
    await writeFile(
      sourcePath,
      `// tldr ::: already has a summary
/**
 * This function has a docstring but already has a TLDR.
 */
export function existing() {}
`,
      "utf8"
    );

    const parsed = buildSeedArgs({
      paths: [sourcePath],
      options: { write: true },
    });

    const config = resolveConfig({});
    const context: CommandContext = {
      config,
      workspaceRoot: workspace,
      globalOptions: {},
    };

    const result = await runSeedCommand(parsed, context);
    expect(result.exitCode).toBe(0);
    expect(result.summary.total).toBe(1);
    expect(result.summary.skipped).toBe(1);
    expect(result.summary.inserted).toBe(0);
    expect(result.output).toContain("already has TLDR");
  });

  test("skips files without docstrings", async () => {
    const sourceDir = join(workspace, "src");
    await mkdir(sourceDir, { recursive: true });
    const sourcePath = join(sourceDir, "noDocstring.ts");
    await writeFile(
      sourcePath,
      `export function noDocstring() {
  // no docstring here
}
`,
      "utf8"
    );

    const parsed = buildSeedArgs({
      paths: [sourcePath],
      options: { write: true },
    });

    const config = resolveConfig({});
    const context: CommandContext = {
      config,
      workspaceRoot: workspace,
      globalOptions: {},
    };

    const result = await runSeedCommand(parsed, context);
    expect(result.exitCode).toBe(0);
    expect(result.summary.total).toBe(1);
    expect(result.summary.skipped).toBe(1);
    expect(result.summary.inserted).toBe(0);
    expect(result.output).toContain("no docstring");
  });

  test("outputs JSON format when --json is set", async () => {
    const sourceDir = join(workspace, "src");
    await mkdir(sourceDir, { recursive: true });
    const sourcePath = join(sourceDir, "json-test.ts");
    await writeFile(
      sourcePath,
      `/**
 * Test function for JSON output.
 */
export function testJson() {}
`,
      "utf8"
    );

    const parsed = buildSeedArgs({
      paths: [sourcePath],
      options: { json: true },
    });

    const config = resolveConfig({});
    const context: CommandContext = {
      config,
      workspaceRoot: workspace,
      globalOptions: {},
    };

    const result = await runSeedCommand(parsed, context);
    expect(result.exitCode).toBe(0);

    const json = JSON.parse(result.output);
    expect(json).toHaveProperty("results");
    expect(json).toHaveProperty("summary");
    expect(json.summary.total).toBe(1);
  });

  test("outputs JSONL format when --jsonl is set", async () => {
    const sourceDir = join(workspace, "src");
    await mkdir(sourceDir, { recursive: true });
    const sourcePath = join(sourceDir, "jsonl-test.ts");
    await writeFile(
      sourcePath,
      `/**
 * Test function for JSONL output.
 */
export function testJsonl() {}
`,
      "utf8"
    );

    const parsed = buildSeedArgs({
      paths: [sourcePath],
      options: { jsonl: true },
    });

    const config = resolveConfig({});
    const context: CommandContext = {
      config,
      workspaceRoot: workspace,
      globalOptions: {},
    };

    const result = await runSeedCommand(parsed, context);
    expect(result.exitCode).toBe(0);

    const lines = result.output.trim().split("\n");
    expect(lines.length).toBeGreaterThanOrEqual(2);

    // First line should be a result
    const firstLine = JSON.parse(lines[0]);
    expect(firstLine).toHaveProperty("file");

    // Last line should be summary
    const lastLine = JSON.parse(lines.at(-1));
    expect(lastLine).toHaveProperty("summary");
  });

  test("processes multiple files", async () => {
    const sourceDir = join(workspace, "src");
    await mkdir(sourceDir, { recursive: true });

    await writeFile(
      join(sourceDir, "file1.ts"),
      `/**
 * First file description.
 */
export function file1() {}
`,
      "utf8"
    );

    await writeFile(
      join(sourceDir, "file2.ts"),
      `/**
 * Second file description.
 */
export function file2() {}
`,
      "utf8"
    );

    const parsed = buildSeedArgs({
      paths: [sourceDir],
      options: { write: true },
    });

    const config = resolveConfig({});
    const context: CommandContext = {
      config,
      workspaceRoot: workspace,
      globalOptions: {},
    };

    const result = await runSeedCommand(parsed, context);
    expect(result.exitCode).toBe(0);
    expect(result.summary.total).toBe(2);
    expect(result.summary.inserted).toBe(2);

    const file1Contents = await readFile(join(sourceDir, "file1.ts"), "utf8");
    expect(file1Contents).toContain("tldr ::: First file description");

    const file2Contents = await readFile(join(sourceDir, "file2.ts"), "utf8");
    expect(file2Contents).toContain("tldr ::: Second file description");
  });

  test("handles Python docstrings", async () => {
    const sourceDir = join(workspace, "src");
    await mkdir(sourceDir, { recursive: true });
    const sourcePath = join(sourceDir, "module.py");
    await writeFile(
      sourcePath,
      `"""
Utility functions for data processing.
"""

def process_data():
    pass
`,
      "utf8"
    );

    const parsed = buildSeedArgs({
      paths: [sourcePath],
      options: { write: true },
    });

    const config = resolveConfig({});
    const context: CommandContext = {
      config,
      workspaceRoot: workspace,
      globalOptions: {},
    };

    const result = await runSeedCommand(parsed, context);
    expect(result.exitCode).toBe(0);
    expect(result.summary.inserted).toBe(1);

    const fileContents = await readFile(sourcePath, "utf8");
    expect(fileContents).toContain(
      "# tldr ::: Utility functions for data processing"
    );
  });

  test("respects TLDR insertion point after shebang and directives", async () => {
    const sourceDir = join(workspace, "src");
    await mkdir(sourceDir, { recursive: true });
    const sourcePath = join(sourceDir, "script.ts");
    await writeFile(
      sourcePath,
      `#!/usr/bin/env node
"use strict";
/**
 * CLI entry point for the application.
 */
export function main() {}
`,
      "utf8"
    );

    const parsed = buildSeedArgs({
      paths: [sourcePath],
      options: { write: true },
    });

    const config = resolveConfig({});
    const context: CommandContext = {
      config,
      workspaceRoot: workspace,
      globalOptions: {},
    };

    const result = await runSeedCommand(parsed, context);
    expect(result.exitCode).toBe(0);
    expect(result.summary.inserted).toBe(1);

    const fileContents = await readFile(sourcePath, "utf8");
    // TLDR should be after shebang and use strict, but before the docstring
    const lines = fileContents.split("\n");
    const shebangIndex = lines.findIndex((l) => l.startsWith("#!"));
    const useStrictIndex = lines.findIndex((l) => l.includes("use strict"));
    const tldrIndex = lines.findIndex((l) => l.includes("tldr :::"));
    expect(tldrIndex).toBeGreaterThan(shebangIndex);
    expect(tldrIndex).toBeGreaterThan(useStrictIndex);
  });

  test("is idempotent - running twice produces same result", async () => {
    const sourceDir = join(workspace, "src");
    await mkdir(sourceDir, { recursive: true });
    const sourcePath = join(sourceDir, "idempotent.ts");
    await writeFile(
      sourcePath,
      `/**
 * Test for idempotency.
 */
export function idempotent() {}
`,
      "utf8"
    );

    const config = resolveConfig({});
    const context: CommandContext = {
      config,
      workspaceRoot: workspace,
      globalOptions: {},
    };

    // First run
    const parsed1 = buildSeedArgs({
      paths: [sourcePath],
      options: { write: true },
    });
    const result1 = await runSeedCommand(parsed1, context);
    expect(result1.summary.inserted).toBe(1);

    const contentAfterFirst = await readFile(sourcePath, "utf8");

    // Second run
    const parsed2 = buildSeedArgs({
      paths: [sourcePath],
      options: { write: true },
    });
    const result2 = await runSeedCommand(parsed2, context);
    expect(result2.summary.skipped).toBe(1);
    expect(result2.summary.inserted).toBe(0);

    const contentAfterSecond = await readFile(sourcePath, "utf8");
    expect(contentAfterSecond).toBe(contentAfterFirst);
  });
});
