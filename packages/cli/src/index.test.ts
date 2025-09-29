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
import { formatMapOutput, serializeMap } from "./index";
import type { CommandContext } from "./types";
import { renderRecords } from "./utils/output";

const defaultContext: CommandContext = {
  config: resolveConfig(),
  globalOptions: {},
};

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
  test("format command normalizes markers", async () => {
    const { file, cleanup } = await withTempFile("// TODO ::: needs cleanup\n");
    const { formattedText, edits } = await formatFile(
      { filePath: file, write: false },
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
    const records = await scanRecords([file]);
    expect(records).toHaveLength(2);
    expect(records[0]?.marker).toBe("todo");
    await cleanup();
  });

  test("scan command parses directories recursively", async () => {
    const { dir, cleanup } = await withTempFile("// todo ::: root\n");
    const nested = join(dir, "nested");
    await mkdir(nested);
    await writeFile(join(nested, "child.ts"), "// note ::: child", "utf8");

    const records = await scanRecords([dir]);

    expect(records.map((record) => record.marker)).toEqual(["todo", "note"]);
    await cleanup();
  });

  test("parseScanArgs detects jsonl format", () => {
    const parsed = parseScanArgs(["--jsonl", "sample.ts"]);
    expect(parsed.format).toBe("jsonl");
    expect(parsed.filePaths).toEqual(["sample.ts"]);
  });

  test("renderRecords formats jsonl output", async () => {
    const source = ["// tldr ::: summary", "// todo ::: follow up"].join("\n");
    const { file, cleanup } = await withTempFile(source);
    const records = await scanRecords([file]);
    const jsonl = renderRecords(records, "jsonl");
    const lines = jsonl.split("\n").filter(Boolean);
    expect(lines).toHaveLength(2);
    const parsed = lines.map((line) => JSON.parse(line) as { marker: string });
    expect(parsed[0]?.marker).toBe("tldr");
    expect(parsed[1]?.marker).toBe("todo");
    await cleanup();
  });

  test("renderRecords pretty prints json", async () => {
    const source = "// todo ::: detailed task";
    const { file, cleanup } = await withTempFile(source);
    const records = await scanRecords([file]);
    const pretty = renderRecords(records, "pretty");
    expect(pretty).toContain("\n  {");
    expect(() => JSON.parse(pretty)).not.toThrow();
    await cleanup();
  });

  test("map command summarizes files", async () => {
    const source = ["// tldr ::: summary", "// todo ::: work"].join("\n");
    const { file, cleanup } = await withTempFile(source);
    const map = await mapFiles([file]);
    const [summary] = Array.from(map.files.values());
    expect(summary?.tldr?.contentText).toBe("summary");
    expect(summary?.markers.get("todo")?.entries).toHaveLength(1);
    await cleanup();
  });

  test("map command walks directories", async () => {
    const { dir, cleanup } = await withTempFile("// tldr ::: root summary\n");
    const nested = join(dir, "docs");
    await mkdir(nested);
    await writeFile(join(nested, "note.ts"), "// todo ::: nested", "utf8");

    const map = await mapFiles([dir]);
    expect(map.files.size).toBeGreaterThan(0);
    const entries = Array.from(map.files.values()).flatMap((summary) =>
      Array.from(summary.markers.values()).flatMap((marker) => marker.entries)
    );
    expect(entries.some((record) => record.marker === "todo")).toBe(true);
    await cleanup();
  });

  test("parseMapArgs supports marker filters and summary flag", () => {
    const parsed = parseMapArgs([
      "--marker",
      "todo",
      "-m",
      "fix",
      "--summary",
      "docs/file.ts",
    ]);
    expect(parsed.filePaths).toEqual(["docs/file.ts"]);
    expect(parsed.markers).toEqual(["todo", "fix"]);
    expect(parsed.summary).toBe(true);
  });

  test("parseMapArgs throws when marker flag lacks value", () => {
    expect(() => parseMapArgs(["--marker"])).toThrow(
      "--marker requires a value"
    );
  });

  test("serializeMap filters markers and adds summary when requested", async () => {
    const source = [
      "// tldr ::: summary",
      "// todo ::: first",
      "// fix ::: patch",
    ].join("\n");
    const { file, cleanup } = await withTempFile(source);
    const map = await mapFiles([file]);

    const serialized = serializeMap(map, {
      markers: ["todo"],
      includeSummary: true,
    });

    const fileEntry = serialized[file] as {
      tldr?: string;
      markers: Record<string, number>;
    };
    expect(fileEntry.tldr).toBeUndefined();
    expect(fileEntry.markers).toEqual({ todo: 1 });

    const summary = serialized._summary as { markers: Record<string, number> };
    expect(summary.markers).toEqual({ todo: 1 });

    await cleanup();
  });

  test("formatMapOutput renders summary footer when requested", async () => {
    const source = [
      "// tldr ::: overview",
      "// todo ::: remaining work",
      "// note ::: context",
    ].join("\n");
    const { file, cleanup } = await withTempFile(source);
    const map = await mapFiles([file]);

    const output = formatMapOutput(map, { includeSummary: true });
    const lines = output.split("\n");

    expect(lines).toContain("Summary:");
    expect(lines.some((line) => line.trim() === "todo: 1")).toBe(true);
    expect(lines.some((line) => line.trim() === "note: 1")).toBe(true);

    await cleanup();
  });

  test("formatMapOutput reports when no markers match filters", async () => {
    const source = ["// tldr ::: overview", "// todo ::: remaining work"].join(
      "\n"
    );
    const { file, cleanup } = await withTempFile(source);
    const map = await mapFiles([file]);

    const output = formatMapOutput(map, { markers: ["fix"] });

    expect(output).toBe("No matching waymarks.");

    await cleanup();
  });

  test("graph command captures relations", async () => {
    const source = [
      "// tldr ::: root ref:#docs/root",
      "// todo ::: follow-up depends:#docs/root",
    ].join("\n");
    const { file, cleanup } = await withTempFile(source);
    const edges = await graphRecords([file]);
    expect(edges).toHaveLength(2);
    expect(edges[0]?.relation).toBe("ref");
    expect(edges[1]?.relation).toBe("depends");
    await cleanup();
  });

  test("find command filters by marker", async () => {
    const source = ["// tldr ::: summary", "// todo ::: task"].join("\n");
    const { file, cleanup } = await withTempFile(source);
    const matches = await findRecords({ filePath: file, markers: ["todo"] });
    expect(matches).toHaveLength(1);
    expect(matches[0]?.marker).toBe("todo");
    expect(matches[0]?.contentText).toBe("task");
    await cleanup();
  });

  test("lint command detects invalid markers", async () => {
    const source = ["// todooo ::: typo marker", "// todo ::: ok"].join("\n");
    const { file, cleanup } = await withTempFile(source);
    const report = await lintFiles([file], defaultContext.config.allowMarkers);
    expect(report.issues).toHaveLength(1);
    expect(report.issues[0]?.marker).toBe("todooo");
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
