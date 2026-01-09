// tldr ::: copy agent skill docs into the CLI package for distribution [[cli/skill-sync]]

import { cp, mkdir, rm } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const sourceDir = resolve(repoRoot, "packages/agents/skills/waymark");
const targetRoot = resolve(repoRoot, "packages/cli/skills");
const targetDir = join(targetRoot, "waymark");

await mkdir(targetRoot, { recursive: true });
await rm(targetDir, { recursive: true, force: true });
await cp(sourceDir, targetDir, { recursive: true });
