// tldr ::: tests for config loading, Zod schema validation, and scope resolution

import { describe, expect, test } from "bun:test";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { DEFAULT_CONFIG, loadConfigFromDisk, resolveConfig } from "./config";
import { WaymarkConfigSchema } from "./types";

async function withTempDir(prefix: string, fn: (dir: string) => Promise<void>) {
  const dir = await mkdtemp(join(tmpdir(), prefix));
  try {
    await fn(dir);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

// ---------------------------------------------------------------------------
// Zod Schema
// ---------------------------------------------------------------------------
describe("WaymarkConfigSchema", () => {
  test("validates DEFAULT_CONFIG successfully", () => {
    const result = WaymarkConfigSchema.safeParse(DEFAULT_CONFIG);
    expect(result.success).toBe(true);
  });

  test("accepts snake_case keys and normalizes to camelCase", () => {
    const expectedRefreshMinutes = 5;

    // Snake_case input mirrors how YAML/TOML configs arrive before normalization.
    // Built via JSON.parse to avoid biome naming-convention lint on snake_case keys.
    const input = JSON.parse(`{
      "type_case": "uppercase",
      "id_scope": "file",
      "allow_types": ["todo", "fix"],
      "skip_paths": ["**/dist/**"],
      "include_paths": [],
      "respect_gitignore": false,
      "scan": { "include_codetags": true, "include_ignored": false },
      "format": {
        "space_around_sigil": false,
        "normalize_case": false,
        "align_continuations": false
      },
      "lint": {
        "duplicate_property": "ignore",
        "unknown_marker": "error",
        "dangling_relation": "warn",
        "duplicate_canonical": "warn"
      },
      "ids": {
        "mode": "auto",
        "length": ${expectedRefreshMinutes},
        "remember_user_choice": false,
        "track_history": false,
        "assign_on_refresh": true
      },
      "index": {
        "refresh_triggers": ["commit"],
        "auto_refresh_after_minutes": ${expectedRefreshMinutes}
      }
    }`);

    const result = WaymarkConfigSchema.safeParse(input);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.typeCase).toBe("uppercase");
      expect(result.data.idScope).toBe("file");
      expect(result.data.respectGitignore).toBe(false);
      expect(result.data.scan.includeCodetags).toBe(true);
      expect(result.data.format.spaceAroundSigil).toBe(false);
      expect(result.data.lint.duplicateProperty).toBe("ignore");
      expect(result.data.ids.rememberUserChoice).toBe(false);
      expect(result.data.index.autoRefreshAfterMinutes).toBe(
        expectedRefreshMinutes
      );
    }
  });

  test("rejects invalid typeCase value", () => {
    const input = { ...DEFAULT_CONFIG, typeCase: "SCREAMING" };
    const result = WaymarkConfigSchema.safeParse(input);
    expect(result.success).toBe(false);
  });

  test("rejects invalid lint severity", () => {
    const input = {
      ...DEFAULT_CONFIG,
      lint: { ...DEFAULT_CONFIG.lint, unknownMarker: "fatal" },
    };
    const result = WaymarkConfigSchema.safeParse(input);
    expect(result.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// resolveConfig
// ---------------------------------------------------------------------------
describe("resolveConfig", () => {
  test("returns defaults when no overrides provided", () => {
    const config = resolveConfig();
    expect(config).toEqual(DEFAULT_CONFIG);
  });

  test("merges partial overrides into defaults", () => {
    const config = resolveConfig({ typeCase: "uppercase" });
    expect(config.typeCase).toBe("uppercase");
    // Other defaults preserved
    expect(config.format.spaceAroundSigil).toBe(true);
  });

  test("deep merges nested objects", () => {
    const config = resolveConfig({
      lint: { unknownMarker: "error" },
    });
    expect(config.lint.unknownMarker).toBe("error");
    // Other lint defaults preserved
    expect(config.lint.duplicateProperty).toBe("warn");
  });
});

// ---------------------------------------------------------------------------
// loadConfigFromDisk — YAML
// ---------------------------------------------------------------------------
describe("loadConfigFromDisk", () => {
  test("returns ok Result with defaults when no config exists", async () => {
    await withTempDir("waymark-config-default-", async (dir) => {
      const result = await loadConfigFromDisk({
        cwd: dir,
        scope: "project",
      });
      expect(result.isOk()).toBe(true);
      expect(result.unwrap()).toEqual(DEFAULT_CONFIG);
    });
  });

  test("parses explicit YAML config", async () => {
    await withTempDir("waymark-config-yaml-", async (dir) => {
      const filePath = join(dir, "custom.yaml");
      await writeFile(filePath, "type_case: uppercase\n", "utf8");

      const result = await loadConfigFromDisk({
        cwd: dir,
        explicitPath: filePath,
      });
      expect(result.isOk()).toBe(true);
      expect(result.unwrap().typeCase).toBe("uppercase");
    });
  });

  test("project scope reads .waymark/config.* up the tree", async () => {
    await withTempDir("waymark-config-project-", async (dir) => {
      const projectRoot = join(dir, "repo");
      const nestedDir = join(projectRoot, "packages", "cli");
      await mkdir(nestedDir, { recursive: true });
      await mkdir(join(projectRoot, ".waymark"), { recursive: true });
      await writeFile(
        join(projectRoot, ".waymark", "config.yaml"),
        "allow_types:\n  - idea\nformat:\n  normalize_case: false\n",
        "utf8"
      );

      const result = await loadConfigFromDisk({
        cwd: nestedDir,
        scope: "project",
      });
      expect(result.isOk()).toBe(true);
      const config = result.unwrap();
      expect(config.allowTypes).toContain("idea");
      expect(config.format.normalizeCase).toBe(false);
    });
  });

  test("default scope discovers .waymark/config.yaml file", async () => {
    await withTempDir("waymark-config-default-", async (dir) => {
      const repoRoot = join(dir, "repo");
      const nestedDir = join(repoRoot, "src");
      await mkdir(nestedDir, { recursive: true });
      await mkdir(join(repoRoot, ".waymark"), { recursive: true });
      await writeFile(
        join(repoRoot, ".waymark", "config.yaml"),
        "type_case: uppercase\n",
        "utf8"
      );

      const result = await loadConfigFromDisk({ cwd: nestedDir });
      expect(result.isOk()).toBe(true);
      expect(result.unwrap().typeCase).toBe("uppercase");
    });
  });

  test("parses scan include_codetags option", async () => {
    await withTempDir("waymark-config-scan-", async (dir) => {
      const configDir = join(dir, ".waymark");
      await mkdir(configDir, { recursive: true });
      await writeFile(
        join(configDir, "config.yaml"),
        "scan:\n  include_codetags: true\n",
        "utf8"
      );

      const result = await loadConfigFromDisk({
        cwd: dir,
        scope: "project",
      });
      expect(result.isOk()).toBe(true);
      expect(result.unwrap().scan.includeCodetags).toBe(true);
    });
  });

  test("user scope reads from XDG_CONFIG_HOME", async () => {
    await withTempDir("waymark-config-user-", async (dir) => {
      const configDir = join(dir, "waymark");
      await mkdir(configDir, { recursive: true });
      await writeFile(
        join(configDir, "config.yaml"),
        'skip_paths:\n  - "**/build/**"\n',
        "utf8"
      );

      const result = await loadConfigFromDisk({
        scope: "user",
        // biome-ignore lint/style/useNamingConvention: environment variables are uppercase by convention
        env: { XDG_CONFIG_HOME: dir },
      });
      expect(result.isOk()).toBe(true);
      expect(result.unwrap().skipPaths).toContain("**/build/**");
    });
  });

  test("parses languages.extensions option", async () => {
    await withTempDir("waymark-config-lang-ext-", async (dir) => {
      const configDir = join(dir, ".waymark");
      await mkdir(configDir, { recursive: true });
      await writeFile(
        join(configDir, "config.yaml"),
        `languages:
  extensions:
    .custom: ["//", "#"]
    vue: ["<!--"]
`,
        "utf8"
      );

      const result = await loadConfigFromDisk({
        cwd: dir,
        scope: "project",
      });
      expect(result.isOk()).toBe(true);
      const config = result.unwrap();
      expect(config.languages).toBeDefined();
      expect(config.languages?.extensions?.[".custom"]).toEqual(["//", "#"]);
      // Extensions without leading dot should get normalized
      expect(config.languages?.extensions?.[".vue"]).toEqual(["<!--"]);
    });
  });

  test("parses languages.basenames option", async () => {
    await withTempDir("waymark-config-lang-basename-", async (dir) => {
      const configDir = join(dir, ".waymark");
      await mkdir(configDir, { recursive: true });
      await writeFile(
        join(configDir, "config.yaml"),
        `languages:
  basenames:
    Makefile: ["#"]
    Dockerfile: ["#"]
`,
        "utf8"
      );

      const result = await loadConfigFromDisk({
        cwd: dir,
        scope: "project",
      });
      expect(result.isOk()).toBe(true);
      const config = result.unwrap();
      expect(config.languages).toBeDefined();
      expect(config.languages?.basenames?.Makefile).toEqual(["#"]);
      expect(config.languages?.basenames?.Dockerfile).toEqual(["#"]);
    });
  });

  test("parses languages.skipUnknown boolean (camelCase)", async () => {
    await withTempDir("waymark-config-lang-skip-camel-", async (dir) => {
      const configDir = join(dir, ".waymark");
      await mkdir(configDir, { recursive: true });
      await writeFile(
        join(configDir, "config.yaml"),
        `languages:
  skipUnknown: true
`,
        "utf8"
      );

      const result = await loadConfigFromDisk({
        cwd: dir,
        scope: "project",
      });
      expect(result.isOk()).toBe(true);
      expect(result.unwrap().languages?.skipUnknown).toBe(true);
    });
  });

  test("parses languages.skip_unknown boolean (snake_case)", async () => {
    await withTempDir("waymark-config-lang-skip-snake-", async (dir) => {
      const configDir = join(dir, ".waymark");
      await mkdir(configDir, { recursive: true });
      await writeFile(
        join(configDir, "config.yaml"),
        `languages:
  skip_unknown: true
`,
        "utf8"
      );

      const result = await loadConfigFromDisk({
        cwd: dir,
        scope: "project",
      });
      expect(result.isOk()).toBe(true);
      expect(result.unwrap().languages?.skipUnknown).toBe(true);
    });
  });

  test("ignores invalid languages.extensions (non-array leaders)", async () => {
    await withTempDir("waymark-config-lang-invalid-", async (dir) => {
      const configDir = join(dir, ".waymark");
      await mkdir(configDir, { recursive: true });
      await writeFile(
        join(configDir, "config.yaml"),
        `languages:
  extensions:
    .valid: ["//"]
    .invalid: "not-an-array"
    .alsoInvalid: 123
`,
        "utf8"
      );

      const result = await loadConfigFromDisk({
        cwd: dir,
        scope: "project",
      });
      expect(result.isOk()).toBe(true);
      const config = result.unwrap();
      expect(config.languages?.extensions?.[".valid"]).toEqual(["//"]);
      // Invalid entries should be silently ignored
      expect(config.languages?.extensions?.[".invalid"]).toBeUndefined();
      expect(config.languages?.extensions?.[".alsoInvalid"]).toBeUndefined();
    });
  });

  // -------------------------------------------------------------------------
  // TOML support (new)
  // -------------------------------------------------------------------------
  test("parses TOML config file", async () => {
    await withTempDir("waymark-config-toml-", async (dir) => {
      const configDir = join(dir, ".waymark");
      await mkdir(configDir, { recursive: true });
      await writeFile(
        join(configDir, "config.toml"),
        `type_case = "uppercase"
respect_gitignore = false

[format]
normalize_case = false
`,
        "utf8"
      );

      const result = await loadConfigFromDisk({
        cwd: dir,
        scope: "project",
      });
      expect(result.isOk()).toBe(true);
      const config = result.unwrap();
      expect(config.typeCase).toBe("uppercase");
      expect(config.respectGitignore).toBe(false);
      expect(config.format.normalizeCase).toBe(false);
    });
  });

  test("prefers TOML over YAML when both exist", async () => {
    await withTempDir("waymark-config-toml-priority-", async (dir) => {
      const configDir = join(dir, ".waymark");
      await mkdir(configDir, { recursive: true });
      await writeFile(
        join(configDir, "config.toml"),
        'type_case = "uppercase"\n',
        "utf8"
      );
      await writeFile(
        join(configDir, "config.yaml"),
        "type_case: lowercase\n",
        "utf8"
      );

      const result = await loadConfigFromDisk({
        cwd: dir,
        scope: "project",
      });
      expect(result.isOk()).toBe(true);
      expect(result.unwrap().typeCase).toBe("uppercase");
    });
  });

  // -------------------------------------------------------------------------
  // Error paths (new)
  // -------------------------------------------------------------------------
  test("returns NotFoundError when explicit path does not exist", async () => {
    await withTempDir("waymark-config-notfound-", async (dir) => {
      const result = await loadConfigFromDisk({
        cwd: dir,
        explicitPath: join(dir, "nonexistent.yaml"),
      });
      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error._tag).toBe("NotFoundError");
      }
    });
  });

  test("returns ValidationError for malformed YAML", async () => {
    await withTempDir("waymark-config-malformed-", async (dir) => {
      const filePath = join(dir, "bad.yaml");
      await writeFile(filePath, "{{{{invalid yaml\n", "utf8");

      const result = await loadConfigFromDisk({
        cwd: dir,
        explicitPath: filePath,
      });
      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error._tag).toBe("ValidationError");
      }
    });
  });

  test("returns ValidationError for unsupported config format", async () => {
    await withTempDir("waymark-config-unsupported-", async (dir) => {
      const filePath = join(dir, "config.xml");
      await writeFile(filePath, "<config/>", "utf8");

      const result = await loadConfigFromDisk({
        cwd: dir,
        explicitPath: filePath,
      });
      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error._tag).toBe("ValidationError");
      }
    });
  });

  // -------------------------------------------------------------------------
  // WAYMARK_CONFIG_PATH env var
  // -------------------------------------------------------------------------
  test("loads config from WAYMARK_CONFIG_PATH env var", async () => {
    await withTempDir("waymark-config-env-", async (dir) => {
      const configPath = join(dir, "custom-config.yaml");
      await writeFile(configPath, "type_case: uppercase\n", "utf8");

      const result = await loadConfigFromDisk({
        cwd: dir,
        // biome-ignore lint/style/useNamingConvention: environment variables are uppercase by convention
        env: { WAYMARK_CONFIG_PATH: configPath },
      });
      expect(result.isOk()).toBe(true);
      expect(result.unwrap().typeCase).toBe("uppercase");
    });
  });
});
