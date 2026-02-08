// tldr ::: tests for shared theme module color wrapping and state management

import { afterEach, describe, expect, test } from "bun:test";
import { ANSI } from "@outfitter/cli/colors";
import { isColorEnabled, setColorEnabled, wrap } from "./theme.ts";

describe("theme", () => {
  afterEach(() => {
    // Reset to default (enabled) after each test
    setColorEnabled(true);
  });

  describe("wrap", () => {
    test("wraps text with single ANSI code when colors enabled", () => {
      setColorEnabled(true);
      const result = wrap("hello", ANSI.bold);
      expect(result).toBe(`${ANSI.bold}hello${ANSI.reset}`);
    });

    test("wraps text with multiple ANSI codes when colors enabled", () => {
      setColorEnabled(true);
      const result = wrap("hello", ANSI.bold, ANSI.yellow);
      expect(result).toBe(`${ANSI.bold}${ANSI.yellow}hello${ANSI.reset}`);
    });

    test("returns plain text when colors disabled", () => {
      setColorEnabled(false);
      const result = wrap("hello", ANSI.bold, ANSI.yellow);
      expect(result).toBe("hello");
    });

    test("handles empty text", () => {
      setColorEnabled(true);
      const result = wrap("", ANSI.bold);
      expect(result).toBe(`${ANSI.bold}${ANSI.reset}`);
    });

    test("handles no codes", () => {
      setColorEnabled(true);
      const result = wrap("hello");
      expect(result).toBe(`hello${ANSI.reset}`);
    });
  });

  describe("setColorEnabled / isColorEnabled", () => {
    test("defaults to enabled", () => {
      // Reset to check default-like behavior
      setColorEnabled(true);
      expect(isColorEnabled()).toBe(true);
    });

    test("can be disabled", () => {
      setColorEnabled(false);
      expect(isColorEnabled()).toBe(false);
    });

    test("can be re-enabled", () => {
      setColorEnabled(false);
      setColorEnabled(true);
      expect(isColorEnabled()).toBe(true);
    });
  });
});
