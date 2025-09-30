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

test("loadConfigFromDisk parses explicit JSONC config", async () => {
  await withTempDir("waymark-config-jsonc-", async (dir) => {
    const filePath = join(dir, "custom.jsonc");
    await writeFile(
      filePath,
      `// comment line\n{"type_case": "uppercase"}\n`,
      "utf8"
    );

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

test("default scope discovers nearest .waymarkrc file", async () => {
  await withTempDir("waymark-config-rc-", async (dir) => {
    const repoRoot = join(dir, "repo");
    const nestedDir = join(repoRoot, "src");
    await mkdir(nestedDir, { recursive: true });
    await writeFile(
      join(repoRoot, ".waymarkrc.toml"),
      'type_case = "uppercase"\n',
      "utf8"
    );

    const config = await loadConfigFromDisk({ cwd: nestedDir });
    expect(config.typeCase).toBe("uppercase");
  });
});

test("global scope reads from XDG_CONFIG_HOME", async () => {
  await withTempDir("waymark-config-global-", async (dir) => {
    const configDir = join(dir, "waymark");
    await mkdir(configDir, { recursive: true });
    await writeFile(
      join(configDir, "config.json"),
      '{"skip_paths": ["**/build/**"]}\n',
      "utf8"
    );

    const config = await loadConfigFromDisk({
      scope: "global",
      // biome-ignore lint/style/useNamingConvention: environment variables are uppercase by convention
      env: { XDG_CONFIG_HOME: dir },
    });

    expect(config.skipPaths).toContain("**/build/**");
  });
});
