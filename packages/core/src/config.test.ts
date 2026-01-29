// tldr ::: tests for config loading and scope resolution

import { expect, test } from "bun:test";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { DEFAULT_CONFIG, loadConfigFromDisk } from "./config";

async function withTempDir(prefix: string, fn: (dir: string) => Promise<void>) {
  const dir = await mkdtemp(join(tmpdir(), prefix));
  try {
    await fn(dir);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

test("loadConfigFromDisk returns defaults when no config exists", async () => {
  await withTempDir("waymark-config-default-", async (dir) => {
    const config = await loadConfigFromDisk({
      cwd: dir,
      scope: "project",
    });
    expect(config).toEqual(DEFAULT_CONFIG);
  });
});

test("loadConfigFromDisk parses explicit YAML config", async () => {
  await withTempDir("waymark-config-yaml-", async (dir) => {
    const filePath = join(dir, "custom.yaml");
    await writeFile(filePath, "type_case: uppercase\n", "utf8");

    const config = await loadConfigFromDisk({
      cwd: dir,
      explicitPath: filePath,
    });
    expect(config.typeCase).toBe("uppercase");
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

    const config = await loadConfigFromDisk({
      cwd: nestedDir,
      scope: "project",
    });

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

    const config = await loadConfigFromDisk({ cwd: nestedDir });
    expect(config.typeCase).toBe("uppercase");
  });
});

test("loadConfigFromDisk parses scan include_codetags option", async () => {
  await withTempDir("waymark-config-scan-", async (dir) => {
    const configDir = join(dir, ".waymark");
    await mkdir(configDir, { recursive: true });
    await writeFile(
      join(configDir, "config.yaml"),
      "scan:\n  include_codetags: true\n",
      "utf8"
    );

    const config = await loadConfigFromDisk({
      cwd: dir,
      scope: "project",
    });

    expect(config.scan.includeCodetags).toBe(true);
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

    const config = await loadConfigFromDisk({
      scope: "user",
      // biome-ignore lint/style/useNamingConvention: environment variables are uppercase by convention
      env: { XDG_CONFIG_HOME: dir },
    });

    expect(config.skipPaths).toContain("**/build/**");
  });
});

test("loadConfigFromDisk parses languages.extensions option", async () => {
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

    const config = await loadConfigFromDisk({
      cwd: dir,
      scope: "project",
    });

    expect(config.languages).toBeDefined();
    expect(config.languages?.extensions?.[".custom"]).toEqual(["//", "#"]);
    // Extensions without leading dot should get normalized
    expect(config.languages?.extensions?.[".vue"]).toEqual(["<!--"]);
  });
});

test("loadConfigFromDisk parses languages.basenames option", async () => {
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

    const config = await loadConfigFromDisk({
      cwd: dir,
      scope: "project",
    });

    expect(config.languages).toBeDefined();
    expect(config.languages?.basenames?.Makefile).toEqual(["#"]);
    expect(config.languages?.basenames?.Dockerfile).toEqual(["#"]);
  });
});

test("loadConfigFromDisk parses languages.skipUnknown boolean (camelCase)", async () => {
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

    const config = await loadConfigFromDisk({
      cwd: dir,
      scope: "project",
    });

    expect(config.languages?.skipUnknown).toBe(true);
  });
});

test("loadConfigFromDisk parses languages.skip_unknown boolean (snake_case)", async () => {
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

    const config = await loadConfigFromDisk({
      cwd: dir,
      scope: "project",
    });

    expect(config.languages?.skipUnknown).toBe(true);
  });
});

test("loadConfigFromDisk ignores invalid languages.extensions (non-array leaders)", async () => {
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

    const config = await loadConfigFromDisk({
      cwd: dir,
      scope: "project",
    });

    expect(config.languages?.extensions?.[".valid"]).toEqual(["//"]);
    // Invalid entries should be silently ignored
    expect(config.languages?.extensions?.[".invalid"]).toBeUndefined();
    expect(config.languages?.extensions?.[".alsoInvalid"]).toBeUndefined();
  });
});
