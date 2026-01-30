// tldr ::: tests for tokenizer utilities including comment leader detection

import { describe, expect, it } from "bun:test";

import { findCommentLeader, parseHeader } from "./tokenizer";

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

describe("findCommentLeader", () => {
  describe("default behavior (no leaders parameter)", () => {
    it("finds // comment leader", () => {
      expect(findCommentLeader("// todo ::: implement")).toBe("//");
    });

    it("finds # comment leader", () => {
      expect(findCommentLeader("# tldr ::: module description")).toBe("#");
    });

    it("finds -- comment leader", () => {
      expect(findCommentLeader("-- note ::: SQL comment")).toBe("--");
    });

    it("finds <!-- comment leader", () => {
      expect(findCommentLeader("<!-- todo ::: html comment -->")).toBe("<!--");
    });

    it("finds /* comment leader", () => {
      expect(findCommentLeader("/* css style */")).toBe("/*");
    });

    it("returns null for no comment leader", () => {
      expect(findCommentLeader("const x = 1")).toBeNull();
    });
  });

  describe("with custom leaders parameter", () => {
    it("uses provided leaders array", () => {
      const leaders = ["%%", ";;"] as const;
      expect(findCommentLeader("%% custom comment", leaders)).toBe("%%");
      expect(findCommentLeader(";; lisp style", leaders)).toBe(";;");
    });

    it("returns null when text does not match any custom leader", () => {
      const leaders = ["%%"] as const;
      expect(findCommentLeader("// not matched", leaders)).toBeNull();
    });

    it("matches first leader when multiple could match", () => {
      // Order matters - first match wins
      const leaders = ["//", "///"] as const;
      expect(findCommentLeader("/// doc comment", leaders)).toBe("//");
    });

    it("handles single-character leaders", () => {
      const leaders = ["%"] as const;
      expect(findCommentLeader("% latex comment", leaders)).toBe("%");
    });

    it("handles empty leaders array", () => {
      const leaders: readonly string[] = [];
      expect(findCommentLeader("// any text", leaders)).toBeNull();
    });

    it("respects language-specific leaders from registry", () => {
      // Simulate Python (# only)
      const pythonLeaders = ["#"] as const;
      expect(findCommentLeader("# python comment", pythonLeaders)).toBe("#");
      expect(findCommentLeader("// not python", pythonLeaders)).toBeNull();

      // Simulate SQL (-- only)
      const sqlLeaders = ["--"] as const;
      expect(findCommentLeader("-- select", sqlLeaders)).toBe("--");
      expect(findCommentLeader("# not sql", sqlLeaders)).toBeNull();

      // Simulate CSS (/* only, no //)
      const cssLeaders = ["/*"] as const;
      expect(findCommentLeader("/* css */", cssLeaders)).toBe("/*");
      expect(findCommentLeader("// not css", cssLeaders)).toBeNull();
    });
  });
});
