// tldr ::: tests for config-aware language resolution

import { describe, expect, test } from "bun:test";

import { DEFAULT_LANGUAGE_REGISTRY } from "@waymarks/grammar";

import {
  buildLanguageRegistry,
  canHaveWaymarks,
  getCommentLeaders,
} from "./languages";
import type { WaymarkConfig } from "./types";

// Base config without languages (for spreading)
const BASE_CONFIG = {
  typeCase: "lowercase" as const,
  idScope: "repo" as const,
  allowTypes: [] as string[],
  skipPaths: [] as string[],
  includePaths: [] as string[],
  respectGitignore: true,
  scan: { includeCodetags: false },
  format: { spaceAroundSigil: true, normalizeCase: true },
  lint: {
    duplicateProperty: "warn" as const,
    unknownMarker: "warn" as const,
    danglingRelation: "warn" as const,
    duplicateCanonical: "warn" as const,
  },
  ids: {
    mode: "auto" as const,
    length: 6,
    rememberUserChoice: true,
    trackHistory: false,
    assignOnRefresh: false,
  },
  index: {
    refreshTriggers: [] as string[],
    autoRefreshAfterMinutes: 0,
  },
};

// Helper to create a config with language overrides
function createConfig(languages: WaymarkConfig["languages"]): WaymarkConfig {
  if (languages === undefined) {
    return BASE_CONFIG;
  }
  return { ...BASE_CONFIG, languages };
}

describe("buildLanguageRegistry", () => {
  test("returns default registry when no config provided", () => {
    const registry = buildLanguageRegistry();
    expect(registry).toBe(DEFAULT_LANGUAGE_REGISTRY);
  });

  test("returns default registry when no language overrides", () => {
    const config = createConfig(undefined);
    const registry = buildLanguageRegistry(config);
    expect(registry).toBe(DEFAULT_LANGUAGE_REGISTRY);
  });

  test("merges extension overrides with defaults", () => {
    const config = createConfig({
      extensions: { ".xyz": ["//", "/*"] },
    });
    const registry = buildLanguageRegistry(config);

    // Custom extension is added
    const xyz = registry.byExtension.get(".xyz");
    expect(xyz).toBeDefined();
    expect([...(xyz?.leaders ?? [])]).toEqual(["//", "/*"]);

    // Default extension still works
    const ts = registry.byExtension.get(".ts");
    expect(ts).toBeDefined();
    expect([...(ts?.leaders ?? [])]).toEqual(["//", "/*"]);
  });

  test("merges basename overrides with defaults", () => {
    const config = createConfig({
      // biome-ignore lint/style/useNamingConvention: basenames match actual filenames
      basenames: { MyConfig: ["#"] },
    });
    const registry = buildLanguageRegistry(config);

    // Custom basename is added
    const myConfig = registry.byBasename.get("MyConfig");
    expect(myConfig).toBeDefined();
    expect([...(myConfig?.leaders ?? [])]).toEqual(["#"]);

    // Default basename still works
    const dockerfile = registry.byBasename.get("Dockerfile");
    expect(dockerfile).toBeDefined();
    expect([...(dockerfile?.leaders ?? [])]).toEqual(["#"]);
  });

  test("overrides existing extension", () => {
    const config = createConfig({
      extensions: { ".json": ["//"] }, // Override JSON to support comments
    });
    const registry = buildLanguageRegistry(config);

    const json = registry.byExtension.get(".json");
    expect(json).toBeDefined();
    expect([...(json?.leaders ?? [])]).toEqual(["//"]); // Overridden
  });

  test("normalizes extension case", () => {
    const config = createConfig({
      extensions: { ".XYZ": ["//"] },
    });
    const registry = buildLanguageRegistry(config);

    // Should find via lowercase
    const xyz = registry.byExtension.get(".xyz");
    expect(xyz).toBeDefined();
    expect([...(xyz?.leaders ?? [])]).toEqual(["//"]);
  });
});

describe("canHaveWaymarks", () => {
  describe("default behavior (no config)", () => {
    test("returns true for known file types with comments", () => {
      expect(canHaveWaymarks("src/index.ts")).toBe(true);
      expect(canHaveWaymarks("src/app.tsx")).toBe(true);
      expect(canHaveWaymarks("script.py")).toBe(true);
      expect(canHaveWaymarks("config.yaml")).toBe(true);
      expect(canHaveWaymarks("Dockerfile")).toBe(true);
      expect(canHaveWaymarks("Makefile")).toBe(true);
    });

    test("returns false for known file types without comments", () => {
      expect(canHaveWaymarks("data.json")).toBe(false);
      expect(canHaveWaymarks("file.csv")).toBe(false);
      expect(canHaveWaymarks("package-lock.json")).toBe(false);
      expect(canHaveWaymarks("bun.lockb")).toBe(false);
    });

    test("returns true for unknown file types (try to parse)", () => {
      expect(canHaveWaymarks("mystery.xyz")).toBe(true);
      expect(canHaveWaymarks("unknown.abc")).toBe(true);
    });

    test("handles TypeScript declaration files", () => {
      expect(canHaveWaymarks("types.d.ts")).toBe(true);
      expect(canHaveWaymarks("globals.d.mts")).toBe(true);
    });
  });

  describe("skipUnknown behavior", () => {
    test("returns false for unknown files when skipUnknown is true", () => {
      const config = createConfig({ skipUnknown: true });
      expect(canHaveWaymarks("mystery.xyz", config)).toBe(false);
      expect(canHaveWaymarks("unknown.abc", config)).toBe(false);
    });

    test("still returns true for known files when skipUnknown is true", () => {
      const config = createConfig({ skipUnknown: true });
      expect(canHaveWaymarks("src/index.ts", config)).toBe(true);
      expect(canHaveWaymarks("config.yaml", config)).toBe(true);
    });

    test("still returns false for known no-comment files when skipUnknown is true", () => {
      const config = createConfig({ skipUnknown: true });
      expect(canHaveWaymarks("data.json", config)).toBe(false);
    });
  });

  describe("extension overrides", () => {
    test("enables comments for previously no-comment extension", () => {
      const config = createConfig({
        extensions: { ".json": ["//"] },
      });
      expect(canHaveWaymarks("data.json", config)).toBe(true);
    });

    test("disables comments with empty array override", () => {
      const config = createConfig({
        extensions: { ".ts": [] }, // Disable TypeScript comments
      });
      expect(canHaveWaymarks("src/index.ts", config)).toBe(false);
    });

    test("adds support for custom extension", () => {
      const config = createConfig({
        extensions: { ".custom": ["#"] },
      });
      expect(canHaveWaymarks("file.custom", config)).toBe(true);
    });
  });

  describe("basename overrides", () => {
    test("adds support for custom basename", () => {
      const config = createConfig({
        // biome-ignore lint/style/useNamingConvention: basenames match actual filenames
        basenames: { MyConfig: ["#"] },
      });
      expect(canHaveWaymarks("MyConfig", config)).toBe(true);
    });

    test("overrides existing basename", () => {
      const config = createConfig({
        // biome-ignore lint/style/useNamingConvention: basenames match actual filenames
        basenames: { Dockerfile: [] }, // Disable Dockerfile comments
      });
      expect(canHaveWaymarks("Dockerfile", config)).toBe(false);
    });
  });

  describe("config merging", () => {
    test("override affects only specified extension", () => {
      const config = createConfig({
        extensions: { ".json": ["//"] },
      });

      // JSON now has comments
      expect(canHaveWaymarks("data.json", config)).toBe(true);

      // Other extensions unchanged
      expect(canHaveWaymarks("src/index.ts", config)).toBe(true);
      expect(canHaveWaymarks("file.csv", config)).toBe(false);
    });
  });
});

describe("getCommentLeaders", () => {
  describe("default behavior (no config)", () => {
    test("returns leaders for known file types", () => {
      expect(getCommentLeaders("src/index.ts")).toEqual(["//", "/*"]);
      expect(getCommentLeaders("script.py")).toEqual(["#"]);
      expect(getCommentLeaders("query.sql")).toEqual(["--"]);
      expect(getCommentLeaders("doc.md")).toEqual(["<!--"]);
      expect(getCommentLeaders("Dockerfile")).toEqual(["#"]);
    });

    test("returns empty array for no-comment file types", () => {
      expect(getCommentLeaders("data.json")).toEqual([]);
      expect(getCommentLeaders("file.csv")).toEqual([]);
    });

    test("returns empty array for unknown file types", () => {
      expect(getCommentLeaders("mystery.xyz")).toEqual([]);
    });
  });

  describe("with config overrides", () => {
    test("returns overridden leaders for extension", () => {
      const config = createConfig({
        extensions: { ".json": ["//", "/*"] },
      });
      expect(getCommentLeaders("data.json", config)).toEqual(["//", "/*"]);
    });

    test("returns overridden leaders for basename", () => {
      const config = createConfig({
        // biome-ignore lint/style/useNamingConvention: basenames match actual filenames
        basenames: { MyConfig: ["#", "//"] },
      });
      expect(getCommentLeaders("MyConfig", config)).toEqual(["#", "//"]);
    });

    test("returns empty array for disabled extension", () => {
      const config = createConfig({
        extensions: { ".ts": [] },
      });
      expect(getCommentLeaders("src/index.ts", config)).toEqual([]);
    });
  });
});
