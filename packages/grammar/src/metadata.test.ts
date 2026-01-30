// tldr ::: unit tests for file category registry and inference

import { describe, expect, test } from "bun:test";

import {
  DEFAULT_FILE_CATEGORY_REGISTRY,
  type FileCategoryRegistry,
  inferFileCategory,
} from "./metadata";

describe("inferFileCategory", () => {
  describe("documentation files", () => {
    test("classifies .md as docs", () => {
      expect(inferFileCategory("README.md")).toBe("docs");
    });

    test("classifies .mdx as docs", () => {
      expect(inferFileCategory("guide.mdx")).toBe("docs");
    });

    test("classifies .markdown as docs", () => {
      expect(inferFileCategory("notes.markdown")).toBe("docs");
    });

    test("classifies .txt as docs", () => {
      expect(inferFileCategory("notes.txt")).toBe("docs");
    });

    test("classifies .rst as docs", () => {
      expect(inferFileCategory("docs.rst")).toBe("docs");
    });
  });

  describe("configuration files", () => {
    test("classifies .json as config", () => {
      expect(inferFileCategory("package.json")).toBe("config");
    });

    test("classifies .jsonc as config", () => {
      expect(inferFileCategory("tsconfig.jsonc")).toBe("config");
    });

    test("classifies .yaml as config", () => {
      expect(inferFileCategory("config.yaml")).toBe("config");
    });

    test("classifies .yml as config", () => {
      expect(inferFileCategory("docker-compose.yml")).toBe("config");
    });

    test("classifies .toml as config", () => {
      expect(inferFileCategory("Cargo.toml")).toBe("config");
    });

    test("classifies .ini as config", () => {
      expect(inferFileCategory("settings.ini")).toBe("config");
    });

    test("classifies .conf as config", () => {
      expect(inferFileCategory("nginx.conf")).toBe("config");
    });

    test("classifies .cfg as config", () => {
      expect(inferFileCategory("setup.cfg")).toBe("config");
    });

    test("classifies .rc as config", () => {
      // Note: files like .eslintrc have no extension (extname returns "")
      // Only files with .rc suffix like config.rc match
      expect(inferFileCategory("config.rc")).toBe("config");
    });
  });

  describe("data files", () => {
    test("classifies .csv as data", () => {
      expect(inferFileCategory("report.csv")).toBe("data");
    });

    test("classifies .tsv as data", () => {
      expect(inferFileCategory("data.tsv")).toBe("data");
    });

    test("classifies .ndjson as data", () => {
      expect(inferFileCategory("events.ndjson")).toBe("data");
    });

    test("classifies .jsonl as data", () => {
      expect(inferFileCategory("logs.jsonl")).toBe("data");
    });

    test("classifies .parquet as data", () => {
      expect(inferFileCategory("analytics.parquet")).toBe("data");
    });
  });

  describe("test files", () => {
    test("classifies .test.ts as test", () => {
      expect(inferFileCategory("utils.test.ts")).toBe("test");
    });

    test("classifies .test.tsx as test", () => {
      expect(inferFileCategory("component.test.tsx")).toBe("test");
    });

    test("classifies .test.js as test", () => {
      expect(inferFileCategory("helper.test.js")).toBe("test");
    });

    test("classifies .test.jsx as test", () => {
      expect(inferFileCategory("button.test.jsx")).toBe("test");
    });

    test("classifies .spec.ts as test", () => {
      expect(inferFileCategory("api.spec.ts")).toBe("test");
    });

    test("classifies .spec.tsx as test", () => {
      expect(inferFileCategory("modal.spec.tsx")).toBe("test");
    });

    test("classifies .spec.js as test", () => {
      expect(inferFileCategory("auth.spec.js")).toBe("test");
    });

    test("classifies .spec.jsx as test", () => {
      expect(inferFileCategory("form.spec.jsx")).toBe("test");
    });

    test("classifies files containing .test. as test", () => {
      expect(inferFileCategory("src/utils.test.helper.ts")).toBe("test");
    });

    test("classifies files containing .spec. as test", () => {
      expect(inferFileCategory("lib/api.spec.mock.js")).toBe("test");
    });

    test("classifies files containing .stories. as test", () => {
      expect(inferFileCategory("Button.stories.tsx")).toBe("test");
    });

    test("classifies files in __tests__ directory as test", () => {
      expect(inferFileCategory("src/__tests__/utils.ts")).toBe("test");
    });

    test("classifies files in __mocks__ directory as test", () => {
      expect(inferFileCategory("src/__mocks__/api.ts")).toBe("test");
    });
  });

  describe("code files (default)", () => {
    test("classifies .ts as code", () => {
      expect(inferFileCategory("index.ts")).toBe("code");
    });

    test("classifies .tsx as code", () => {
      expect(inferFileCategory("App.tsx")).toBe("code");
    });

    test("classifies .js as code", () => {
      expect(inferFileCategory("main.js")).toBe("code");
    });

    test("classifies .py as code", () => {
      expect(inferFileCategory("script.py")).toBe("code");
    });

    test("classifies .rs as code", () => {
      expect(inferFileCategory("lib.rs")).toBe("code");
    });

    test("classifies .go as code", () => {
      expect(inferFileCategory("main.go")).toBe("code");
    });

    test("classifies unknown extensions as code", () => {
      expect(inferFileCategory("file.xyz")).toBe("code");
    });
  });

  describe("edge cases", () => {
    test("returns code for undefined file path", () => {
      expect(inferFileCategory(undefined)).toBe("code");
    });

    test("handles case insensitivity for extensions", () => {
      expect(inferFileCategory("README.MD")).toBe("docs");
      expect(inferFileCategory("CONFIG.YAML")).toBe("config");
    });

    test("handles full paths", () => {
      expect(inferFileCategory("/Users/dev/project/src/index.ts")).toBe("code");
      expect(inferFileCategory("/project/docs/README.md")).toBe("docs");
    });

    test("handles relative paths", () => {
      expect(inferFileCategory("./src/utils.ts")).toBe("code");
      expect(inferFileCategory("../docs/guide.md")).toBe("docs");
    });
  });
});

describe("DEFAULT_FILE_CATEGORY_REGISTRY", () => {
  test("has docs extensions", () => {
    expect(DEFAULT_FILE_CATEGORY_REGISTRY.docs.extensions.size).toBeGreaterThan(
      0
    );
  });

  test("has config extensions", () => {
    expect(
      DEFAULT_FILE_CATEGORY_REGISTRY.config.extensions.size
    ).toBeGreaterThan(0);
  });

  test("has data extensions", () => {
    expect(DEFAULT_FILE_CATEGORY_REGISTRY.data.extensions.size).toBeGreaterThan(
      0
    );
  });

  test("has test patterns", () => {
    expect(DEFAULT_FILE_CATEGORY_REGISTRY.test.suffixes.size).toBeGreaterThan(
      0
    );
    expect(DEFAULT_FILE_CATEGORY_REGISTRY.test.pathTokens.size).toBeGreaterThan(
      0
    );
  });

  test("is frozen (immutable)", () => {
    expect(Object.isFrozen(DEFAULT_FILE_CATEGORY_REGISTRY)).toBe(true);
  });
});

describe("custom registry support", () => {
  test("allows passing custom registry to override docs extensions", () => {
    const customRegistry: FileCategoryRegistry = {
      docs: { extensions: new Set([".doc", ".docx"]) },
      config: { extensions: new Set() },
      data: { extensions: new Set() },
      test: { suffixes: new Set(), pathTokens: new Set() },
    };

    expect(inferFileCategory("report.doc", customRegistry)).toBe("docs");
    expect(inferFileCategory("README.md", customRegistry)).toBe("code"); // no longer docs
  });

  test("allows adding new config extensions", () => {
    const customRegistry: FileCategoryRegistry = {
      docs: { extensions: new Set() },
      config: { extensions: new Set([".properties", ".props"]) },
      data: { extensions: new Set() },
      test: { suffixes: new Set(), pathTokens: new Set() },
    };

    expect(inferFileCategory("app.properties", customRegistry)).toBe("config");
    expect(inferFileCategory("build.props", customRegistry)).toBe("config");
  });

  test("allows custom test patterns", () => {
    const customRegistry: FileCategoryRegistry = {
      docs: { extensions: new Set() },
      config: { extensions: new Set() },
      data: { extensions: new Set() },
      test: {
        suffixes: new Set([".e2e.ts"]),
        pathTokens: new Set(["cypress"]),
      },
    };

    expect(inferFileCategory("login.e2e.ts", customRegistry)).toBe("test");
    expect(
      inferFileCategory("cypress/integration/auth.ts", customRegistry)
    ).toBe("test");
    expect(inferFileCategory("utils.test.ts", customRegistry)).toBe("code"); // no longer test
  });

  test("uses code as fallback when no category matches", () => {
    const emptyRegistry: FileCategoryRegistry = {
      docs: { extensions: new Set() },
      config: { extensions: new Set() },
      data: { extensions: new Set() },
      test: { suffixes: new Set(), pathTokens: new Set() },
    };

    expect(inferFileCategory("anything.ts", emptyRegistry)).toBe("code");
    expect(inferFileCategory("README.md", emptyRegistry)).toBe("code");
  });
});
