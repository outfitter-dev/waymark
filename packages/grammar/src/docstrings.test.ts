// tldr ::: tests for docstring detection and summary extraction utilities

import { describe, expect, test } from "bun:test";
import type { DocstringInfo } from "./docstrings";
import { detectDocstring, extractSummary } from "./docstrings";

const requireDocstring = (info: DocstringInfo | null): DocstringInfo => {
  if (!info) {
    throw new Error("Expected docstring");
  }
  return info;
};

describe("detectDocstring", () => {
  test("detects JSDoc file-level docs", () => {
    const content =
      "/**\n * Module summary.\n * More detail.\n * @fileoverview\n */\nconst value = 1;\n";
    const info = detectDocstring(content, "typescript");

    expect(info).not.toBeNull();
    const docstring = requireDocstring(info);
    expect(info?.format).toBe("jsdoc");
    expect(info?.kind).toBe("file");
    expect(extractSummary(docstring)).toBe("Module summary. More detail.");
  });

  test("detects JSDoc function docs", () => {
    const content =
      "const value = 1;\n\n/**\n * Adds numbers.\n * @param a value\n */\nfunction add(a) {\n  return a + 1;\n}\n";
    const info = detectDocstring(content, "js");

    expect(info).not.toBeNull();
    const docstring = requireDocstring(info);
    expect(info?.kind).toBe("function");
    expect(extractSummary(docstring)).toBe("Adds numbers.");
  });

  test("treats top-level JSDoc as function docs when attached to an item", () => {
    const content =
      "/**\n * Adds numbers.\n */\nfunction add(a) {\n  return a + 1;\n}\n";
    const info = detectDocstring(content, "javascript");

    expect(info).not.toBeNull();
    const docstring = requireDocstring(info);
    expect(info?.kind).toBe("function");
    expect(extractSummary(docstring)).toBe("Adds numbers.");
  });

  test("respects JSDoc file tags for file-level docs", () => {
    const content =
      "#!/usr/bin/env node\n/**\n * CLI entry.\n * @fileoverview\n */\nexport function run() {}\n";
    const info = detectDocstring(content, "typescript");

    expect(info).not.toBeNull();
    const docstring = requireDocstring(info);
    expect(info?.kind).toBe("file");
    expect(extractSummary(docstring)).toBe("CLI entry.");
  });

  test("detects Python module docstrings", () => {
    const content = `#!/usr/bin/env python\n# -*- coding: utf-8 -*-\n"""Module summary.\n\nMore detail.\n"""\n\nimport os\n`;
    const info = detectDocstring(content, "python");

    expect(info).not.toBeNull();
    const docstring = requireDocstring(info);
    expect(info?.format).toBe("python");
    expect(info?.kind).toBe("file");
    expect(extractSummary(docstring)).toBe("Module summary.");
  });

  test("detects Python function docstrings", () => {
    const content = `def add(a):\n    """Add numbers."""\n    return a + 1\n`;
    const info = detectDocstring(content, "py");

    expect(info).not.toBeNull();
    const docstring = requireDocstring(info);
    expect(info?.kind).toBe("function");
    expect(extractSummary(docstring)).toBe("Add numbers.");
  });

  test("detects Python docstrings with single quotes", () => {
    const content = `#!/usr/bin/env python\n'''Module summary.\n\nMore detail.\n'''\n\nimport os\n`;
    const info = detectDocstring(content, "python");

    expect(info).not.toBeNull();
    const docstring = requireDocstring(info);
    expect(info?.format).toBe("python");
    expect(info?.kind).toBe("file");
    expect(extractSummary(docstring)).toBe("Module summary.");
  });

  test("detects Python module docstrings after imports", () => {
    const content = `#!/usr/bin/env python\nimport os\nimport sys\n"""Module summary.\n\nMore detail.\n"""\n\ndef foo():\n    pass\n`;
    const info = detectDocstring(content, "python");

    expect(info).not.toBeNull();
    const docstring = requireDocstring(info);
    expect(info?.format).toBe("python");
    expect(info?.kind).toBe("file");
    expect(extractSummary(docstring)).toBe("Module summary.");
  });

  test("ignores Ruby magic comments when detecting header docs", () => {
    const content =
      "# frozen_string_literal: true\n# Module summary.\n# More detail.\n\nclass Greeter\nend\n";
    const info = detectDocstring(content, "ruby");

    expect(info).not.toBeNull();
    const docstring = requireDocstring(info);
    expect(info?.format).toBe("ruby");
    expect(info?.kind).toBe("file");
    expect(extractSummary(docstring)).toBe("Module summary. More detail.");
  });

  test("detects Rust line doc comments", () => {
    const content =
      "use std::fmt;\n\n/// Adds numbers.\n/// More detail.\nfn add(a: i32) -> i32 {\n  a + 1\n}\n";
    const info = detectDocstring(content, "rust");

    expect(info).not.toBeNull();
    const docstring = requireDocstring(info);
    expect(info?.format).toBe("rust");
    expect(info?.kind).toBe("function");
    expect(extractSummary(docstring)).toBe("Adds numbers. More detail.");
  });

  test("detects Rust inner doc comments as file docs", () => {
    const content =
      "#![allow(dead_code)]\n\n//! Crate summary.\n//! More detail.\nfn add(a: i32) -> i32 {\n  a + 1\n}\n";
    const info = detectDocstring(content, "rs");

    expect(info).not.toBeNull();
    const docstring = requireDocstring(info);
    expect(info?.format).toBe("rust");
    expect(info?.kind).toBe("file");
    expect(extractSummary(docstring)).toBe("Crate summary. More detail.");
  });

  test("skips Python string assignments and finds later docstrings", () => {
    const content = `note = """Not a docstring"""\n\ndef add(a):\n    """Add numbers."""\n    return a + 1\n`;
    const info = detectDocstring(content, "python");

    expect(info).not.toBeNull();
    const docstring = requireDocstring(info);
    expect(info?.kind).toBe("function");
    expect(extractSummary(docstring)).toBe("Add numbers.");
  });
});
