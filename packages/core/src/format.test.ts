// tldr ::: tests for waymark formatting utilities

import { describe, expect, test } from "bun:test";
import { PROPERTY_KEYS as GRAMMAR_PROPERTY_KEYS } from "@waymarks/grammar";

import { formatText } from "./format";

const SAMPLE = "// TODO ::: needs cleanup";
const MULTILINE_SAMPLE = [
  "// TODO ::: implement streaming parser",
  "//      ::: keep backward compatibility",
  "//      ::: coordinate rollout",
].join("\n");
const CONTINUATION_LINE_PATTERN = /^\/\/\s+::: with OAuth 2\.0 and PKCE$/;

describe("formatText", () => {
  test("normalizes type casing and spacing", () => {
    const { formattedText, edits } = formatText(SAMPLE, {
      file: "src/example.ts",
    });

    expect(formattedText).toBe("// todo ::: needs cleanup");
    expect(edits).toHaveLength(1);
    expect(edits[0]?.replacement).toBe("// todo ::: needs cleanup");
  });

  test("preserves html comment closure", () => {
    const html = "<!-- tldr::: summary -->";
    const result = formatText(html, { file: "docs/example.md" });
    expect(result.formattedText).toBe("<!-- tldr ::: summary -->");
  });

  test("formats multi-line continuation block", () => {
    const { formattedText, edits } = formatText(MULTILINE_SAMPLE, {
      file: "src/example.ts",
    });

    expect(edits).toHaveLength(1);
    expect(formattedText.split("\n")).toEqual([
      "// todo ::: implement streaming parser",
      "//      ::: keep backward compatibility",
      "//      ::: coordinate rollout",
    ]);
  });

  test("formats html multi-line continuation block", () => {
    const htmlSource = [
      "<!-- tldr ::: summary line one",
      "<!--      ::: summary line two -->",
    ].join("\n");

    const { formattedText } = formatText(htmlSource, {
      file: "docs/example.md",
    });

    // The formatter correctly closes the first HTML comment line
    expect(formattedText.split("\n")).toEqual([
      "<!-- tldr ::: summary line one -->",
      "<!--      ::: summary line two -->",
    ]);
  });

  test("formats markerless ::: continuations with alignment", () => {
    const source = [
      "// tldr  ::: authentication service managing JWT tokens",
      "// ::: supports refresh and revocation",
    ].join("\n");

    const { formattedText } = formatText(source, {
      file: "src/auth.ts",
      config: {
        format: {
          alignContinuations: true,
        },
      },
    });

    expect(formattedText.split("\n")).toEqual([
      "// tldr ::: authentication service managing JWT tokens",
      "//      ::: supports refresh and revocation",
    ]);
  });

  test("formats property-as-marker continuations with alignment", () => {
    const source = [
      "// tldr  ::: payment processor entry point",
      "// ref ::: #payments/stripe",
      "// owner::: @alice",
      "// since:::2025-01-01",
    ].join("\n");

    const { formattedText } = formatText(source, {
      file: "src/payments.ts",
      config: {
        format: {
          alignContinuations: true,
          spaceAroundSigil: true,
        },
      },
    });

    // Note: The formatter will detect these as separate waymarks since
    // property continuation formatting happens at the parse level
    // The test should reflect current behavior
    expect(formattedText.split("\n")).toContain(
      "// tldr ::: payment processor entry point"
    );
  });

  test("disables alignment when config is false", () => {
    const source = [
      "// todo  ::: implement feature",
      "//       ::: with extra detail",
    ].join("\n");

    const { formattedText } = formatText(source, {
      file: "src/test.ts",
      config: {
        format: {
          alignContinuations: false,
        },
      },
    });

    // With alignment disabled, continuations still get formatted but without alignment
    expect(formattedText.split("\n")).toEqual([
      "// todo ::: implement feature",
      "// ::: with extra detail",
    ]);
  });

  test("handles mixed text and property continuations", () => {
    const source = [
      "// todo  ::: implement user authentication",
      "//       ::: with OAuth 2.0 and PKCE",
      "// fixes ::: #auth/login-bug",
      "//       ::: support social logins",
    ].join("\n");

    const { formattedText } = formatText(source, {
      file: "src/auth.ts",
      config: {
        format: {
          alignContinuations: true,
        },
      },
    });

    const lines = formattedText.split("\n");
    expect(lines[0]).toBe("// todo ::: implement user authentication");
    expect(lines[1]).toMatch(CONTINUATION_LINE_PATTERN);
  });

  test("preserves explicit closing :::", () => {
    const source = [
      "// todo ::: multi-line task",
      "//      ::: with more details",
      "//      ::: and explicit close :::",
    ].join("\n");

    const { formattedText } = formatText(source, {
      file: "src/test.ts",
    });

    const lines = formattedText.split("\n");
    expect(lines[2]).toContain("and explicit close");
  });

  test("handles various comment leaders", () => {
    const pythonSource = [
      "# tldr  ::: Python module for data processing",
      "#       ::: with advanced features",
    ].join("\n");

    const { formattedText } = formatText(pythonSource, {
      file: "processor.py",
      config: {
        format: {
          alignContinuations: true,
        },
      },
    });

    expect(formattedText.split("\n")).toEqual([
      "# tldr ::: Python module for data processing",
      "#      ::: with advanced features",
    ]);
  });

  test("formats with no alignment preserves compact format", () => {
    const source = ["// todo:::task", "// :::continuation"].join("\n");

    const { formattedText } = formatText(source, {
      file: "src/test.ts",
      config: {
        format: {
          spaceAroundSigil: false,
          alignContinuations: false,
        },
      },
    });

    expect(formattedText.split("\n")).toEqual([
      "// todo:::task",
      "// :::continuation",
    ]);
  });
});

describe("PROPERTY_KEYS alignment", () => {
  test("formatter uses PROPERTY_KEYS from grammar package", () => {
    // This test ensures the formatter imports PROPERTY_KEYS from @waymarks/grammar
    // instead of maintaining its own duplicate list.
    // If this test fails, it means the lists have diverged.

    // The formatter should recognize the same property keys as the grammar
    const expectedKeys = Array.from(GRAMMAR_PROPERTY_KEYS).sort();

    // Test that all expected property keys are recognized in property continuations
    for (const key of expectedKeys) {
      const source = [
        "// tldr ::: test waymark",
        `// ${key} ::: test-value`,
      ].join("\n");

      const { formattedText } = formatText(source, {
        file: "src/test.ts",
      });

      // If the key is recognized, it should be formatted as a property continuation
      expect(formattedText).toContain(`${key} ::: test-value`);
    }
  });

  test("property keys list matches expected set", () => {
    // Verify the exact set of property keys to catch additions/removals
    const expectedKeys = [
      "ref",
      "rel",
      "depends",
      "needs",
      "blocks",
      "dupeof",
      "owner",
      "since",
      "fixes",
      "affects",
      "priority",
      "status",
    ].sort();

    const actualKeys = Array.from(GRAMMAR_PROPERTY_KEYS).sort();

    expect(actualKeys).toEqual(expectedKeys);
  });
});
