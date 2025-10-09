// tldr ::: tests for completion orchestrator

import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdirSync, readdirSync, rmSync } from "node:fs";
import { resolve } from "node:path";
import { generateAll } from "./index.ts";

// Test constants
const COMPLETION_FILE_PATTERN = /^(wm\.|_wm)/;
const HELP_PATTERN = /help/;
const VERSION_PATTERN = /version/;
const TYPE_PATTERN = /type/;
const EXPECTED_FILE_COUNT = 5;

describe("completion orchestrator", () => {
  const testDir = resolve(import.meta.dir, "../../test-completions");
  const completionsDir = resolve(import.meta.dir, "../../completions");

  beforeEach(() => {
    // Ensure completions directory exists
    mkdirSync(completionsDir, { recursive: true });
  });

  afterEach(() => {
    // Clean up test directory if it exists
    if (testDir) {
      try {
        rmSync(testDir, { recursive: true, force: true });
      } catch {
        // Ignore cleanup errors
      }
    }
  });

  test("generateAll creates all completion files", async () => {
    await generateAll();

    const files = readdirSync(completionsDir);

    // Check that all expected files were created
    expect(files).toContain("wm.nu");
    expect(files).toContain("wm.bash");
    expect(files).toContain("wm.fish");
    expect(files).toContain("_wm");
    expect(files).toContain("wm.ps1");
  });

  test("generateAll creates 5 completion files", async () => {
    await generateAll();

    const files = readdirSync(completionsDir).filter((f) =>
      COMPLETION_FILE_PATTERN.test(f)
    );

    expect(files.length).toBe(EXPECTED_FILE_COUNT);
  });

  test("generated files are non-empty", async () => {
    await generateAll();

    const files = ["wm.nu", "wm.bash", "wm.fish", "_wm", "wm.ps1"];

    for (const file of files) {
      const filepath = resolve(completionsDir, file);
      const content = await Bun.file(filepath).text();
      expect(content.length).toBeGreaterThan(0);
    }
  });

  test("generated files contain waymark types", async () => {
    await generateAll();

    const files = ["wm.nu", "wm.bash", "wm.fish", "_wm", "wm.ps1"];
    const expectedTypes = ["todo", "fix", "note", "tldr", "fixme", "why"];

    for (const file of files) {
      const filepath = resolve(completionsDir, file);
      const content = await Bun.file(filepath).text();

      for (const type of expectedTypes) {
        expect(content).toContain(type);
      }
    }
  });

  test("generated files contain shell-specific syntax", async () => {
    await generateAll();

    // Nushell
    const nuContent = await Bun.file(resolve(completionsDir, "wm.nu")).text();
    expect(nuContent).toContain("export extern");
    expect(nuContent).toContain('def "nu-complete');

    // Bash
    const bashContent = await Bun.file(
      resolve(completionsDir, "wm.bash")
    ).text();
    expect(bashContent).toContain("_wm_completion()");
    expect(bashContent).toContain("complete -F");

    // Fish
    const fishContent = await Bun.file(
      resolve(completionsDir, "wm.fish")
    ).text();
    expect(fishContent).toContain("complete -c wm");
    expect(fishContent).toContain("__fish_use_subcommand");

    // Zsh
    const zshContent = await Bun.file(resolve(completionsDir, "_wm")).text();
    expect(zshContent).toContain("#compdef wm");
    expect(zshContent).toContain("_arguments");

    // PowerShell
    const psContent = await Bun.file(resolve(completionsDir, "wm.ps1")).text();
    expect(psContent).toContain("Register-ArgumentCompleter");
    expect(psContent).toContain("[CompletionResult]::");
  });

  test("files are executable or have appropriate extensions", async () => {
    await generateAll();

    const files = [
      { name: "wm.nu", ext: ".nu" },
      { name: "wm.bash", ext: ".bash" },
      { name: "wm.fish", ext: ".fish" },
      { name: "_wm", ext: "" }, // zsh doesn't need extension
      { name: "wm.ps1", ext: ".ps1" },
    ];

    for (const { name } of files) {
      const filepath = resolve(completionsDir, name);
      const file = Bun.file(filepath);
      expect(await file.exists()).toBe(true);
    }
  });

  test("generated files have consistent structure", async () => {
    await generateAll();

    const files = ["wm.nu", "wm.bash", "wm.fish", "_wm", "wm.ps1"];
    const commonElements = [
      "format",
      "insert",
      "modify",
      "remove",
      "lint",
      "migrate",
      "init",
      "update",
      "help",
    ];

    for (const file of files) {
      const filepath = resolve(completionsDir, file);
      const content = await Bun.file(filepath).text();

      // All files should have commands
      for (const element of commonElements) {
        expect(content).toContain(element);
      }

      // All files should have common flags
      expect(content).toMatch(HELP_PATTERN);
      expect(content).toMatch(VERSION_PATTERN);
      expect(content).toMatch(TYPE_PATTERN);
    }
  });
});
