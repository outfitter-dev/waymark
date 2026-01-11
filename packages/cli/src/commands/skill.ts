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
} from "../skills/parser.ts";
import type {
  SkillSectionKind,
  SkillSectionManifest,
} from "../skills/types.ts";

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

/**
 * Execute the `wm skill` command (core skill content or JSON).
 * @param options - Output formatting options.
 * @param overrides - Overrides for skill directory resolution.
 * @returns Output payload and exit code.
 */
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

  const core = await loadSkillSection(skillDir, "core", "core", "SKILL.md");

  return {
    output: core.content,
    exitCode: ExitCode.success,
  };
}

function findSection(
  sections: SkillSectionManifest[],
  section: string
): SkillSectionManifest | null {
  return (
    sections.find(
      (candidate) =>
        candidate.name === section ||
        Boolean(candidate.aliases?.includes(section))
    ) ?? null
  );
}

function resolveSkillSection(
  manifest: Awaited<ReturnType<typeof loadSkillManifest>>,
  section: string
): { name: string; kind: SkillSectionKind; path: string } | null {
  const command = findSection(manifest.sections.commands, section);
  if (command) {
    return {
      name: command.name,
      kind: "command",
      path: command.path,
    };
  }

  const reference = findSection(manifest.sections.references, section);
  if (reference) {
    return {
      name: reference.name,
      kind: "reference",
      path: reference.path,
    };
  }

  const example = findSection(manifest.sections.examples, section);
  if (example) {
    return {
      name: example.name,
      kind: "example",
      path: example.path,
    };
  }

  if (section === "skill" || section === "core") {
    const core = manifest.sections.core;
    return {
      name: core.name,
      kind: "core",
      path: core.path,
    };
  }

  return null;
}

/**
 * Execute the `wm skill show` command for a specific section.
 * @param section - Section name to display.
 * @param options - Output formatting options.
 * @param overrides - Overrides for skill directory resolution.
 * @returns Output payload and exit code.
 */
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

/**
 * Execute the `wm skill list` command to enumerate sections.
 * @param overrides - Overrides for skill directory resolution.
 * @returns Output payload and exit code.
 */
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

/**
 * Execute the `wm skill path` command to print the skills directory.
 * @param overrides - Overrides for skill directory resolution.
 * @returns Output payload and exit code.
 */
export function runSkillPathCommand(
  overrides: SkillCommandOverrides = {}
): SkillCommandResult {
  const skillDir = resolveSkillDirectory(overrides);
  return {
    output: skillDir,
    exitCode: ExitCode.success,
  };
}
