// tldr ::: format staged files with ultracite and markdownlint to avoid repo-wide churn

const IGNORE_PREFIXES = [".bun/", "node_modules/"];

const CODE_EXTENSIONS = new Set([
  ".js",
  ".jsx",
  ".cjs",
  ".mjs",
  ".ts",
  ".tsx",
  ".cts",
  ".mts",
  ".json",
  ".jsonc",
  ".yaml",
  ".yml",
]);

function getStagedFiles(): string[] {
  const result = Bun.spawnSync({
    cmd: ["git", "diff", "--cached", "--name-only", "--diff-filter=ACMR"],
  });

  if (result.exitCode !== 0) {
    const stderr = result.stderr.toString().trim();
    if (stderr.length > 0) {
      console.error(stderr);
    }
    process.exit(result.exitCode ?? 1);
  }

  const stdout = result.stdout.toString().trim();
  if (!stdout) {
    return [];
  }

  return stdout
    .split("\n")
    .map((file) => file.trim())
    .filter(Boolean)
    .filter(
      (file) => !IGNORE_PREFIXES.some((prefix) => file.startsWith(prefix))
    );
}

function run(cmd: string[]): void {
  const result = Bun.spawnSync({
    cmd,
    stdout: "inherit",
    stderr: "inherit",
  });

  if (result.exitCode !== 0) {
    process.exit(result.exitCode ?? 1);
  }
}

const stagedFiles = getStagedFiles();
if (stagedFiles.length === 0) {
  process.exit(0);
}

const codeFiles = stagedFiles.filter((file) => {
  const dot = file.lastIndexOf(".");
  if (dot === -1) {
    return false;
  }
  const ext = file.slice(dot).toLowerCase();
  return CODE_EXTENSIONS.has(ext);
});

const markdownFiles = stagedFiles.filter((file) => file.endsWith(".md"));

if (codeFiles.length > 0) {
  run(["bunx", "ultracite", "fix", "--unsafe=true", ...codeFiles]);
}

if (markdownFiles.length > 0) {
  run(["bunx", "markdownlint-cli2", "--fix", ...markdownFiles]);
}
