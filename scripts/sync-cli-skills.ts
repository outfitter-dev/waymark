// tldr ::: copy agent skill docs into the CLI package for distribution [[cli/skill-sync]]

import { cp, mkdir, rm } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const agentsSkillsDir = resolve(repoRoot, "packages/agents/skills");
const targetRoot = resolve(repoRoot, "packages/cli/skills");

// Skills to sync to CLI package
const skillsToSync = ["waymark-cli", "using-waymarks"];

await mkdir(targetRoot, { recursive: true });

for (const skill of skillsToSync) {
  const sourceDir = join(agentsSkillsDir, skill);
  const targetDir = join(targetRoot, skill);
  await rm(targetDir, { recursive: true, force: true });
  await cp(sourceDir, targetDir, { recursive: true });
}
