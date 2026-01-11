#!/usr/bin/env bun
// tldr ::: validate skill manifest sync and CLI command coverage #scripts/skill-coverage

import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { SKILL_MANIFEST_FILE } from "../packages/cli/src/skills/types.ts";
import {
  buildSkillManifest,
  discoverSkillDirectories,
  formatSkillManifest,
} from "../packages/cli/src/skills/manifest.ts";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const skillsRoot = resolve(repoRoot, "packages/agents/skills");
const registerPath = resolve(repoRoot, "packages/cli/src/commands/register.ts");

type CommandExtraction = {
  commands: string[];
  errors: string[];
};

const COMMAND_DECLARATION = /const\s+(\w+)\s*=\s*new Command\("([^"]+)"\)/g;
const ADD_COMMAND = /program\.addCommand\((\w+)/g;

function normalizeLineEndings(value: string): string {
  return value.replace(/\r\n/g, "\n");
}

function extractCliCommands(source: string): CommandExtraction {
  const declarations = new Map<string, string>();
  const errors: string[] = [];

  for (const match of source.matchAll(COMMAND_DECLARATION)) {
    const [, variable, name] = match;
    if (variable && name) {
      declarations.set(variable, name);
    }
  }

  const commands: string[] = [];
  for (const match of source.matchAll(ADD_COMMAND)) {
    const variable = match[1];
    if (!variable) {
      continue;
    }
    const command = declarations.get(variable);
    if (!command) {
      errors.push(`Unable to resolve command variable "${variable}".`);
      continue;
    }
    commands.push(command);
  }

  return {
    commands: Array.from(new Set(commands)).sort(),
    errors,
  };
}

async function readText(path: string): Promise<string | null> {
  try {
    return await Bun.file(path).text();
  } catch {
    return null;
  }
}

const errors: string[] = [];

const skillDirs = await discoverSkillDirectories(skillsRoot);
if (skillDirs.length === 0) {
  errors.push(`No skill directories found under ${skillsRoot}.`);
}

const manifests = new Map<
  string,
  Awaited<ReturnType<typeof buildSkillManifest>>
>();

for (const skillDir of skillDirs) {
  const manifest = await buildSkillManifest(skillDir);
  manifests.set(skillDir, manifest);
  const manifestPath = join(skillDir, SKILL_MANIFEST_FILE);
  const expected = formatSkillManifest(manifest);
  const existing = await readText(manifestPath);

  if (!existing) {
    errors.push(`Missing manifest at ${manifestPath}.`);
    continue;
  }

  if (normalizeLineEndings(existing) !== normalizeLineEndings(expected)) {
    errors.push(`Manifest out of date at ${manifestPath}.`);
  }
}

const waymarkSkillDir = skillDirs.find(
  (dir) => basename(dir) === "waymark-cli"
);

if (waymarkSkillDir) {
  const manifest = manifests.get(waymarkSkillDir);
  if (manifest) {
    const commandSections = manifest.sections.commands;
    const documentedCommands = new Set<string>();
    const duplicateDocs = new Set<string>();

    for (const section of commandSections) {
      const wmCmd = section.metadata?.["wm-cmd"];
      if (typeof wmCmd !== "string" || wmCmd.trim().length === 0) {
        errors.push(
          `Missing metadata.wm-cmd for command section "${section.name}".`
        );
        continue;
      }
      if (documentedCommands.has(wmCmd)) {
        duplicateDocs.add(wmCmd);
      }
      documentedCommands.add(wmCmd);
    }

    if (duplicateDocs.size > 0) {
      errors.push(
        `Duplicate wm-cmd entries: ${Array.from(duplicateDocs).join(", ")}.`
      );
    }

    const registerSource = await readText(registerPath);
    if (registerSource) {
      const extracted = extractCliCommands(registerSource);
      errors.push(...extracted.errors);

      const missingDocs = extracted.commands.filter(
        (command) => !documentedCommands.has(command)
      );
      const unknownDocs = Array.from(documentedCommands).filter(
        (command) => !extracted.commands.includes(command)
      );

      if (missingDocs.length > 0) {
        errors.push(
          `Missing skill docs for commands: ${missingDocs.join(", ")}.`
        );
      }

      if (unknownDocs.length > 0) {
        errors.push(
          `Skill docs reference unknown commands: ${unknownDocs.join(", ")}.`
        );
      }
    } else {
      errors.push(`Unable to read ${registerPath}.`);
    }
  } else {
    errors.push("Unable to build manifest for waymark-cli.");
  }
} else {
  errors.push("Unable to locate waymark-cli skill directory.");
}

if (errors.length > 0) {
  console.error("Skill coverage check failed:");
  for (const error of errors) {
    console.error(`- ${error}`);
  }
  console.error("Run: bun packages/cli/scripts/build-skill-manifest.ts");
  process.exit(1);
}

console.log("Skill coverage check passed.");
