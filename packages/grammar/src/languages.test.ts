// tldr ::: unit tests for language registry and comment capability detection

import { describe, expect, test } from "bun:test";

import {
  canHaveComments,
  DEFAULT_LANGUAGE_REGISTRY,
  getCommentCapability,
  getLanguageId,
} from "./languages";

describe("getCommentCapability", () => {
  describe("C-style comments (// and /*)", () => {
    test("returns capability for TypeScript files", () => {
      const cap = getCommentCapability("src/index.ts");
      expect(cap).toBeDefined();
      expect(cap?.language).toBe("typescript");
      expect(cap?.leaders).toContain("//");
      expect(cap?.leaders).toContain("/*");
    });

    test("returns capability for JavaScript files", () => {
      const cap = getCommentCapability("lib/utils.js");
      expect(cap).toBeDefined();
      expect(cap?.language).toBe("javascript");
      expect(cap?.leaders).toContain("//");
    });

    test("returns capability for Go files", () => {
      const cap = getCommentCapability("main.go");
      expect(cap).toBeDefined();
      expect(cap?.language).toBe("go");
      expect(cap?.leaders).toContain("//");
    });

    test("returns capability for Rust files", () => {
      const cap = getCommentCapability("src/lib.rs");
      expect(cap).toBeDefined();
      expect(cap?.language).toBe("rust");
      expect(cap?.leaders).toContain("//");
    });

    test("returns capability for Java files", () => {
      const cap = getCommentCapability("App.java");
      expect(cap).toBeDefined();
      expect(cap?.language).toBe("java");
      expect(cap?.leaders).toContain("//");
    });

    test("returns capability for JSONC files", () => {
      const cap = getCommentCapability("tsconfig.jsonc");
      expect(cap).toBeDefined();
      expect(cap?.language).toBe("jsonc");
      expect(cap?.leaders).toContain("//");
    });

    test("returns capability for JSON5 files", () => {
      const cap = getCommentCapability("config.json5");
      expect(cap).toBeDefined();
      expect(cap?.language).toBe("json5");
      expect(cap?.leaders).toContain("//");
    });
  });

  describe("Hash comments (#)", () => {
    test("returns capability for Python files", () => {
      const cap = getCommentCapability("script.py");
      expect(cap).toBeDefined();
      expect(cap?.language).toBe("python");
      expect(cap?.leaders).toEqual(["#"]);
    });

    test("returns capability for Ruby files", () => {
      const cap = getCommentCapability("app.rb");
      expect(cap).toBeDefined();
      expect(cap?.language).toBe("ruby");
      expect(cap?.leaders).toEqual(["#"]);
    });

    test("returns capability for shell scripts", () => {
      const cap = getCommentCapability("deploy.sh");
      expect(cap).toBeDefined();
      expect(cap?.language).toBe("shell");
      expect(cap?.leaders).toEqual(["#"]);
    });

    test("returns capability for YAML files", () => {
      const cap = getCommentCapability("config.yaml");
      expect(cap).toBeDefined();
      expect(cap?.language).toBe("yaml");
      expect(cap?.leaders).toEqual(["#"]);
    });

    test("returns capability for TOML files", () => {
      const cap = getCommentCapability("Cargo.toml");
      expect(cap).toBeDefined();
      expect(cap?.language).toBe("toml");
      expect(cap?.leaders).toEqual(["#"]);
    });
  });

  describe("SQL-style comments (--)", () => {
    test("returns capability for SQL files", () => {
      const cap = getCommentCapability("schema.sql");
      expect(cap).toBeDefined();
      expect(cap?.language).toBe("sql");
      expect(cap?.leaders).toEqual(["--"]);
    });

    test("returns capability for Lua files", () => {
      const cap = getCommentCapability("init.lua");
      expect(cap).toBeDefined();
      expect(cap?.language).toBe("lua");
      expect(cap?.leaders).toEqual(["--"]);
    });

    test("returns capability for Haskell files", () => {
      const cap = getCommentCapability("Main.hs");
      expect(cap).toBeDefined();
      expect(cap?.language).toBe("haskell");
      expect(cap?.leaders).toEqual(["--"]);
    });
  });

  describe("HTML-style comments (<!--)", () => {
    test("returns capability for Markdown files", () => {
      const cap = getCommentCapability("README.md");
      expect(cap).toBeDefined();
      expect(cap?.language).toBe("markdown");
      expect(cap?.leaders).toEqual(["<!--"]);
    });

    test("returns capability for HTML files", () => {
      const cap = getCommentCapability("index.html");
      expect(cap).toBeDefined();
      expect(cap?.language).toBe("html");
      expect(cap?.leaders).toEqual(["<!--"]);
    });

    test("returns capability for XML files", () => {
      const cap = getCommentCapability("config.xml");
      expect(cap).toBeDefined();
      expect(cap?.language).toBe("xml");
      expect(cap?.leaders).toEqual(["<!--"]);
    });

    test("returns capability for SVG files", () => {
      const cap = getCommentCapability("icon.svg");
      expect(cap).toBeDefined();
      expect(cap?.language).toBe("svg");
      expect(cap?.leaders).toEqual(["<!--"]);
    });
  });

  describe("CSS files (/* only)", () => {
    test("returns capability for CSS files", () => {
      const cap = getCommentCapability("styles.css");
      expect(cap).toBeDefined();
      expect(cap?.language).toBe("css");
      expect(cap?.leaders).toEqual(["/*"]);
    });

    test("returns capability for SCSS files with both styles", () => {
      const cap = getCommentCapability("styles.scss");
      expect(cap).toBeDefined();
      expect(cap?.language).toBe("scss");
      expect(cap?.leaders).toContain("//");
      expect(cap?.leaders).toContain("/*");
    });
  });

  describe("files without comment support", () => {
    test("returns empty leaders for JSON files", () => {
      const cap = getCommentCapability("package.json");
      expect(cap).toBeDefined();
      expect(cap?.language).toBe("json");
      expect(cap?.leaders).toEqual([]);
    });

    test("returns empty leaders for CSV files", () => {
      const cap = getCommentCapability("data.csv");
      expect(cap).toBeDefined();
      expect(cap?.language).toBe("data");
      expect(cap?.leaders).toEqual([]);
    });

    test("returns empty leaders for TSV files", () => {
      const cap = getCommentCapability("data.tsv");
      expect(cap).toBeDefined();
      expect(cap?.leaders).toEqual([]);
    });

    test("returns empty leaders for Parquet files", () => {
      const cap = getCommentCapability("data.parquet");
      expect(cap).toBeDefined();
      expect(cap?.leaders).toEqual([]);
    });

    test("returns empty leaders for lock files", () => {
      const cap = getCommentCapability("deps.lock");
      expect(cap).toBeDefined();
      expect(cap?.leaders).toEqual([]);
    });

    test("returns empty leaders for bun.lockb", () => {
      const cap = getCommentCapability("bun.lockb");
      expect(cap).toBeDefined();
      expect(cap?.leaders).toEqual([]);
    });
  });

  describe("basename matching", () => {
    test("matches Dockerfile", () => {
      const cap = getCommentCapability("Dockerfile");
      expect(cap).toBeDefined();
      expect(cap?.language).toBe("dockerfile");
      expect(cap?.leaders).toEqual(["#"]);
    });

    test("matches Dockerfile in path", () => {
      const cap = getCommentCapability("docker/Dockerfile");
      expect(cap).toBeDefined();
      expect(cap?.language).toBe("dockerfile");
    });

    test("matches Makefile", () => {
      const cap = getCommentCapability("Makefile");
      expect(cap).toBeDefined();
      expect(cap?.language).toBe("makefile");
      expect(cap?.leaders).toEqual(["#"]);
    });

    test("matches Jenkinsfile", () => {
      const cap = getCommentCapability("Jenkinsfile");
      expect(cap).toBeDefined();
      expect(cap?.language).toBe("groovy");
      expect(cap?.leaders).toContain("//");
    });

    test("matches .gitignore", () => {
      const cap = getCommentCapability(".gitignore");
      expect(cap).toBeDefined();
      expect(cap?.language).toBe("gitignore");
      expect(cap?.leaders).toEqual(["#"]);
    });

    test("matches .env", () => {
      const cap = getCommentCapability(".env");
      expect(cap).toBeDefined();
      expect(cap?.language).toBe("dotenv");
      expect(cap?.leaders).toEqual(["#"]);
    });

    test("matches .env.local", () => {
      const cap = getCommentCapability(".env.local");
      expect(cap).toBeDefined();
      expect(cap?.language).toBe("dotenv");
    });

    test("matches package-lock.json as no comments", () => {
      const cap = getCommentCapability("package-lock.json");
      expect(cap).toBeDefined();
      expect(cap?.language).toBe("json");
      expect(cap?.leaders).toEqual([]);
    });

    test("matches .bashrc", () => {
      const cap = getCommentCapability(".bashrc");
      expect(cap).toBeDefined();
      expect(cap?.language).toBe("bash");
      expect(cap?.leaders).toEqual(["#"]);
    });

    test("matches Gemfile", () => {
      const cap = getCommentCapability("Gemfile");
      expect(cap).toBeDefined();
      expect(cap?.language).toBe("ruby");
    });
  });

  describe("unknown extensions", () => {
    test("returns undefined for unknown extension", () => {
      const cap = getCommentCapability("mystery.xyz");
      expect(cap).toBeUndefined();
    });

    test("returns undefined for extensionless files not in basename map", () => {
      const cap = getCommentCapability("unknownfile");
      expect(cap).toBeUndefined();
    });

    test("returns undefined for made-up extensions", () => {
      const cap = getCommentCapability("file.asdfghjkl");
      expect(cap).toBeUndefined();
    });
  });

  describe("case sensitivity", () => {
    test("handles uppercase extensions", () => {
      const cap = getCommentCapability("README.MD");
      expect(cap).toBeDefined();
      expect(cap?.language).toBe("markdown");
    });

    test("handles mixed case extensions", () => {
      const cap = getCommentCapability("script.Py");
      expect(cap).toBeDefined();
      expect(cap?.language).toBe("python");
    });

    test("handles uppercase JSON", () => {
      const cap = getCommentCapability("data.JSON");
      expect(cap).toBeDefined();
      expect(cap?.language).toBe("json");
      expect(cap?.leaders).toEqual([]);
    });

    test("handles mixed case TypeScript", () => {
      const cap = getCommentCapability("index.Ts");
      expect(cap).toBeDefined();
      expect(cap?.language).toBe("typescript");
    });

    // Basenames are case-sensitive (Dockerfile != dockerfile)
    test("basename matching is case-sensitive", () => {
      const cap = getCommentCapability("dockerfile");
      // Should fall through to extension check, which returns undefined
      expect(cap).toBeUndefined();
    });
  });

  describe("edge cases", () => {
    test("handles .d.ts declaration files", () => {
      const cap = getCommentCapability("types.d.ts");
      expect(cap).toBeDefined();
      expect(cap?.language).toBe("typescript");
      expect(cap?.leaders).toContain("//");
    });

    test("handles .d.tsx declaration files", () => {
      const cap = getCommentCapability("components.d.tsx");
      expect(cap).toBeDefined();
      expect(cap?.language).toBe("tsx");
    });

    test("handles .d.mts declaration files", () => {
      const cap = getCommentCapability("module.d.mts");
      expect(cap).toBeDefined();
      expect(cap?.language).toBe("typescript");
    });

    test("handles .d.cts declaration files", () => {
      const cap = getCommentCapability("common.d.cts");
      expect(cap).toBeDefined();
      expect(cap?.language).toBe("typescript");
    });

    test("handles paths with directories", () => {
      const cap = getCommentCapability(
        "/Users/dev/project/src/utils/helpers.ts"
      );
      expect(cap).toBeDefined();
      expect(cap?.language).toBe("typescript");
    });

    test("handles relative paths", () => {
      const cap = getCommentCapability("./src/index.ts");
      expect(cap).toBeDefined();
      expect(cap?.language).toBe("typescript");
    });

    test("handles files with multiple dots", () => {
      const cap = getCommentCapability("app.config.ts");
      expect(cap).toBeDefined();
      expect(cap?.language).toBe("typescript");
    });

    test("handles .test.ts as TypeScript", () => {
      const cap = getCommentCapability("utils.test.ts");
      expect(cap).toBeDefined();
      expect(cap?.language).toBe("typescript");
    });

    test("handles .spec.js as JavaScript", () => {
      const cap = getCommentCapability("component.spec.js");
      expect(cap).toBeDefined();
      expect(cap?.language).toBe("javascript");
    });
  });
});

describe("canHaveComments", () => {
  test("returns true for TypeScript files", () => {
    expect(canHaveComments("index.ts")).toBe(true);
  });

  test("returns true for Python files", () => {
    expect(canHaveComments("script.py")).toBe(true);
  });

  test("returns true for Markdown files", () => {
    expect(canHaveComments("README.md")).toBe(true);
  });

  test("returns false for JSON files (known, no comments)", () => {
    expect(canHaveComments("package.json")).toBe(false);
  });

  test("returns false for CSV files (known, no comments)", () => {
    expect(canHaveComments("data.csv")).toBe(false);
  });

  test("returns undefined for unknown extensions", () => {
    expect(canHaveComments("mystery.xyz")).toBeUndefined();
  });

  test("returns true for Dockerfile (basename)", () => {
    expect(canHaveComments("Dockerfile")).toBe(true);
  });

  test("returns false for package-lock.json (basename, no comments)", () => {
    expect(canHaveComments("package-lock.json")).toBe(false);
  });

  test("handles case insensitivity", () => {
    expect(canHaveComments("FILE.JSON")).toBe(false);
    expect(canHaveComments("SCRIPT.PY")).toBe(true);
  });
});

describe("getLanguageId", () => {
  test("returns language for TypeScript", () => {
    expect(getLanguageId("index.ts")).toBe("typescript");
  });

  test("returns language for TSX", () => {
    expect(getLanguageId("Component.tsx")).toBe("tsx");
  });

  test("returns language for Python", () => {
    expect(getLanguageId("script.py")).toBe("python");
  });

  test("returns language for JSON (even without comments)", () => {
    expect(getLanguageId("data.json")).toBe("json");
  });

  test("returns language for Dockerfile", () => {
    expect(getLanguageId("Dockerfile")).toBe("dockerfile");
  });

  test("returns language for .gitignore", () => {
    expect(getLanguageId(".gitignore")).toBe("gitignore");
  });

  test("returns undefined for unknown extension", () => {
    expect(getLanguageId("mystery.xyz")).toBeUndefined();
  });

  test("handles case insensitivity", () => {
    expect(getLanguageId("FILE.TS")).toBe("typescript");
  });

  test("returns correct language for .d.ts", () => {
    expect(getLanguageId("types.d.ts")).toBe("typescript");
  });
});

// Minimum expected counts for registry size validation
const MIN_EXTENSION_COUNT = 80;
const MIN_BASENAME_COUNT = 30;

describe("DEFAULT_LANGUAGE_REGISTRY", () => {
  test("byExtension is a ReadonlyMap", () => {
    expect(DEFAULT_LANGUAGE_REGISTRY.byExtension).toBeInstanceOf(Map);
  });

  test("byBasename is a ReadonlyMap", () => {
    expect(DEFAULT_LANGUAGE_REGISTRY.byBasename).toBeInstanceOf(Map);
  });

  test("contains expected number of extensions (approximately 80+)", () => {
    expect(DEFAULT_LANGUAGE_REGISTRY.byExtension.size).toBeGreaterThanOrEqual(
      MIN_EXTENSION_COUNT
    );
  });

  test("contains expected number of basenames (approximately 30+)", () => {
    expect(DEFAULT_LANGUAGE_REGISTRY.byBasename.size).toBeGreaterThanOrEqual(
      MIN_BASENAME_COUNT
    );
  });

  test("registry is frozen (immutable)", () => {
    expect(Object.isFrozen(DEFAULT_LANGUAGE_REGISTRY)).toBe(true);
  });

  test("leaders arrays are frozen (immutable)", () => {
    const cap = DEFAULT_LANGUAGE_REGISTRY.byExtension.get(".ts");
    expect(cap).toBeDefined();
    expect(Object.isFrozen(cap?.leaders)).toBe(true);
  });
});

describe("custom registry support", () => {
  test("allows passing custom registry", () => {
    const customRegistry = {
      byExtension: new Map([
        [".custom", { language: "custom-lang", leaders: ["%%"] as const }],
      ]),
      byBasename: new Map([
        ["CustomFile", { language: "custom-file", leaders: ["@@"] as const }],
      ]),
    };

    const cap = getCommentCapability("test.custom", customRegistry);
    expect(cap).toBeDefined();
    expect(cap?.language).toBe("custom-lang");
    expect(cap?.leaders).toEqual(["%%"]);

    const baseCap = getCommentCapability("CustomFile", customRegistry);
    expect(baseCap).toBeDefined();
    expect(baseCap?.language).toBe("custom-file");
  });

  test("custom registry can override defaults", () => {
    const customRegistry = {
      byExtension: new Map([
        [".ts", { language: "custom-typescript", leaders: ["###"] as const }],
      ]),
      byBasename: new Map(),
    };

    const cap = getCommentCapability("index.ts", customRegistry);
    expect(cap).toBeDefined();
    expect(cap?.language).toBe("custom-typescript");
    expect(cap?.leaders).toEqual(["###"]);
  });

  test(".d.mts uses .mts mapping when available in custom registry", () => {
    const customRegistry = {
      byExtension: new Map([
        [".mts", { language: "custom-mts", leaders: ["//"] as const }],
        [".ts", { language: "custom-ts", leaders: ["//"] as const }],
      ]),
      byBasename: new Map(),
    };

    const cap = getCommentCapability("types.d.mts", customRegistry);
    expect(cap).toBeDefined();
    expect(cap?.language).toBe("custom-mts");
  });

  test(".d.cts uses .cts mapping when available in custom registry", () => {
    const customRegistry = {
      byExtension: new Map([
        [".cts", { language: "custom-cts", leaders: ["//"] as const }],
        [".ts", { language: "custom-ts", leaders: ["//"] as const }],
      ]),
      byBasename: new Map(),
    };

    const cap = getCommentCapability("types.d.cts", customRegistry);
    expect(cap).toBeDefined();
    expect(cap?.language).toBe("custom-cts");
  });

  test(".d.mts falls back to .ts when .mts not in registry", () => {
    const customRegistry = {
      byExtension: new Map([
        [".ts", { language: "custom-ts", leaders: ["//"] as const }],
      ]),
      byBasename: new Map(),
    };

    const cap = getCommentCapability("types.d.mts", customRegistry);
    expect(cap).toBeDefined();
    expect(cap?.language).toBe("custom-ts");
  });

  test(".d.cts falls back to .ts when .cts not in registry", () => {
    const customRegistry = {
      byExtension: new Map([
        [".ts", { language: "custom-ts", leaders: ["//"] as const }],
      ]),
      byBasename: new Map(),
    };

    const cap = getCommentCapability("types.d.cts", customRegistry);
    expect(cap).toBeDefined();
    expect(cap?.language).toBe("custom-ts");
  });
});
