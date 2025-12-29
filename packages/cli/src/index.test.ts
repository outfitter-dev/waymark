// tldr ::: smoke and snapshot tests for waymark CLI handlers

import { describe, expect, spyOn, test } from "bun:test";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { resolveConfig } from "@waymarks/core";
import type { Command } from "commander";
import { findRecords } from "./commands/find";
import { formatFile } from "./commands/fmt";
import { graphRecords } from "./commands/graph";
import { lintFiles } from "./commands/lint";
import type { ModifyPayload } from "./commands/modify";
import { parseScanArgs, scanRecords } from "./commands/scan";
import {
  runUnifiedCommand,
  type UnifiedCommandResult,
} from "./commands/unified/index";
import { parseUnifiedArgs } from "./commands/unified/parser";
import type { UnifiedCommandOptions } from "./commands/unified/types";
import { runCli } from "./index";
import type { CommandContext } from "./types";
import { renderRecords } from "./utils/output";

// Test helpers
const __test = {
  async createProgram() {
    const { createProgram } = await import("./index");
    return createProgram();
  },
};

async function runCliCaptured(
  args: string[]
): Promise<{ exitCode: number; stdout: string; stderr: string }> {
  const result = await runCli(args);
  return { exitCode: result.exitCode, stdout: "", stderr: "" };
}

const defaultContext: CommandContext = {
  config: resolveConfig(),
  globalOptions: {},
  workspaceRoot: process.cwd(),
};

async function runUnified(
  options: UnifiedCommandOptions
): Promise<UnifiedCommandResult> {
  return await runUnifiedCommand(options, defaultContext);
}

async function runUnifiedOutput(
  options: UnifiedCommandOptions
): Promise<string> {
  const result = await runUnified(options);
  return result.output;
}

function stripAnsi(value: string): string {
  return value.replaceAll("\u001b", "").replace(/\[[0-9;]*m/g, "");
}

async function withTempFile(
  content: string,
  ext = ".ts"
): Promise<{
  dir: string;
  file: string;
  cleanup: () => Promise<void>;
}> {
  const dir = await mkdtemp(join(tmpdir(), "waymark-cli-"));
  const file = join(dir, `sample${ext}`);
  await writeFile(file, content, "utf8");
  return {
    dir,
    file,
    cleanup: () => rm(dir, { recursive: true, force: true }),
  };
}

describe("CLI handlers", () => {
  test("format command normalizes types", async () => {
    const { file, cleanup } = await withTempFile("// TODO ::: needs cleanup\n");
    const { formattedText, edits } = await formatFile(
      {
        filePath: file,
        write: false,
      },
      defaultContext
    );
    expect(formattedText).toBe("// todo ::: needs cleanup\n");
    expect(edits).toHaveLength(1);
    await cleanup();
  });

  test("scan command parses waymarks", async () => {
    const source = ["// todo ::: implement feature", "// note ::: helper"].join(
      "\n"
    );
    const { file, cleanup } = await withTempFile(source);
    const records = await scanRecords([file], defaultContext.config);
    expect(records).toHaveLength(2);
    expect(records[0]?.type).toBe("todo");
    await cleanup();
  });

  test("scan command includes legacy codetags when enabled", async () => {
    const source = "// TODO: legacy task";
    const { file, cleanup } = await withTempFile(source);
    const records = await scanRecords([file], {
      ...defaultContext.config,
      scan: { ...defaultContext.config.scan, includeCodetags: true },
    });
    const legacy = records.find((record) => record.legacy);
    expect(legacy).toBeDefined();
    expect(legacy?.type).toBe("todo");
    expect(legacy?.contentText).toBe("legacy task");
    await cleanup();
  });

  test("scan command parses directories recursively", async () => {
    const { dir, cleanup } = await withTempFile("// todo ::: root\n");
    const nested = join(dir, "nested");
    await mkdir(nested);
    await writeFile(join(nested, "child.ts"), "// note ::: child", "utf8");

    const records = await scanRecords([dir], defaultContext.config);

    expect(records.map((record) => record.type)).toEqual(["todo", "note"]);
    await cleanup();
  });

  test("scan command respects .gitignore patterns", async () => {
    // Create temp directory structure with .gitignore
    const dir = await mkdtemp(join(tmpdir(), "waymark-gitignore-"));

    // Create .gitignore
    await writeFile(
      join(dir, ".gitignore"),
      ["dist/", "*.log", ".cache/", "ignored-dir/"].join("\n"),
      "utf8"
    );

    // Create files that should be scanned
    await writeFile(join(dir, "src.ts"), "// todo ::: should appear", "utf8");
    await writeFile(join(dir, "README.md"), "<!-- tldr ::: docs -->", "utf8");

    // Create files/dirs that should be ignored
    const distDir = join(dir, "dist");
    await mkdir(distDir);
    await writeFile(
      join(distDir, "bundle.ts"),
      "// todo ::: should NOT appear",
      "utf8"
    );

    await writeFile(
      join(dir, "debug.log"),
      "// note ::: should NOT appear",
      "utf8"
    );

    const cacheDir = join(dir, ".cache");
    await mkdir(cacheDir);
    await writeFile(
      join(cacheDir, "data.ts"),
      "// fix ::: should NOT appear",
      "utf8"
    );

    const ignoredDir = join(dir, "ignored-dir");
    await mkdir(ignoredDir);
    await writeFile(
      join(ignoredDir, "file.ts"),
      "// wip ::: should NOT appear",
      "utf8"
    );

    // Scan the directory
    const records = await scanRecords([dir], defaultContext.config);

    // Should only find waymarks from non-ignored files
    expect(records).toHaveLength(2);
    expect(records.map((r) => r.type).sort()).toEqual(["tldr", "todo"]);
    expect(records.every((r) => !r.file.includes("dist"))).toBe(true);
    expect(records.every((r) => !r.file.includes(".log"))).toBe(true);
    expect(records.every((r) => !r.file.includes(".cache"))).toBe(true);
    expect(records.every((r) => !r.file.includes("ignored-dir"))).toBe(true);

    // Cleanup
    await rm(dir, { recursive: true, force: true });
  });

  test("skipPaths from config excludes files without gitignore", async () => {
    const dir = await mkdtemp(join(tmpdir(), "waymark-skip-"));

    // No .gitignore file - relying on config only
    await writeFile(join(dir, "src.ts"), "// todo ::: should appear", "utf8");

    const tempDir = join(dir, "temp");
    await mkdir(tempDir);
    await writeFile(
      join(tempDir, "data.ts"),
      "// fix ::: should NOT appear",
      "utf8"
    );

    const buildDir = join(dir, "build");
    await mkdir(buildDir);
    await writeFile(
      join(buildDir, "output.ts"),
      "// note ::: should NOT appear",
      "utf8"
    );

    // Custom config with skipPaths
    const config = resolveConfig({
      skipPaths: ["**/temp/**", "**/build/**"],
    });

    const records = await scanRecords([dir], config);

    expect(records).toHaveLength(1);
    expect(records[0]?.type).toBe("todo");
    expect(records[0]?.contentText).toBe("should appear");
    expect(records.every((r) => !r.file.includes("temp"))).toBe(true);
    expect(records.every((r) => !r.file.includes("build"))).toBe(true);

    await rm(dir, { recursive: true, force: true });
  });

  test("includePaths override gitignore and skipPaths", async () => {
    const dir = await mkdtemp(join(tmpdir(), "waymark-include-"));

    // Create .gitignore excluding dist/
    await writeFile(join(dir, ".gitignore"), "dist/\n", "utf8");

    // Create dist/ with an important file
    const distDir = join(dir, "dist");
    await mkdir(distDir);
    await writeFile(
      join(distDir, "important.ts"),
      "// tldr ::: should appear despite gitignore",
      "utf8"
    );
    await writeFile(
      join(distDir, "other.ts"),
      "// fix ::: should NOT appear",
      "utf8"
    );

    // Create build/ that will be in skipPaths
    const buildDir = join(dir, "build");
    await mkdir(buildDir);
    await writeFile(
      join(buildDir, "critical.ts"),
      "// note ::: should appear despite skipPaths",
      "utf8"
    );
    await writeFile(
      join(buildDir, "other.ts"),
      "// todo ::: should NOT appear",
      "utf8"
    );

    // Config with skipPaths and includePaths
    const config = resolveConfig({
      skipPaths: ["**/build/**"],
      includePaths: ["**/important.ts", "**/critical.ts"],
    });

    const records = await scanRecords([dir], config);

    expect(records).toHaveLength(2);
    expect(records.map((r) => r.type).sort()).toEqual(["note", "tldr"]);
    expect(records.some((r) => r.file.includes("important.ts"))).toBe(true);
    expect(records.some((r) => r.file.includes("critical.ts"))).toBe(true);
    expect(records.every((r) => !r.file.includes("other.ts"))).toBe(true);

    await rm(dir, { recursive: true, force: true });
  });

  test("respectGitignore: false ignores .gitignore patterns", async () => {
    const dir = await mkdtemp(join(tmpdir(), "waymark-no-gitignore-"));

    // Create .gitignore
    await writeFile(join(dir, ".gitignore"), "temp/\n", "utf8");

    // Create temp/ directory
    const tempDir = join(dir, "temp");
    await mkdir(tempDir);
    await writeFile(
      join(tempDir, "data.ts"),
      "// todo ::: should appear when respectGitignore is false",
      "utf8"
    );
    await writeFile(join(dir, "src.ts"), "// note ::: always appears", "utf8");

    // Config disabling gitignore
    const config = resolveConfig({
      respectGitignore: false,
    });

    const records = await scanRecords([dir], config);

    expect(records).toHaveLength(2);
    expect(records.map((r) => r.type).sort()).toEqual(["note", "todo"]);
    expect(records.some((r) => r.file.includes("temp"))).toBe(true);

    await rm(dir, { recursive: true, force: true });
  });

  test("priority system: includePaths > skipPaths > gitignore", async () => {
    const dir = await mkdtemp(join(tmpdir(), "waymark-priority-"));

    // .gitignore excludes logs/
    await writeFile(join(dir, ".gitignore"), "logs/\n", "utf8");

    // Regular file (no ignore rules)
    await writeFile(
      join(dir, "src.ts"),
      "// note ::: level 0: no rules",
      "utf8"
    );

    // logs/ excluded by gitignore
    const logsDir = join(dir, "logs");
    await mkdir(logsDir);
    await writeFile(
      join(logsDir, "debug.ts"),
      "// fix ::: level 1: gitignore blocks",
      "utf8"
    );
    await writeFile(
      join(logsDir, "important.ts"),
      "// tldr ::: level 3: includePaths overrides gitignore",
      "utf8"
    );

    // temp/ excluded by skipPaths
    const tempDir = join(dir, "temp");
    await mkdir(tempDir);
    await writeFile(
      join(tempDir, "cache.ts"),
      "// wip ::: level 2: skipPaths blocks",
      "utf8"
    );
    await writeFile(
      join(tempDir, "critical.ts"),
      "// todo ::: level 3: includePaths overrides skipPaths",
      "utf8"
    );

    // Config with all three ignore mechanisms
    const config = resolveConfig({
      skipPaths: ["**/temp/**"],
      includePaths: ["**/important.ts", "**/critical.ts"],
      respectGitignore: true,
    });

    const records = await scanRecords([dir], config);

    // Should get: src.ts (no rules), important.ts (includePaths), critical.ts (includePaths)
    const ExpectedRecordCount = 3;
    expect(records).toHaveLength(ExpectedRecordCount);
    expect(records.map((r) => r.type).sort()).toEqual(["note", "tldr", "todo"]);
    expect(records.some((r) => r.file.includes("src.ts"))).toBe(true);
    expect(records.some((r) => r.file.includes("important.ts"))).toBe(true);
    expect(records.some((r) => r.file.includes("critical.ts"))).toBe(true);
    expect(records.every((r) => !r.file.includes("debug.ts"))).toBe(true);
    expect(records.every((r) => !r.file.includes("cache.ts"))).toBe(true);

    await rm(dir, { recursive: true, force: true });
  });

  test("parseScanArgs detects jsonl format", () => {
    const parsed = parseScanArgs(["--jsonl", "sample.ts"]);
    expect(parsed.format).toBe("jsonl");
    expect(parsed.filePaths).toEqual(["sample.ts"]);
  });

  test("renderRecords formats jsonl output", async () => {
    const source = ["// tldr ::: summary", "// todo ::: follow up"].join("\n");
    const { file, cleanup } = await withTempFile(source);
    const records = await scanRecords([file], defaultContext.config);
    const jsonl = renderRecords(records, "jsonl");
    const lines = jsonl.split("\n").filter(Boolean);
    expect(lines).toHaveLength(2);
    const parsed = lines.map((line) => JSON.parse(line) as { type: string });
    expect(parsed[0]?.type).toBe("tldr");
    expect(parsed[1]?.type).toBe("todo");
    await cleanup();
  });

  test("renderRecords formats text output with indentation", async () => {
    const source = "// todo ::: detailed task";
    const { file, cleanup } = await withTempFile(source);
    const records = await scanRecords([file], defaultContext.config);
    const text = renderRecords(records, "text");
    expect(text).toContain("\n  {");
    expect(() => JSON.parse(text)).not.toThrow();
    await cleanup();
  });

  test("graph command captures relations", async () => {
    const source = [
      "// tldr ::: root ref:#docs/root",
      "// todo ::: follow-up depends:#docs/root",
    ].join("\n");
    const { file, cleanup } = await withTempFile(source);
    const edges = await graphRecords([file], defaultContext.config);
    expect(edges).toHaveLength(2);
    expect(edges[0]?.relation).toBe("ref");
    expect(edges[1]?.relation).toBe("depends");
    await cleanup();
  });

  test("find command filters by type", async () => {
    const source = ["// tldr ::: summary", "// todo ::: task"].join("\n");
    const { file, cleanup } = await withTempFile(source);
    const matches = await findRecords({
      filePath: file,
      types: ["todo"],
      config: defaultContext.config,
    });
    expect(matches).toHaveLength(1);
    expect(matches[0]?.type).toBe("todo");
    expect(matches[0]?.contentText).toBe("task");
    await cleanup();
  });

  test("lint command detects invalid markers", async () => {
    const source = ["// todooo ::: typo marker", "// todo ::: ok"].join("\n");
    const { file, cleanup } = await withTempFile(source);
    const report = await lintFiles(
      [file],
      defaultContext.config.allowTypes,
      defaultContext.config
    );
    expect(report.issues).toHaveLength(1);
    const issue = report.issues[0];
    expect(issue?.rule).toBe("unknown-marker");
    expect(issue?.severity).toBe("warn");
    expect(issue?.type).toBe("todooo");
    await cleanup();
  });

  test("lint command detects duplicate properties", async () => {
    const source = "// todo ::: owner:@alice owner:@bob\n";
    const { file, cleanup } = await withTempFile(source);
    const report = await lintFiles(
      [file],
      defaultContext.config.allowTypes,
      defaultContext.config
    );
    const duplicateIssue = report.issues.find(
      (issue) => issue.rule === "duplicate-property"
    );
    expect(duplicateIssue).toBeDefined();
    expect(duplicateIssue?.line).toBe(1);
    await cleanup();
  });

  test("lint command detects multiple tldr waymarks", async () => {
    const source = ["// tldr ::: one", "// tldr ::: two"].join("\n");
    const { file, cleanup } = await withTempFile(source);
    const report = await lintFiles(
      [file],
      defaultContext.config.allowTypes,
      defaultContext.config
    );
    const tldrIssue = report.issues.find(
      (issue) => issue.rule === "multiple-tldr"
    );
    expect(tldrIssue).toBeDefined();
    expect(tldrIssue?.severity).toBe("error");
    expect(tldrIssue?.line).toBe(2);
    await cleanup();
  });

  test("lint command detects legacy codetags", async () => {
    const source = ["// TODO: legacy task", "// note ::: ok"].join("\n");
    const { file, cleanup } = await withTempFile(source);
    const report = await lintFiles(
      [file],
      defaultContext.config.allowTypes,
      defaultContext.config
    );
    const legacyIssue = report.issues.find(
      (issue) => issue.rule === "legacy-pattern"
    );
    expect(legacyIssue).toBeDefined();
    expect(legacyIssue?.severity).toBe("warn");
    expect(legacyIssue?.line).toBe(1);
    await cleanup();
  });
});

describe("Unified command", () => {
  test("parseUnifiedArgs detects graph mode", () => {
    const options = parseUnifiedArgs(["--graph", "src/"]);
    expect(options.isGraphMode).toBe(true);
    expect(options.filePaths).toEqual(["src/"]);
  });

  test("parseUnifiedArgs extracts type filters", () => {
    const options = parseUnifiedArgs(["--type", "todo", "-t", "fix", "src/"]);
    expect(options.types).toEqual(["todo", "fix"]);
    expect(options.filePaths).toEqual(["src/"]);
  });

  test("parseUnifiedArgs extracts tag filters", () => {
    const options = parseUnifiedArgs([
      "--tag",
      "#perf",
      "--tag",
      "sec",
      "src/",
    ]);
    expect(options.tags).toEqual(["#perf", "sec"]);
  });

  test("parseUnifiedArgs extracts mention filters", () => {
    const options = parseUnifiedArgs([
      "--mention",
      "@alice",
      "--mention",
      "agent",
      "src/",
    ]);
    expect(options.mentions).toEqual(["@alice", "agent"]);
  });

  test("parseUnifiedArgs detects json output format", () => {
    const options = parseUnifiedArgs(["--json", "src/"]);
    expect(options.outputFormat).toBe("json");
  });

  test("parseUnifiedArgs detects jsonl output format", () => {
    const options = parseUnifiedArgs(["--jsonl", "src/"]);
    expect(options.outputFormat).toBe("jsonl");
  });

  test("parseUnifiedArgs accepts --after-context alias", () => {
    const afterLines = 2;
    const options = parseUnifiedArgs([
      "--after-context",
      String(afterLines),
      "src/",
    ]);
    expect(options.contextAfter).toBe(afterLines);
  });

  test("parseUnifiedArgs accepts --before-context alias", () => {
    const beforeLines = 3;
    const options = parseUnifiedArgs([
      "--before-context",
      String(beforeLines),
      "src/",
    ]);
    expect(options.contextBefore).toBe(beforeLines);
  });

  test("parseUnifiedArgs detects raised signal filter", () => {
    const options = parseUnifiedArgs(["--raised", "src/"]);
    expect(options.raised).toBe(true);
  });

  test("parseUnifiedArgs detects starred signal filter", () => {
    const options = parseUnifiedArgs(["--starred", "src/"]);
    expect(options.starred).toBe(true);
  });

  test("parseUnifiedArgs combines multiple filters", () => {
    const options = parseUnifiedArgs([
      "--type",
      "todo",
      "--raised",
      "--tag",
      "perf",
      "src/",
    ]);
    expect(options.types).toEqual(["todo"]);
    expect(options.raised).toBe(true);
    expect(options.tags).toEqual(["perf"]);
  });

  test("runUnifiedCommand handles graph mode", async () => {
    const source = [
      "// tldr ::: root ref:#test/root",
      "// todo ::: depends:#test/root",
    ].join("\n");
    const { file, cleanup } = await withTempFile(source);

    const output = await runUnifiedOutput({
      filePaths: [file],
      isGraphMode: true,
    });

    const lines = output.split("\n").filter(Boolean);
    expect(lines).toHaveLength(2);
    await cleanup();
  });

  test("runUnifiedCommand applies type filter", async () => {
    const source = ["// tldr ::: summary", "// todo ::: work"].join("\n");
    const { file, cleanup } = await withTempFile(source);

    const output = await runUnifiedOutput({
      filePaths: [file],
      isGraphMode: false,
      types: ["todo"],
      outputFormat: "json",
    });

    const parsed = JSON.parse(output) as Array<{ type: string }>;
    expect(parsed).toHaveLength(1);
    expect(parsed[0]?.type).toBe("todo");
    await cleanup();
  });

  test("runUnifiedCommand applies raised signal filter", async () => {
    const source = ["// ^todo ::: raised work", "// todo ::: normal work"].join(
      "\n"
    );
    const { file, cleanup } = await withTempFile(source);

    const output = await runUnifiedOutput({
      filePaths: [file],
      isGraphMode: false,
      raised: true,
      outputFormat: "json",
    });

    const parsed = JSON.parse(output) as Array<{
      signals: { raised: boolean };
    }>;
    expect(parsed).toHaveLength(1);
    expect(parsed[0]?.signals.raised).toBe(true);
    await cleanup();
  });

  test("runUnifiedCommand applies starred signal filter", async () => {
    const source = ["// *fix ::: important bug", "// fix ::: normal fix"].join(
      "\n"
    );
    const { file, cleanup } = await withTempFile(source);

    const output = await runUnifiedOutput({
      filePaths: [file],
      isGraphMode: false,
      starred: true,
      outputFormat: "json",
    });

    const parsed = JSON.parse(output) as Array<{
      signals: { important: boolean };
    }>;
    expect(parsed).toHaveLength(1);
    expect(parsed[0]?.signals.important).toBe(true);
    await cleanup();
  });

  test("runUnifiedCommand combines multiple filters", async () => {
    const source = [
      "// ^*todo ::: critical task #perf",
      "// ^todo ::: raised work",
      "// *fix ::: important bug",
      "// note ::: context",
    ].join("\n");
    const { file, cleanup } = await withTempFile(source);

    const output = await runUnifiedOutput({
      filePaths: [file],
      isGraphMode: false,
      types: ["todo"],
      raised: true,
      starred: true,
      tags: ["#perf"],
      outputFormat: "json",
    });

    const parsed = JSON.parse(output) as Array<{
      type: string;
      signals: { raised: boolean; important: boolean };
    }>;
    expect(parsed).toHaveLength(1);
    expect(parsed[0]?.type).toBe("todo");
    expect(parsed[0]?.signals.raised).toBe(true);
    expect(parsed[0]?.signals.important).toBe(true);
    await cleanup();
  });

  test("runUnifiedCommand supports long display mode", async () => {
    const source = "// todo ::: @alice fix bug #perf";
    const { file, cleanup } = await withTempFile(source);

    const output = await runUnifiedOutput({
      filePaths: [file],
      isGraphMode: false,
      displayMode: "long",
    });

    expect(output).toContain("Type: todo");
    expect(output).toContain("Signals: raised=false, starred=false");
    expect(output).toContain("Content: @alice fix bug #perf");
    expect(output).toContain("Mentions: @alice");
    expect(output).toContain("Tags: #perf");
    await cleanup();
  });

  test("runUnifiedCommand supports tree display mode", async () => {
    const source = "// todo ::: fix bug\n// fix ::: handle error";
    const { file, cleanup } = await withTempFile(source);

    const output = await runUnifiedOutput({
      filePaths: [file],
      isGraphMode: false,
      displayMode: "tree",
    });

    expect(output).toContain("└─");
    expect(output).toContain("todo - fix bug");
    expect(output).toContain("fix - handle error");
    await cleanup();
  });

  test("runUnifiedCommand supports flat display mode", async () => {
    const source = "// todo ::: fix bug\n// fix ::: handle error";
    const { file, cleanup } = await withTempFile(source);

    const output = await runUnifiedOutput({
      filePaths: [file],
      isGraphMode: false,
      displayMode: "flat",
    });

    const lines = output.split("\n");
    expect(lines).toHaveLength(2);
    expect(lines[0]).toContain("// todo ::: fix bug");
    expect(lines[1]).toContain("// fix ::: handle error");
    await cleanup();
  });

  test("runUnifiedCommand supports context display", async () => {
    const source = [
      "function example() {",
      "  // todo ::: fix bug",
      "  return true;",
      "}",
    ].join("\n");
    const { file, cleanup } = await withTempFile(source);

    const output = await runUnifiedOutput({
      filePaths: [file],
      isGraphMode: false,
      contextAround: 1,
    });

    expect(output).toContain("function example() {");
    expect(output).toContain("// todo ::: fix bug");
    expect(output).toContain("return true;");
    await cleanup();
  });

  test("runUnifiedCommand supports grouping by type", async () => {
    const source =
      "// todo ::: task one\n// fix ::: bug fix\n// todo ::: task two";
    const { file, cleanup } = await withTempFile(source);

    const output = await runUnifiedOutput({
      filePaths: [file],
      isGraphMode: false,
      groupBy: "type",
    });

    expect(output).toContain("=== fix ===");
    expect(output).toContain("=== todo ===");
    expect(output).toContain("task one");
    expect(output).toContain("task two");
    await cleanup();
  });

  test("runUnifiedCommand supports sorting by file", async () => {
    const dir = await mkdtemp(join(tmpdir(), "waymark-sort-"));
    const file1 = join(dir, "a.ts");
    const file2 = join(dir, "b.ts");
    await writeFile(file1, "// todo ::: task in a", "utf8");
    await writeFile(file2, "// fix ::: bug in b", "utf8");

    const output = await runUnifiedOutput({
      filePaths: [dir],
      isGraphMode: false,
      sortBy: "file",
    });

    // With enhanced formatter, file headers are separate lines
    const lines = stripAnsi(output).split("\n");
    const fileHeaders = lines.filter(
      (l) => l.endsWith(".ts") && !l.includes(":::")
    );
    expect(fileHeaders[0]).toContain("a.ts");
    expect(fileHeaders[1]).toContain("b.ts");
    await rm(dir, { recursive: true, force: true });
  });

  test("runUnifiedCommand supports pagination with limit", async () => {
    const source = [
      "// todo ::: task one",
      "// todo ::: task two",
      "// todo ::: task three",
      "// todo ::: task four",
    ].join("\n");
    const { file, cleanup } = await withTempFile(source);

    const output = await runUnifiedOutput({
      filePaths: [file],
      isGraphMode: false,
      limit: 2,
    });

    const lines = output.split("\n").filter((l) => l.includes(":::"));
    expect(lines).toHaveLength(2);
    expect(lines[0]).toContain("task one");
    expect(lines[1]).toContain("task two");
    await cleanup();
  });

  test("runUnifiedCommand combines display options", async () => {
    const source = [
      "// todo ::: task one",
      "// fix ::: bug fix",
      "// todo ::: task two",
      "// note ::: context",
    ].join("\n");
    const { file, cleanup } = await withTempFile(source);

    const output = await runUnifiedOutput({
      filePaths: [file],
      isGraphMode: false,
      types: ["todo"],
      groupBy: "type",
      sortBy: "line",
      limit: 2,
    });

    expect(output).toContain("=== todo ===");
    expect(output).toContain("task one");
    expect(output).toContain("task two");
    expect(output).not.toContain("bug fix");
    expect(output).not.toContain("context");
    await cleanup();
  });

  test("runUnifiedCommand parses query strings for type filtering", async () => {
    const source = `// todo ::: @agent fix bug #perf
// fix ::: handle error
// note ::: this is a note`;
    const { file, cleanup } = await withTempFile(source);
    const output = await runUnifiedOutput(parseUnifiedArgs([file, "todo"]));
    expect(output).toContain("fix bug");
    expect(output).not.toContain("handle error");
    expect(output).not.toContain("this is a note");
    await cleanup();
  });

  test("runUnifiedCommand parses query strings with mentions", async () => {
    const source = `// todo ::: @agent task one
// todo ::: @alice task two
// fix ::: @agent bug fix`;
    const { file, cleanup } = await withTempFile(source);
    const output = await runUnifiedOutput(parseUnifiedArgs([file, "@agent"]));
    expect(output).toContain("task one");
    expect(output).toContain("bug fix");
    expect(output).not.toContain("task two");
    await cleanup();
  });

  test("runUnifiedCommand parses query strings with tags", async () => {
    const source = `// todo ::: task one #perf
// fix ::: bug fix #sec
// note ::: note text #perf`;
    const { file, cleanup } = await withTempFile(source);
    const output = await runUnifiedOutput(parseUnifiedArgs([file, "#perf"]));
    expect(output).toContain("task one");
    expect(output).toContain("note text");
    expect(output).not.toContain("bug fix");
    await cleanup();
  });

  test("runUnifiedCommand parses complex query strings", async () => {
    const source = `// todo ::: @agent task #perf
// todo ::: @alice different task #perf
// fix ::: @agent bug #sec`;
    const { file, cleanup } = await withTempFile(source);
    const output = stripAnsi(
      await runUnifiedOutput(parseUnifiedArgs([file, "todo @agent #perf"]))
    );
    expect(output).toContain("@agent task #perf");
    expect(output).not.toContain("@alice");
    expect(output).not.toContain("bug #sec");
    await cleanup();
  });

  test("runUnifiedCommand handles exclusions in query strings", async () => {
    const source = `// todo ::: @agent task one
// todo ::: @alice task two
// fix ::: @agent bug fix`;
    const { file, cleanup } = await withTempFile(source);
    const output = await runUnifiedOutput(parseUnifiedArgs([file, "!fix"]));
    expect(output).toContain("task one");
    expect(output).toContain("task two");
    expect(output).not.toContain("bug fix");
    await cleanup();
  });

  test("runUnifiedCommand handles quoted text in query strings", async () => {
    const source = `// todo ::: cache invalidation logic
// fix ::: handle cache miss
// note ::: other content`;
    const { file, cleanup } = await withTempFile(source);
    const output = await runUnifiedOutput(
      parseUnifiedArgs([file, '"cache invalidation"'])
    );
    // Text search currently not implemented in filters, but parse should work
    expect(output).toContain("cache invalidation logic");
    await cleanup();
  });

  test("runUnifiedCommand handles fuzzy type matching", async () => {
    const source = `// todo ::: task one
// fix ::: bug fix
// note ::: note text`;
    const { file, cleanup } = await withTempFile(source);
    const output = await runUnifiedOutput(parseUnifiedArgs([file, "todos"]));
    expect(output).toContain("task one");
    expect(output).not.toContain("bug fix");
    expect(output).not.toContain("note text");
    await cleanup();
  });
});

describe("Commander integration", () => {
  test("find command receives --json flag from Commander", async () => {
    const program = await __test.createProgram();
    const findCommand = program.commands.find(
      (cmd: Command) => cmd.name() === "find"
    );
    expect(findCommand).toBeDefined();

    let receivedOptions: Record<string, unknown> | undefined;
    findCommand?.action(function (
      this: Command,
      _paths: string[],
      options: Record<string, unknown>
    ) {
      receivedOptions =
        typeof this.optsWithGlobals === "function"
          ? this.optsWithGlobals()
          : options;
    });

    await program.parseAsync(["find", "--json", "sample.ts"], { from: "user" });

    expect(receivedOptions?.json).toBe(true);
  });

  test("find command forwards --graph with --json combination", async () => {
    const program = await __test.createProgram();
    const findCommand = program.commands.find(
      (cmd: Command) => cmd.name() === "find"
    );
    expect(findCommand).toBeDefined();

    let receivedOptions: Record<string, unknown> | undefined;
    findCommand?.action(function (
      this: Command,
      _paths: string[],
      options: Record<string, unknown>
    ) {
      receivedOptions =
        typeof this.optsWithGlobals === "function"
          ? this.optsWithGlobals()
          : options;
    });

    await program.parseAsync(["find", "--graph", "--json", "sample.ts"], {
      from: "user",
    });
    expect(receivedOptions?.json).toBe(true);
    expect(receivedOptions?.graph).toBe(true);
  });

  test("add command forwards --json flag to parser", async () => {
    const addModule = await import("./commands/add");
    const contextModule = await import("./utils/context");
    const parseSpy = spyOn(addModule, "parseAddArgs");
    const runSpy = spyOn(addModule, "runAddCommand").mockResolvedValue({
      results: [],
      summary: { total: 0, successful: 0, failed: 0, filesModified: 0 },
      output: "",
      exitCode: 0,
    });
    const contextSpy = spyOn(contextModule, "createContext").mockResolvedValue(
      defaultContext
    );

    try {
      const result = await runCliCaptured([
        "add",
        "src/sample.ts:1",
        "todo",
        "task",
        "--json",
      ]);
      expect(result.exitCode).toBe(0);
      expect(parseSpy).toHaveBeenCalled();
      const tokens = parseSpy.mock.calls[0]?.[0] ?? [];
      expect(tokens).toContain("--json");
      expect(runSpy).toHaveBeenCalled();
      const parsedArgs = runSpy.mock.calls[0]?.[0];
      expect(parsedArgs?.options.json).toBe(true);
    } finally {
      parseSpy.mockRestore();
      runSpy.mockRestore();
      contextSpy.mockRestore();
    }
  });

  test("modify command forwards --json option", async () => {
    const modifyModule = await import("./commands/modify");
    const contextModule = await import("./utils/context");
    const mockPayload: ModifyPayload = {
      preview: false,
      applied: true,
      target: { file: "src/sample.ts", line: 1 },
      modifications: {},
      before: {
        raw: "// todo ::: test",
        type: "todo",
        signals: { raised: false, important: false },
        content: "test",
      },
      after: {
        raw: "// todo ::: test",
        type: "todo",
        signals: { raised: false, important: false },
        content: "test",
      },
      indexRefreshed: false,
      noChange: false,
    };
    const runSpy = spyOn(modifyModule, "runModifyCommand").mockResolvedValue({
      output: "",
      payload: mockPayload,
      exitCode: 0,
    });
    const contextSpy = spyOn(contextModule, "createContext").mockResolvedValue(
      defaultContext
    );

    try {
      const result = await runCliCaptured([
        "modify",
        "src/sample.ts:1",
        "--json",
      ]);
      expect(result.exitCode).toBe(0);
      expect(runSpy).toHaveBeenCalled();
      const optionsArg = runSpy.mock.calls[0]?.[2];
      expect(optionsArg?.json).toBe(true);
    } finally {
      runSpy.mockRestore();
      contextSpy.mockRestore();
    }
  });

  test("remove command forwards --json flag to parser", async () => {
    const removeModule = await import("./commands/remove");
    const contextModule = await import("./utils/context");
    const parseSpy = spyOn(removeModule, "parseRemoveArgs");
    const runSpy = spyOn(removeModule, "runRemoveCommand").mockResolvedValue({
      results: [],
      summary: { total: 0, successful: 0, failed: 0, filesModified: 0 },
      output: "",
      exitCode: 0,
      options: {
        write: false,
        json: true,
        jsonl: false,
      },
    });
    const contextSpy = spyOn(contextModule, "createContext").mockResolvedValue(
      defaultContext
    );

    try {
      const result = await runCliCaptured([
        "remove",
        "src/sample.ts:1",
        "--json",
      ]);
      expect(result.exitCode).toBe(0);
      expect(parseSpy).toHaveBeenCalled();
      const tokens = parseSpy.mock.calls[0]?.[0] ?? [];
      expect(tokens).toContain("--json");
      expect(runSpy).toHaveBeenCalled();
      const parsedArgs = runSpy.mock.calls[0]?.[0];
      expect(parsedArgs?.options.json).toBe(true);
    } finally {
      parseSpy.mockRestore();
      runSpy.mockRestore();
      contextSpy.mockRestore();
    }
  });

  test("root help lists global options only", async () => {
    const result = await runCliCaptured(["--help"]);
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("Global Options:");
    expect(result.stdout).toContain("--json");
    expect(result.stdout).not.toContain("--type <types...>");
  });

  test("wm find --help shows filter options", async () => {
    const result = await runCliCaptured(["find", "--help"]);
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("Filter Options:");
    expect(result.stdout).toContain("--type <types...>");
    expect(result.stdout).toContain("Output Formats:");
  });

  test("other commands do not list find filters", async () => {
    const result = await runCliCaptured(["format", "--help"]);
    expect(result.exitCode).toBe(0);
    expect(result.stdout).not.toContain("--type <types...>");
  });

  test("implicit command emits deprecation warning", async () => {
    const { file, cleanup } = await withTempFile("// todo ::: legacy\n");

    try {
      const result = await runCliCaptured([file]);
      expect(result.exitCode).toBe(0);
      expect(result.stderr).toContain("Implicit command syntax is deprecated");
      expect(result.stdout.length).toBeGreaterThan(0);
    } finally {
      await cleanup();
    }
  });

  test("'wm find' does not emit deprecation warning", async () => {
    const { file, cleanup } = await withTempFile("// todo ::: explicit\n");

    try {
      const result = await runCliCaptured(["find", file, "--json"]);
      expect(result.exitCode).toBe(0);
      expect(result.stderr).toBe("");
      expect(result.stdout.trim().length).toBeGreaterThan(0);
    } finally {
      await cleanup();
    }
  });

  test("find command forwards --graph with --json combination", async () => {
    const program = await __test.createProgram();
    const findCommand = program.commands.find((cmd) => cmd.name() === "find");
    expect(findCommand).toBeDefined();

    let receivedOptions: Record<string, unknown> | undefined;
    findCommand?.action(
      (_paths: string[], options: Record<string, unknown>) => {
        receivedOptions = options;
      }
    );

    await program.parseAsync(["find", "--graph", "--json", "sample.ts"], {
      from: "user",
    });

    expect(receivedOptions?.json).toBe(true);
    expect(receivedOptions?.graph).toBe(true);
  });
});

describe("Logger integration", () => {
  test("logger is created with default warn level", async () => {
    const { logger } = await import("./utils/logger.ts");
    expect(logger.level).toBe("warn");
  });

  test("logger level can be changed dynamically", async () => {
    const { logger } = await import("./utils/logger.ts");
    const originalLevel = logger.level;

    logger.level = "debug";
    expect(logger.level).toBe("debug");

    logger.level = "info";
    expect(logger.level).toBe("info");

    // Restore original level
    logger.level = originalLevel;
  });

  test("logger has all expected methods", async () => {
    const { logger } = await import("./utils/logger.ts");

    expect(typeof logger.trace).toBe("function");
    expect(typeof logger.debug).toBe("function");
    expect(typeof logger.info).toBe("function");
    expect(typeof logger.warn).toBe("function");
    expect(typeof logger.error).toBe("function");
    expect(typeof logger.fatal).toBe("function");
  });
});
