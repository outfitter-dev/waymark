// tldr ::: implement the wm skill command outputs [[cli/skill-command]]

import { resolve } from "node:path";
import { createUsageError } from "../errors.ts";
import { ExitCode } from "../exit-codes.ts";
import {
  listSkillSections,
  loadSkillData,
  loadSkillManifest,
  loadSkillSection,
  resolveSkillDir,
  type SkillSectionKind,
} from "../skills/parser.ts";

export type SkillCommandOptions = {
  json?: boolean;
};

export type SkillCommandResult = {
  output: string;
  exitCode: number;
};

export type SkillCommandOverrides = {
  skillDir?: string;
};

function resolveSkillDirectory(overrides: SkillCommandOverrides = {}): string {
  if (overrides.skillDir) {
    return resolve(overrides.skillDir);
  }
  return resolveSkillDir();
}

function formatJsonOutput(payload: unknown): string {
  return JSON.stringify(payload, null, 2);
}

export async function runSkillCommand(
  options: SkillCommandOptions = {},
  overrides: SkillCommandOverrides = {}
): Promise<SkillCommandResult> {
  const skillDir = resolveSkillDirectory(overrides);

  if (options.json) {
    const skillData = await loadSkillData(skillDir);
    return {
      output: formatJsonOutput(skillData),
      exitCode: ExitCode.success,
    };
  }

  const manifest = await loadSkillManifest(skillDir);
  const entryPath = manifest.entry || "SKILL.md";
  const core = await loadSkillSection(skillDir, "core", "core", entryPath);

  return {
    output: core.content,
    exitCode: ExitCode.success,
  };
}

function resolveSkillSectionEntry(
  section: string,
  sectionMap: Record<string, string>,
  kind: SkillSectionKind
): { name: string; kind: SkillSectionKind; path: string } | null {
  const path = sectionMap[section];
  if (!path) {
    return null;
  }
  return { name: section, kind, path };
}

function resolveSkillSection(
  manifest: Awaited<ReturnType<typeof loadSkillManifest>>,
  section: string
): { name: string; kind: SkillSectionKind; path: string } | null {
  const commandMatch = resolveSkillSectionEntry(
    section,
    manifest.commands ?? {},
    "command"
  );
  if (commandMatch) {
    return commandMatch;
  }

  const referenceMatch = resolveSkillSectionEntry(
    section,
    manifest.references ?? {},
    "reference"
  );
  if (referenceMatch) {
    const kind = referenceMatch.path.startsWith("examples/")
      ? "example"
      : "reference";
    return {
      ...referenceMatch,
      kind,
    };
  }

  if (section === "skill" || section === "core") {
    return {
      name: "core",
      kind: "core",
      path: manifest.entry || "SKILL.md",
    };
  }

  return null;
}

export async function runSkillShowCommand(
  section: string,
  options: SkillCommandOptions = {},
  overrides: SkillCommandOverrides = {}
): Promise<SkillCommandResult> {
  const skillDir = resolveSkillDirectory(overrides);
  const manifest = await loadSkillManifest(skillDir);
  const resolved = resolveSkillSection(manifest, section);

  if (!resolved) {
    throw createUsageError(`Unknown skill section: ${section}`);
  }

  const content = await loadSkillSection(
    skillDir,
    resolved.name,
    resolved.kind,
    resolved.path
  );

  if (options.json) {
    return {
      output: formatJsonOutput(content),
      exitCode: ExitCode.success,
    };
  }

  return {
    output: content.content,
    exitCode: ExitCode.success,
  };
}

export async function runSkillListCommand(
  overrides: SkillCommandOverrides = {}
): Promise<SkillCommandResult> {
  const skillDir = resolveSkillDirectory(overrides);
  const manifest = await loadSkillManifest(skillDir);
  const sections = listSkillSections(manifest);
  const lines: string[] = [];

  lines.push("Commands:");
  if (sections.commands.length === 0) {
    lines.push("  (none)");
  } else {
    for (const name of sections.commands) {
      lines.push(`  ${name}`);
    }
  }

  lines.push("");
  lines.push("References:");
  if (sections.references.length === 0) {
    lines.push("  (none)");
  } else {
    for (const name of sections.references) {
      lines.push(`  ${name}`);
    }
  }

  lines.push("");
  lines.push("Examples:");
  if (sections.examples.length === 0) {
    lines.push("  (none)");
  } else {
    for (const name of sections.examples) {
      lines.push(`  ${name}`);
    }
  }

  return {
    output: lines.join("\n"),
    exitCode: ExitCode.success,
  };
}

export function runSkillPathCommand(
  overrides: SkillCommandOverrides = {}
): SkillCommandResult {
  const skillDir = resolveSkillDirectory(overrides);
  return {
    output: skillDir,
    exitCode: ExitCode.success,
  };
}
