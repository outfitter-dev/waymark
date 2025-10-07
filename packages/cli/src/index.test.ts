// tldr ::: smoke and snapshot tests for waymark CLI handlers

import { describe, expect, test } from "bun:test";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { resolveConfig } from "@waymarks/core";
import { findRecords } from "./commands/find";
import { formatFile } from "./commands/fmt";
import { graphRecords } from "./commands/graph";
import { lintFiles } from "./commands/lint";
import { mapFiles, parseMapArgs } from "./commands/map";
import { migrateFile, migrateLegacyWaymarks } from "./commands/migrate";
import { parseScanArgs, scanRecords } from "./commands/scan";
import {
  runUnifiedCommand,
  type UnifiedCommandResult,
} from "./commands/unified/index";
import { parseUnifiedArgs } from "./commands/unified/parser";
import type { UnifiedCommandOptions } from "./commands/unified/types";
import { formatMapOutput, serializeMap } from "./index";
import type { CommandContext } from "./types";
import { renderRecords } from "./utils/output";

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

  test("renderRecords pretty prints json", async () => {
    const source = "// todo ::: detailed task";
    const { file, cleanup } = await withTempFile(source);
    const records = await scanRecords([file], defaultContext.config);
    const pretty = renderRecords(records, "pretty");
    expect(pretty).toContain("\n  {");
    expect(() => JSON.parse(pretty)).not.toThrow();
    await cleanup();
  });

  test("map command summarizes files", async () => {
    const source = ["// tldr ::: summary", "// todo ::: work"].join("\n");
    const { file, cleanup } = await withTempFile(source);
    const map = await mapFiles([file], defaultContext.config);
    const [summary] = Array.from(map.files.values());
    expect(summary?.tldr?.contentText).toBe("summary");
    expect(summary?.types.get("todo")?.entries).toHaveLength(1);
    await cleanup();
  });

  test("map command walks directories", async () => {
    const { dir, cleanup } = await withTempFile("// tldr ::: root summary\n");
    const nested = join(dir, "docs");
    await mkdir(nested);
    await writeFile(join(nested, "note.ts"), "// todo ::: nested", "utf8");

    const map = await mapFiles([dir], defaultContext.config);
    expect(map.files.size).toBeGreaterThan(0);
    const entries = Array.from(map.files.values()).flatMap((summary) =>
      Array.from(summary.types.values()).flatMap(
        (markerSummary) => markerSummary.entries
      )
    );
    expect(entries.some((record) => record.type === "todo")).toBe(true);
    await cleanup();
  });

  test("parseMapArgs supports type filters and summary flag", () => {
    const parsed = parseMapArgs([
      "--type",
      "todo",
      "-t",
      "fix",
      "--summary",
      "docs/file.ts",
    ]);
    expect(parsed.filePaths).toEqual(["docs/file.ts"]);
    expect(parsed.types).toEqual(["todo", "fix"]);
    expect(parsed.summary).toBe(true);
  });

  test("parseMapArgs throws when type flag lacks value", () => {
    expect(() => parseMapArgs(["--type"])).toThrow("--type requires a value");
  });

  test("serializeMap filters types and adds summary when requested", async () => {
    const source = [
      "// tldr ::: summary",
      "// todo ::: first",
      "// fix ::: patch",
    ].join("\n");
    const { file, cleanup } = await withTempFile(source);
    const map = await mapFiles([file], defaultContext.config);

    const serialized = serializeMap(map, {
      types: ["todo"],
      includeSummary: true,
    });

    const fileEntry = serialized[file] as {
      tldr?: string;
      types: Record<string, number>;
    };
    expect(fileEntry.tldr).toBeUndefined();
    expect(fileEntry.types).toEqual({ todo: 1 });

    const summary = serialized._summary as { types: Record<string, number> };
    expect(summary.types).toEqual({ todo: 1 });

    await cleanup();
  });

  test("formatMapOutput renders summary footer when requested", async () => {
    const source = [
      "// tldr ::: overview",
      "// todo ::: remaining work",
      "// note ::: context",
    ].join("\n");
    const { file, cleanup } = await withTempFile(source);
    const map = await mapFiles([file], defaultContext.config);

    const output = formatMapOutput(map, { includeSummary: true });
    const lines = output.split("\n");

    expect(lines).toContain("Summary:");
    expect(lines.some((line) => line.trim() === "todo: 1")).toBe(true);
    expect(lines.some((line) => line.trim() === "note: 1")).toBe(true);

    await cleanup();
  });

  test("formatMapOutput reports when no types match filters", async () => {
    const source = ["// tldr ::: overview", "// todo ::: remaining work"].join(
      "\n"
    );
    const { file, cleanup } = await withTempFile(source);
    const map = await mapFiles([file], defaultContext.config);

    const output = formatMapOutput(map, { types: ["fix"] });

    expect(output).toBe("No matching waymarks.");

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
    expect(report.issues[0]?.type).toBe("todooo");
    await cleanup();
  });

  test("migrate command converts legacy TODO", async () => {
    const source = "// TODO: replace legacy\n";
    const { file, cleanup } = await withTempFile(source);
    const { output } = await migrateFile(
      { filePath: file, write: false },
      defaultContext
    );
    expect(output).toBe("// todo ::: replace legacy\n");
    await cleanup();
  });

  test("legacy migration helper handles multiple patterns", () => {
    const migrated = migrateLegacyWaymarks(
      ["// TODO: item", "// FIXME: bug", "// NOTE: detail"].join("\n")
    );
    expect(migrated).toBe(
      "// todo ::: item\n// fix ::: bug\n// note ::: detail"
    );
  });
});

describe("Unified command", () => {
  test("parseUnifiedArgs detects map mode", () => {
    const options = parseUnifiedArgs(["--map", "src/"]);
    expect(options.isMapMode).toBe(true);
    expect(options.isGraphMode).toBe(false);
    expect(options.filePaths).toEqual(["src/"]);
  });

  test("parseUnifiedArgs detects graph mode", () => {
    const options = parseUnifiedArgs(["--graph", "src/"]);
    expect(options.isMapMode).toBe(false);
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

  test("runUnifiedCommand handles map mode", async () => {
    const source = ["// tldr ::: summary", "// todo ::: work"].join("\n");
    const { file, cleanup } = await withTempFile(source);

    const output = await runUnifiedOutput({
      filePaths: [file],
      isMapMode: true,
      isGraphMode: false,
    });

    expect(output).toBe("");
    await cleanup();
  });

  test("runUnifiedCommand handles map mode with JSON", async () => {
    const source = ["// tldr ::: summary", "// todo ::: work"].join("\n");
    const { file, cleanup } = await withTempFile(source);

    const output = await runUnifiedOutput({
      filePaths: [file],
      isMapMode: true,
      isGraphMode: false,
      json: true,
    });

    const parsed = JSON.parse(output) as Record<
      string,
      { tldr?: string; types: Record<string, number> }
    >;
    expect(parsed[file]?.types).toEqual({ tldr: 1, todo: 1 });
    await cleanup();
  });

  test("runUnifiedCommand handles graph mode", async () => {
    const source = [
      "// tldr ::: root ref:#test/root",
      "// todo ::: depends:#test/root",
    ].join("\n");
    const { file, cleanup } = await withTempFile(source);

    const output = await runUnifiedOutput({
      filePaths: [file],
      isMapMode: false,
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
      isMapMode: false,
      isGraphMode: false,
      types: ["todo"],
      json: true,
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
      isMapMode: false,
      isGraphMode: false,
      raised: true,
      json: true,
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
      isMapMode: false,
      isGraphMode: false,
      starred: true,
      json: true,
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
      isMapMode: false,
      isGraphMode: false,
      types: ["todo"],
      raised: true,
      starred: true,
      tags: ["#perf"],
      json: true,
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
      isMapMode: false,
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
      isMapMode: false,
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
      isMapMode: false,
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
      isMapMode: false,
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
      isMapMode: false,
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
      isMapMode: false,
      isGraphMode: false,
      sortBy: "file",
    });

    // With enhanced formatter, file headers are separate lines
    const lines = output.split("\n");
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
      isMapMode: false,
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
      isMapMode: false,
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
    const output = await runUnifiedOutput(
      parseUnifiedArgs([file, "todo @agent #perf"])
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
