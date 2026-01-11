#!/usr/bin/env bun
// tldr ::: generate manifest.json files for skill directories #scripts/skill-manifest

import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { SKILL_MANIFEST_FILE } from "../packages/cli/src/skills/types.ts";
import {
  buildSkillManifest,
  discoverSkillDirectories,
  formatSkillManifest,
} from "./skill-manifest.ts";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const defaultRoot = resolve(repoRoot, "packages/agents/skills");
const rootOverride = process.argv[2];
const skillsRoot = rootOverride ? resolve(rootOverride) : defaultRoot;

const skillDirs = await discoverSkillDirectories(skillsRoot);

if (skillDirs.length === 0) {
  console.error(`No skill directories found under ${skillsRoot}.`);
  process.exit(1);
}

for (const skillDir of skillDirs) {
  const manifest = await buildSkillManifest(skillDir);
  const outputPath = join(skillDir, SKILL_MANIFEST_FILE);
  await Bun.write(outputPath, formatSkillManifest(manifest));
}

console.log(`Generated ${skillDirs.length} skill manifest(s).`);
