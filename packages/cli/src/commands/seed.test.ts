// tldr ::: unit tests for wm init seed command (discovery mode)

import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { resolveConfig } from "@waymarks/core";

import type { CommandContext } from "../types";
import { buildSeedArgs, runSeedCommand } from "./seed";

describe("buildSeedArgs", () => {
  test("defaults to docstrings when no flags specified", () => {
    const parsed = buildSeedArgs({
      paths: ["src/"],
      options: {},
    });

    expect(parsed.paths).toEqual(["src/"]);
    expect(parsed.options.docstrings).toBe(true);
    expect(parsed.options.codetags).toBe(false);
    expect(parsed.options.all).toBe(false);
  });

  test("parses --docstrings flag", () => {
    const parsed = buildSeedArgs({
      paths: ["src/"],
      options: { docstrings: true },
    });

    expect(parsed.options.docstrings).toBe(true);
    expect(parsed.options.codetags).toBe(false);
  });

  test("parses --codetags flag", () => {
    const parsed = buildSeedArgs({
      paths: ["src/"],
      options: { codetags: true },
    });

    expect(parsed.options.docstrings).toBe(false);
    expect(parsed.options.codetags).toBe(true);
  });

  test("parses --all flag enables both", () => {
    const parsed = buildSeedArgs({
      paths: ["src/"],
      options: { all: true },
    });

    expect(parsed.options.docstrings).toBe(true);
    expect(parsed.options.codetags).toBe(true);
    expect(parsed.options.all).toBe(true);
  });

  test("parses --json flag", () => {
    const parsed = buildSeedArgs({
      paths: ["src/"],
      options: { json: true },
    });

    expect(parsed.options.json).toBe(true);
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

  test("discovers docstring candidate", async () => {
    const sourceDir = join(workspace, "src");
    await mkdir(sourceDir, { recursive: true });
    const sourcePath = join(sourceDir, "service.ts");
    // File-level docstring with @module tag
    await writeFile(
      sourcePath,
      `/**
 * Handles user authentication and session management.
 * @module
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
    expect(result.summary.candidates).toBe(1);
    expect(result.summary.bySource.docstrings).toBe(1);
    expect(result.output).toContain("TLDR candidate");
    expect(result.output).toContain("docstring");
    expect(result.output).toContain(
      "Handles user authentication and session management"
    );
  });

  test("discovers codetag candidate when --codetags enabled", async () => {
    const sourceDir = join(workspace, "src");
    await mkdir(sourceDir, { recursive: true });
    const sourcePath = join(sourceDir, "utils.ts");
    await writeFile(
      sourcePath,
      `// TODO: refactor this module for better performance
export function slowFunction() {
  // implementation
}
`,
      "utf8"
    );

    const parsed = buildSeedArgs({
      paths: [sourcePath],
      options: { codetags: true },
    });

    const config = resolveConfig({});
    const context: CommandContext = {
      config,
      workspaceRoot: workspace,
      globalOptions: {},
    };

    const result = await runSeedCommand(parsed, context);
    expect(result.exitCode).toBe(0);
    expect(result.summary.candidates).toBe(1);
    expect(result.summary.bySource.codetags).toBe(1);
    expect(result.output).toContain("codetag");
    expect(result.output).toContain("TODO");
  });

  test("discovers both sources with --all", async () => {
    const sourceDir = join(workspace, "src");
    await mkdir(sourceDir, { recursive: true });

    // File with docstring
    await writeFile(
      join(sourceDir, "auth.ts"),
      `/**
 * Authentication utilities.
 * @module
 */
export function login() {}
`,
      "utf8"
    );

    // File with codetag
    await writeFile(
      join(sourceDir, "utils.ts"),
      `// TODO: optimize this module
export function slow() {}
`,
      "utf8"
    );

    const parsed = buildSeedArgs({
      paths: [sourceDir],
      options: { all: true },
    });

    const config = resolveConfig({});
    const context: CommandContext = {
      config,
      workspaceRoot: workspace,
      globalOptions: {},
    };

    const result = await runSeedCommand(parsed, context);
    expect(result.exitCode).toBe(0);
    expect(result.summary.candidates).toBe(2);
    expect(result.summary.bySource.docstrings).toBe(1);
    expect(result.summary.bySource.codetags).toBe(1);
  });

  test("skips files that already have TLDRs", async () => {
    const sourceDir = join(workspace, "src");
    await mkdir(sourceDir, { recursive: true });
    const sourcePath = join(sourceDir, "existing.ts");
    await writeFile(
      sourcePath,
      `// tldr ::: already has a summary
/**
 * This file has a docstring but already has a TLDR.
 * @module
 */
export function existing() {}
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
    expect(result.summary.candidates).toBe(0);
    expect(result.summary.skipped).toBe(1);
    expect(result.output).toContain("No TLDR candidates found");
  });

  test("skips function-level docstrings", async () => {
    const sourceDir = join(workspace, "src");
    await mkdir(sourceDir, { recursive: true });
    const sourcePath = join(sourceDir, "functionDoc.ts");
    // This file has a docstring, but it's for the function, not the file
    await writeFile(
      sourcePath,
      `/**
 * Formats a date for display in the UI.
 * @param date - The date to format
 * @returns Formatted date string
 */
export function formatDate(date: Date): string {
  return new Intl.DateTimeFormat('en-US').format(date);
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
    expect(result.summary.candidates).toBe(0);
    expect(result.summary.skipped).toBe(1);
  });

  test("outputs JSON format when --json is set", async () => {
    const sourceDir = join(workspace, "src");
    await mkdir(sourceDir, { recursive: true });
    const sourcePath = join(sourceDir, "json-test.ts");
    await writeFile(
      sourcePath,
      `/**
 * Test function for JSON output.
 * @module
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
    expect(json).toHaveProperty("candidates");
    expect(json).toHaveProperty("summary");
    expect(json.candidates).toHaveLength(1);
    expect(json.candidates[0]).toHaveProperty("file");
    expect(json.candidates[0]).toHaveProperty("source", "docstring");
    expect(json.candidates[0]).toHaveProperty("content");
    expect(json.candidates[0]).toHaveProperty("insertionPoint");
  });

  test("outputs JSONL format when --jsonl is set", async () => {
    const sourceDir = join(workspace, "src");
    await mkdir(sourceDir, { recursive: true });
    const sourcePath = join(sourceDir, "jsonl-test.ts");
    await writeFile(
      sourcePath,
      `/**
 * Test function for JSONL output.
 * @module
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

    // First line should be a candidate
    const firstLine = lines[0];
    expect(firstLine).toBeDefined();
    const parsedFirst = JSON.parse(firstLine as string);
    expect(parsedFirst).toHaveProperty("file");
    expect(parsedFirst).toHaveProperty("source");

    // Last line should be summary
    const lastLine = lines.at(-1);
    expect(lastLine).toBeDefined();
    const parsedLast = JSON.parse(lastLine as string);
    expect(parsedLast).toHaveProperty("summary");
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
    expect(result.summary.candidates).toBe(1);
    expect(result.output).toContain("Utility functions for data processing");
  });

  test("reports insertion point for agents", async () => {
    const sourceDir = join(workspace, "src");
    await mkdir(sourceDir, { recursive: true });
    const sourcePath = join(sourceDir, "with-shebang.ts");
    await writeFile(
      sourcePath,
      `#!/usr/bin/env node
/**
 * CLI entry point.
 * @module
 */
export function main() {}
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
    expect(json.candidates[0].insertionPoint).toBeGreaterThan(1); // After shebang
  });

  test("detects FIXME codetags", async () => {
    const sourceDir = join(workspace, "src");
    await mkdir(sourceDir, { recursive: true });
    const sourcePath = join(sourceDir, "fixme.ts");
    await writeFile(
      sourcePath,
      `// FIXME: memory leak in event handler
export function leaky() {}
`,
      "utf8"
    );

    const parsed = buildSeedArgs({
      paths: [sourcePath],
      options: { codetags: true },
    });

    const config = resolveConfig({});
    const context: CommandContext = {
      config,
      workspaceRoot: workspace,
      globalOptions: {},
    };

    const result = await runSeedCommand(parsed, context);
    expect(result.exitCode).toBe(0);
    expect(result.summary.candidates).toBe(1);
    expect(result.output).toContain("FIXME");
    expect(result.output).toContain("memory leak");
  });

  test("does not modify files (discovery only)", async () => {
    const sourceDir = join(workspace, "src");
    await mkdir(sourceDir, { recursive: true });
    const sourcePath = join(sourceDir, "readonly.ts");
    const originalContent = `/**
 * This file should not be modified.
 * @module
 */
export function untouched() {}
`;
    await writeFile(sourcePath, originalContent, "utf8");

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
    expect(result.summary.candidates).toBe(1);

    // Verify file was not modified
    const { readFile } = await import("node:fs/promises");
    const afterContent = await readFile(sourcePath, "utf8");
    expect(afterContent).toBe(originalContent);
  });
});
