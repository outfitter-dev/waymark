// tldr ::: tests for block comment waymark header parsing in tokenizer

import { describe, expect, it } from "bun:test";

import { parseHeader } from "./tokenizer";

describe("block comment support", () => {
  it("parses single-line /* ... */ waymarks", () => {
    const result = parseHeader("/* todo ::: implement validation */");
    expect(result?.type).toBe("todo");
    expect(result?.content.trim()).toBe("implement validation");
  });

  it("parses CSS waymarks", () => {
    const result = parseHeader("/* tldr ::: button component styles */");
    expect(result?.type).toBe("tldr");
    expect(result?.commentLeader).toBe("/*");
  });

  it("strips trailing */ from content", () => {
    const result = parseHeader("/* note ::: performance hotpath */");
    expect(result?.content).not.toContain("*/");
  });

  it("handles waymark with no trailing space before */", () => {
    const result = parseHeader("/* fix ::: memory leak*/");
    expect(result?.type).toBe("fix");
    expect(result?.content.trim()).toBe("memory leak");
  });
});
