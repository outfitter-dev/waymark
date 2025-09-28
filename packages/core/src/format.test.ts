// tldr ::: tests for waymark formatting utilities

import { describe, expect, test } from "bun:test";

import { formatText } from "./format";

const SAMPLE = "// TODO ::: needs cleanup";
const MULTILINE_SAMPLE = [
  "// TODO ::: implement streaming parser",
  "// ... keep backward compatibility",
  "// ... coordinate rollout :::",
].join("\n");

describe("formatText", () => {
  test("normalizes marker casing and spacing", () => {
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
      "// ... keep backward compatibility",
      "// ... coordinate rollout :::",
    ]);
  });

  test("formats html multi-line continuation block", () => {
    const htmlSource = [
      "<!-- tldr ::: summary line one",
      "<!-- ... summary line two ::: -->",
    ].join("\n");

    const { formattedText } = formatText(htmlSource, {
      file: "docs/example.md",
    });

    expect(formattedText.split("\n")).toEqual([
      "<!-- tldr ::: summary line one",
      "<!-- ... summary line two ::: -->",
    ]);
  });
});
