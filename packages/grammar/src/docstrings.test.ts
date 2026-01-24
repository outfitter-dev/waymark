// tldr ::: tests for docstring detection and summary extraction utilities

import { describe, expect, test } from "bun:test";
import { detectDocstring, extractSummary } from "./docstrings";

describe("detectDocstring", () => {
  test("detects JSDoc file-level docs", () => {
    const content = `/**\n * Module summary.\n * More detail.\n */\nconst value = 1;\n`;
    const info = detectDocstring(content, "typescript");

    expect(info).not.toBeNull();
    expect(info?.format).toBe("jsdoc");
    expect(info?.kind).toBe("file");
    expect(extractSummary(info!)).toBe("Module summary. More detail.");
  });

  test("detects JSDoc function docs", () => {
    const content = `const value = 1;\n\n/**\n * Adds numbers.\n * @param a value\n */\nfunction add(a) {\n  return a + 1;\n}\n`;
    const info = detectDocstring(content, "js");

    expect(info).not.toBeNull();
    expect(info?.kind).toBe("function");
    expect(extractSummary(info!)).toBe("Adds numbers.");
  });

  test("detects Python module docstrings", () => {
    const content = `#!/usr/bin/env python\n# -*- coding: utf-8 -*-\n\"\"\"Module summary.\n\nMore detail.\n\"\"\"\n\nimport os\n`;
    const info = detectDocstring(content, "python");

    expect(info).not.toBeNull();
    expect(info?.format).toBe("python");
    expect(info?.kind).toBe("file");
    expect(extractSummary(info!)).toBe("Module summary.");
  });

  test("detects Python function docstrings", () => {
    const content = `def add(a):\n    \"\"\"Add numbers.\"\"\"\n    return a + 1\n`;
    const info = detectDocstring(content, "py");

    expect(info).not.toBeNull();
    expect(info?.kind).toBe("function");
    expect(extractSummary(info!)).toBe("Add numbers.");
  });

  test("detects Ruby header comments", () => {
    const content = `# Module summary.\n# More detail.\n\nclass Greeter\nend\n`;
    const info = detectDocstring(content, "ruby");

    expect(info).not.toBeNull();
    expect(info?.format).toBe("ruby");
    expect(info?.kind).toBe("file");
    expect(extractSummary(info!)).toBe("Module summary. More detail.");
  });

  test("detects Rust line doc comments", () => {
    const content = `use std::fmt;\n\n/// Adds numbers.\n/// More detail.\nfn add(a: i32) -> i32 {\n  a + 1\n}\n`;
    const info = detectDocstring(content, "rust");

    expect(info).not.toBeNull();
    expect(info?.format).toBe("rust");
    expect(info?.kind).toBe("function");
    expect(extractSummary(info!)).toBe("Adds numbers. More detail.");
  });
});
