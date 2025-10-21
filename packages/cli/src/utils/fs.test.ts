// tldr ::: tests for filesystem path expansion and traversal prevention

import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdir, mkdtemp, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { resolveConfig } from "@waymarks/core";

import { expandInputPaths } from "./fs";

const OUTSIDE_WORKSPACE_ERROR = /Input .* resolves outside workspace/;

describe("expandInputPaths", () => {
  let workspace: string;
  let originalCwd: string;

  beforeEach(async () => {
    // Save original cwd
    originalCwd = process.cwd();

    // Create temporary workspace
    workspace = await mkdtemp(join(tmpdir(), "waymark-fs-test-"));

    // Change to workspace for tests
    process.chdir(workspace);

    // Create test directory structure
    await mkdir(join(workspace, "src"), { recursive: true });
    await mkdir(join(workspace, "dist"), { recursive: true });
    await writeFile(join(workspace, "src", "test.ts"), "// test file");
    await writeFile(join(workspace, "src", "other.ts"), "// other file");
    await writeFile(join(workspace, "dist", "build.js"), "// build output");
  });

  afterEach(async () => {
    // Restore original cwd
    process.chdir(originalCwd);

    // Clean up workspace
    await rm(workspace, { recursive: true, force: true });
  });

  test("expands normal in-workspace paths", async () => {
    const config = resolveConfig({ respectGitignore: false });
    const srcPath = join(workspace, "src");
    const files = await expandInputPaths([srcPath], config);

    expect(files.length).toBeGreaterThan(0);
    expect(files.some((f) => f.includes("test.ts"))).toBe(true);
  });

  test("rejects parent directory traversal with ../", async () => {
    const config = resolveConfig({});

    await expect(expandInputPaths(["../"], config)).rejects.toThrow(
      OUTSIDE_WORKSPACE_ERROR
    );
  });

  test("rejects multiple levels of parent directory traversal", async () => {
    const config = resolveConfig({});

    await expect(expandInputPaths(["../../"], config)).rejects.toThrow(
      OUTSIDE_WORKSPACE_ERROR
    );
  });

  test("rejects single-input traversal preventing attacker-controlled root (P0 fix)", async () => {
    const config = resolveConfig({});
    // Critical security test from Codex review:
    // When a single relative path traverses outside workspace,
    // determineRootDir should NOT use it as the root directory.
    // This test ensures the fix prevents the security boundary from becoming attacker-controlled.
    await expect(expandInputPaths(["../../etc"], config)).rejects.toThrow(
      OUTSIDE_WORKSPACE_ERROR
    );
  });
  test("rejects mixed traversal attempts", async () => {
    const config = resolveConfig({});

    await expect(expandInputPaths(["src", "../"], config)).rejects.toThrow(
      OUTSIDE_WORKSPACE_ERROR
    );
  });

  test("rejects traversal via subdirectory path", async () => {
    const config = resolveConfig({});

    await expect(expandInputPaths(["src/../../"], config)).rejects.toThrow(
      OUTSIDE_WORKSPACE_ERROR
    );
  });

  test("rejects file symlink that escapes workspace", async () => {
    const config = resolveConfig({});
    const outsideDir = await mkdtemp(join(tmpdir(), "external-target-"));
    const outsideFile = join(outsideDir, "secret.txt");
    await writeFile(outsideFile, "secret", "utf8");

    const linkPath = join(workspace, "src", "escape-link.ts");
    await symlink(outsideFile, linkPath);

    await expect(
      expandInputPaths(["src/escape-link.ts"], config)
    ).rejects.toThrow(OUTSIDE_WORKSPACE_ERROR);

    await rm(outsideDir, { recursive: true, force: true });
  });

  test("rejects directory symlink that escapes workspace", async () => {
    const config = resolveConfig({});
    const outsideDir = await mkdtemp(join(tmpdir(), "external-dir-"));
    const outsideFile = join(outsideDir, "exposed.ts");
    await writeFile(outsideFile, "// outside file", "utf8");

    const linkDir = join(workspace, "external");
    await symlink(outsideDir, linkDir, "dir");

    await expect(expandInputPaths(["external"], config)).rejects.toThrow(
      OUTSIDE_WORKSPACE_ERROR
    );

    await rm(outsideDir, { recursive: true, force: true });
  });

  test("allows relative paths within workspace", async () => {
    const config = resolveConfig({ respectGitignore: false });
    // Relative paths are resolved against cwd, which is workspace
    const files = await expandInputPaths(["src/test.ts"], config);

    expect(files.length).toBeGreaterThan(0);
    expect(files.some((f) => f.includes("test.ts"))).toBe(true);
  });

  test("handles non-existent paths within workspace gracefully", async () => {
    const config = resolveConfig({});
    const files = await expandInputPaths(["nonexistent"], config);

    expect(files).toEqual([]);
  });

  test("allows absolute paths (user explicitly specified)", async () => {
    const config = resolveConfig({ respectGitignore: false });
    // Absolute paths are allowed since user explicitly specified them
    const parentDir = join(workspace, "..");

    // This should work - user provided an absolute path outside workspace
    const files = await expandInputPaths([parentDir], config);

    // Should find files in parent directory including our workspace
    expect(files.length).toBeGreaterThan(0);
  });

  test("allows absolute path to workspace itself", async () => {
    const config = resolveConfig({});
    const files = await expandInputPaths([workspace], config);

    expect(files.length).toBeGreaterThan(0);
  });

  test("allows absolute path to subdirectory within workspace", async () => {
    const config = resolveConfig({});
    const srcDir = join(workspace, "src");
    const files = await expandInputPaths([srcDir], config);

    expect(files.length).toBeGreaterThan(0);
    expect(files.some((f) => f.includes("test.ts"))).toBe(true);
  });

  test("returns empty array for empty input", async () => {
    const config = resolveConfig({});
    const files = await expandInputPaths([], config);

    expect(files).toEqual([]);
  });

  test("respects skipPaths configuration", async () => {
    const config = resolveConfig({
      skipPaths: ["**/dist/**"],
    });
    const files = await expandInputPaths(["dist"], config);

    expect(files).toEqual([]);
  });
});
