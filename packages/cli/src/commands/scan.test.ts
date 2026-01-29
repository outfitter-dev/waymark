// tldr ::: tests for scanner capability check integration
// biome-ignore-all lint/style/noMagicNumbers: test assertions use literal counts

import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { resolveConfig } from "@waymarks/core";

import { type ScanMetrics, scanRecords } from "./scan";

describe("scanRecords capability check", () => {
  let workspace: string;

  beforeEach(async () => {
    workspace = await mkdtemp(join(tmpdir(), "waymark-scan-"));
  });

  afterEach(async () => {
    await rm(workspace, { recursive: true, force: true });
  });

  test("skips .json files without reading them", async () => {
    // Create test files
    const jsonPath = join(workspace, "data.json");
    const tsPath = join(workspace, "index.ts");

    await writeFile(jsonPath, '{"key": "value"}', "utf8");
    await writeFile(tsPath, "// todo ::: implement feature\n", "utf8");

    const config = resolveConfig();
    const metrics: ScanMetrics = {
      totalFiles: 0,
      parsedFiles: 0,
      cachedFiles: 0,
      skippedFiles: 0,
      durationMs: 0,
    };

    const records = await scanRecords([workspace], config, { metrics });

    // Should find the waymark in the .ts file
    expect(records.length).toBe(1);
    expect(records[0]?.type).toBe("todo");

    // Metrics should show .json was skipped
    expect(metrics.totalFiles).toBe(2);
    expect(metrics.parsedFiles).toBe(1);
    expect(metrics.skippedFiles).toBe(1);
  });

  test("parses .jsonc files (JSON with comments)", async () => {
    const jsoncPath = join(workspace, "config.jsonc");

    // JSONC files can have comments - write valid JSONC with a waymark
    await writeFile(
      jsoncPath,
      '// todo ::: add more config options\n{\n  "key": "value"\n}\n',
      "utf8"
    );

    const config = resolveConfig();
    const metrics: ScanMetrics = {
      totalFiles: 0,
      parsedFiles: 0,
      cachedFiles: 0,
      skippedFiles: 0,
      durationMs: 0,
    };

    const records = await scanRecords([jsoncPath], config, { metrics });

    // Should find the waymark in the .jsonc file
    expect(records.length).toBe(1);
    expect(records[0]?.type).toBe("todo");
    expect(metrics.parsedFiles).toBe(1);
    expect(metrics.skippedFiles).toBe(0);
  });

  test("parses unknown extensions by default", async () => {
    const unknownPath = join(workspace, "mystery.xyz");

    await writeFile(unknownPath, "// note ::: unknown file type\n", "utf8");

    const config = resolveConfig();
    const metrics: ScanMetrics = {
      totalFiles: 0,
      parsedFiles: 0,
      cachedFiles: 0,
      skippedFiles: 0,
      durationMs: 0,
    };

    const records = await scanRecords([unknownPath], config, { metrics });

    // Should attempt to parse unknown extensions
    expect(records.length).toBe(1);
    expect(records[0]?.type).toBe("note");
    expect(metrics.parsedFiles).toBe(1);
    expect(metrics.skippedFiles).toBe(0);
  });

  test("skips unknown extensions when skipUnknown is true", async () => {
    const unknownPath = join(workspace, "mystery.xyz");

    await writeFile(unknownPath, "// note ::: unknown file type\n", "utf8");

    const config = resolveConfig({
      languages: { skipUnknown: true },
    });
    const metrics: ScanMetrics = {
      totalFiles: 0,
      parsedFiles: 0,
      cachedFiles: 0,
      skippedFiles: 0,
      durationMs: 0,
    };

    const records = await scanRecords([unknownPath], config, { metrics });

    // Should skip unknown extensions
    expect(records.length).toBe(0);
    expect(metrics.parsedFiles).toBe(0);
    expect(metrics.skippedFiles).toBe(1);
  });

  test("respects extension overrides enabling JSON comments", async () => {
    const jsonPath = join(workspace, "config.json");

    await writeFile(
      jsonPath,
      '// todo ::: validate schema\n{"key": "value"}\n',
      "utf8"
    );

    // Override JSON to support comments
    const config = resolveConfig({
      languages: {
        extensions: { ".json": ["//"] },
      },
    });
    const metrics: ScanMetrics = {
      totalFiles: 0,
      parsedFiles: 0,
      cachedFiles: 0,
      skippedFiles: 0,
      durationMs: 0,
    };

    const records = await scanRecords([jsonPath], config, { metrics });

    // Should parse JSON when overridden
    expect(records.length).toBe(1);
    expect(records[0]?.type).toBe("todo");
    expect(metrics.parsedFiles).toBe(1);
    expect(metrics.skippedFiles).toBe(0);
  });

  test("metrics accurately reflect mixed file types", async () => {
    const srcDir = join(workspace, "src");
    await mkdir(srcDir, { recursive: true });

    // Create a mix of file types
    await writeFile(
      join(srcDir, "index.ts"),
      "// tldr ::: main entry\n",
      "utf8"
    );
    await writeFile(join(srcDir, "utils.ts"), "// note ::: helpers\n", "utf8");
    await writeFile(join(srcDir, "data.json"), '{"data": true}', "utf8");
    await writeFile(join(srcDir, "config.json"), '{"config": true}', "utf8");
    await writeFile(
      join(srcDir, "styles.css"),
      "/* todo ::: add theme */\nbody {}",
      "utf8"
    );

    const config = resolveConfig();
    const metrics: ScanMetrics = {
      totalFiles: 0,
      parsedFiles: 0,
      cachedFiles: 0,
      skippedFiles: 0,
      durationMs: 0,
    };

    const records = await scanRecords([srcDir], config, { metrics });

    // Should find waymarks in .ts and .css files
    expect(records.length).toBe(3); // 2 from ts files, 1 from css
    expect(metrics.totalFiles).toBe(5);
    expect(metrics.parsedFiles).toBe(3); // 2 ts + 1 css
    expect(metrics.skippedFiles).toBe(2); // 2 json files
  });

  test("skips lockfiles and binary data files", async () => {
    // Create files with known no-comment extensions
    await writeFile(join(workspace, "bun.lockb"), "binary lock data", "utf8");
    await writeFile(
      join(workspace, "package-lock.json"),
      '{"lockfileVersion":3}',
      "utf8"
    );
    await writeFile(
      join(workspace, "index.ts"),
      "// todo ::: real code\n",
      "utf8"
    );

    const config = resolveConfig();
    const metrics: ScanMetrics = {
      totalFiles: 0,
      parsedFiles: 0,
      cachedFiles: 0,
      skippedFiles: 0,
      durationMs: 0,
    };

    const records = await scanRecords([workspace], config, { metrics });

    // Should only find waymark in .ts file
    expect(records.length).toBe(1);
    expect(records[0]?.type).toBe("todo");
    expect(metrics.parsedFiles).toBe(1);
    expect(metrics.skippedFiles).toBe(2); // .lockb and .json
  });

  test("config changes are honored even with cached data", async () => {
    // This test verifies the fix: capability check must happen BEFORE cache lookup.
    // Without the fix, config changes would be ignored for cached files.
    const jsonPath = join(workspace, "config.json");

    // Cache must be within allowed directories (project or ~/.cache/waymark)
    const cacheDir = join(process.cwd(), ".waymark", "test-cache");
    await mkdir(cacheDir, { recursive: true });
    const cachePath = join(cacheDir, `cache-${Date.now()}.db`);

    try {
      await writeFile(
        jsonPath,
        '// todo ::: validate schema\n{"key": "value"}\n',
        "utf8"
      );

      // First scan: config enables JSON comments, populating cache
      const configWithJson = resolveConfig({
        languages: {
          extensions: { ".json": ["//"] },
        },
      });
      const metrics1: ScanMetrics = {
        totalFiles: 0,
        parsedFiles: 0,
        cachedFiles: 0,
        skippedFiles: 0,
        durationMs: 0,
      };

      const records1 = await scanRecords([jsonPath], configWithJson, {
        cache: true,
        cachePath,
        metrics: metrics1,
      });

      // Verify first scan found the waymark and cached it
      expect(records1.length).toBe(1);
      expect(records1[0]?.type).toBe("todo");
      expect(metrics1.parsedFiles).toBe(1);
      expect(metrics1.cachedFiles).toBe(0);

      // Second scan: config disables JSON comments (default behavior)
      // The capability check should run BEFORE cache lookup,
      // so the file should be skipped despite being cached
      const configWithoutJson = resolveConfig();
      const metrics2: ScanMetrics = {
        totalFiles: 0,
        parsedFiles: 0,
        cachedFiles: 0,
        skippedFiles: 0,
        durationMs: 0,
      };

      const records2 = await scanRecords([jsonPath], configWithoutJson, {
        cache: true,
        cachePath,
        metrics: metrics2,
      });

      // Should NOT return cached data - config change must be honored
      expect(records2.length).toBe(0);
      expect(metrics2.skippedFiles).toBe(1);
      expect(metrics2.cachedFiles).toBe(0);
    } finally {
      // Clean up test cache
      await rm(cachePath, { force: true });
    }
  });
});
