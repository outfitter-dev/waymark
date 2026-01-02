// tldr ::: tests for intelligent line wrapping with smart tag/content reflow

import { describe, expect, test } from "bun:test";
import { wrapContent } from "./wrapping";

// Test constants
const TEST_WIDTH = 30;
const LONG_CONTENT_LENGTH = 100;
const MENTION_PATTERN = /@\w+/;
const PROPERTY_PATTERN = /\w+:[^\s]+/;
const NAMESPACED_DOCS_PATTERN = /#docs\/\w+/;
const NAMESPACED_PERF_PATTERN = /#perf:\w+/;

describe("wrapContent", () => {
  test("returns single line when content fits", () => {
    const content = "simple text that fits";
    const result = wrapContent(content, { indent: 10 });
    expect(result).toEqual([content]);
  });

  test("respects noWrap flag", () => {
    const content =
      "very long content that would normally wrap but should not with noWrap enabled";
    const result = wrapContent(content, { noWrap: true, indent: 10 });
    expect(result).toEqual([content]);
  });

  test("wraps at tag boundaries", () => {
    const content = "short text #performance #security #hotpath";
    const result = wrapContent(content, { indent: 10, width: 30 });
    expect(result.length).toBeGreaterThan(1);
    expect(result[0]).toContain("short text");
    expect(result.some((line) => line.includes("#performance"))).toBe(true);
  });

  test("wraps at word boundaries when no tags", () => {
    const content =
      "this is a very long piece of text without any special markers";
    const result = wrapContent(content, { indent: 10, width: TEST_WIDTH });
    expect(result.length).toBeGreaterThan(1);
    // Each line should be reasonably short
    for (const line of result) {
      expect(line.length).toBeLessThanOrEqual(TEST_WIDTH);
    }
  });

  test("keeps mentions together", () => {
    const content = "assign to @alice and @bob for review";
    const result = wrapContent(content, { indent: 10, width: 25 });
    // Mentions should not be broken mid-token
    for (const line of result) {
      // If line contains @, it should have the full mention
      if (line.includes("@")) {
        expect(line).toMatch(MENTION_PATTERN);
      }
    }
  });

  test("keeps properties together", () => {
    const content = "owner:@alice priority:high depends:#auth";
    const result = wrapContent(content, { indent: 10, width: 30 });
    // Properties should not be split
    for (const line of result) {
      if (line.includes(":")) {
        // Should have complete key:value pairs
        expect(line).toMatch(PROPERTY_PATTERN);
      }
    }
  });

  test("handles quoted property values", () => {
    const content = 'message:"this is a long message" priority:high';
    const result = wrapContent(content, { indent: 10, width: 35 });
    // Should wrap if needed (quoted values are single tokens)
    expect(result.length).toBeGreaterThan(0);
    // First line should start with the property
    expect(result[0]).toContain("message:");
  });

  test("breaks before tags when content is long", () => {
    const content =
      "implement user authentication flow with OAuth support #security #auth #backend";
    const result = wrapContent(content, { indent: 10, width: 50 });
    expect(result.length).toBeGreaterThan(1);
    // Should contain the text and tags across multiple lines
    const fullText = result.join(" ");
    expect(fullText).toContain("implement");
    expect(fullText).toContain("#security");
  });

  test("handles multiple consecutive tags", () => {
    const content = "quick fix #perf #hotpath #critical #p0";
    const result = wrapContent(content, { indent: 10, width: 30 });
    // Should break at tag boundaries
    for (const line of result) {
      // Each line should have at least one complete token
      expect(line.trim().length).toBeGreaterThan(0);
    }
  });

  test("handles namespaced tags", () => {
    const content = "update docs #docs/guide #docs/api #perf:hotpath";
    const result = wrapContent(content, { indent: 10, width: 35 });
    // Namespaced tags should stay together
    for (const line of result) {
      if (line.includes("#docs/")) {
        expect(line).toMatch(NAMESPACED_DOCS_PATTERN);
      }
      if (line.includes("#perf:")) {
        expect(line).toMatch(NAMESPACED_PERF_PATTERN);
      }
    }
  });

  test("handles single long token by force-splitting", () => {
    const content = "#verylongtagthatexceedsavailablewidthbutcannotbesplit";
    const result = wrapContent(content, { indent: 10, width: 30 });
    // Should force-split long tokens that exceed available width
    expect(result.length).toBeGreaterThan(1);
    // Joined back together should give original content
    expect(result.join("")).toBe(content);
  });

  test("handles long token after existing content", () => {
    // Edge case: long token appears after short content already on line
    const content = "hello #verylongtagthatexceedsavailablewidthentirely";
    const result = wrapContent(content, { indent: 10, width: 30 });
    // Available width = 30 - 10 = 20
    // "hello " (6 chars) fits, then long tag (45 chars) should be split
    expect(result.length).toBeGreaterThan(1);
    // First line should have "hello"
    expect(result[0]).toBe("hello");
    // No single line should exceed available width (20)
    for (const line of result) {
      expect(line.length).toBeLessThanOrEqual(20);
    }
  });

  test("calculates indent correctly", () => {
    const content = "text that wraps";
    const indent = 15;
    const result = wrapContent(content, { indent, width: 20 });
    // First line fits, second line should be indented
    // Available width = 20 - 15 = 5, so "wraps" should go to next line
    expect(result.length).toBeGreaterThan(1);
  });

  test("handles empty content", () => {
    const result = wrapContent("", { indent: 10 });
    expect(result).toEqual([""]);
  });

  test("handles content with only spaces", () => {
    const result = wrapContent("   ", { indent: 10 });
    // Should return single trimmed line (empty)
    expect(result.length).toBe(1);
    expect(result[0]).toBe("");
  });

  test("preserves spacing around tokens", () => {
    const content = "text with  multiple   spaces";
    const result = wrapContent(content, { indent: 10 });
    // Spaces should be preserved in tokenization
    expect(result[0]).toContain("  ");
  });

  test("uses terminal width when not specified", () => {
    // Set a known terminal width
    const originalColumns = process.stdout.columns;
    Object.defineProperty(process.stdout, "columns", {
      value: 60,
      writable: true,
    });

    const content = "a".repeat(LONG_CONTENT_LENGTH);
    const result = wrapContent(content, { indent: 10 });

    // Should wrap based on terminal width
    expect(result.length).toBeGreaterThan(1);

    // Restore original
    Object.defineProperty(process.stdout, "columns", {
      value: originalColumns,
      writable: true,
    });
  });

  test("respects COLUMNS environment variable", () => {
    const originalColumns = process.env.COLUMNS;
    process.env.COLUMNS = "40";

    const content = "a".repeat(LONG_CONTENT_LENGTH);
    const result = wrapContent(content, { indent: 10 });

    // Should wrap based on COLUMNS env var
    expect(result.length).toBeGreaterThan(1);

    // Restore original
    if (originalColumns !== undefined) {
      process.env.COLUMNS = originalColumns;
    } else {
      process.env.COLUMNS = undefined;
    }
  });
});
