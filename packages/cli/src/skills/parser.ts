// tldr ::: load and normalize skill docs for the wm skill command [[cli/skill-parser]]

import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export type SkillManifest = {
  name: string;
  version: string;
  description?: string;
  entry: string;
  commands?: Record<string, string>;
  references?: Record<string, string>;
  triggers?: string[];
};

export type SkillSectionKind = "core" | "command" | "reference" | "example";

export type SkillSection = {
  name: string;
  kind: SkillSectionKind;
  path: string;
  content: string;
  frontmatter?: string;
};

export type SkillSections = {
  core: SkillSection;
  commands: Record<string, SkillSection>;
  references: Record<string, SkillSection>;
  examples: Record<string, SkillSection>;
};

export type SkillData = SkillManifest & {
  sections: SkillSections;
};

const SKILL_DIR_ENV = "WAYMARK_SKILL_DIR";
const SKILL_DIR_CACHE: { value?: string } = {};
const SKILL_MANIFEST_FILE = "index.json";
const SKILL_SEARCH_DEPTH = 6;
const SKILL_DIR_CANDIDATES = [
  join("skills", "waymark"),
  join("agents", "skills", "waymark"),
  join("packages", "agents", "skills", "waymark"),
];

function normalizeLineEndings(value: string): string {
  return value.replace(/\r\n/g, "\n");
}

function consumeCommentBlock(
  lines: string[],
  startIndex: number
): { collected: string[]; nextIndex: number } {
  const collected: string[] = [];
  let index = startIndex;

  while (index < lines.length) {
    const line = lines[index] ?? "";
    collected.push(line);
    index += 1;
    if (line.includes("-->")) {
      break;
    }
  }

  return { collected, nextIndex: index };
}

function consumePreamble(lines: string[]): {
  preamble: string[];
  index: number;
} {
  const preamble: string[] = [];
  let index = 0;

  while (index < lines.length) {
    const line = lines[index] ?? "";
    const trimmed = line.trim();
    if (trimmed.length === 0) {
      preamble.push(line);
      index += 1;
      continue;
    }
    if (trimmed.startsWith("<!--")) {
      const { collected, nextIndex } = consumeCommentBlock(lines, index);
      preamble.push(...collected);
      index = nextIndex;
      continue;
    }
    break;
  }

  return { preamble, index };
}

function readFrontmatter(
  lines: string[],
  startIndex: number
): { frontmatter: string[]; nextIndex: number; closed: boolean } {
  if ((lines[startIndex] ?? "").trim() !== "---") {
    return { frontmatter: [], nextIndex: startIndex, closed: false };
  }

  const frontmatter: string[] = [];
  let index = startIndex + 1;

  while (index < lines.length && (lines[index] ?? "").trim() !== "---") {
    frontmatter.push(lines[index] ?? "");
    index += 1;
  }

  if (index >= lines.length) {
    return { frontmatter: [], nextIndex: startIndex, closed: false };
  }

  return { frontmatter, nextIndex: index + 1, closed: true };
}

function extractFrontmatter(raw: string): {
  frontmatter?: string;
  body: string;
} {
  const normalized = normalizeLineEndings(raw);
  const lines = normalized.split("\n");
  const { preamble, index } = consumePreamble(lines);
  const { frontmatter, nextIndex, closed } = readFrontmatter(lines, index);

  if (!closed) {
    return { body: normalized };
  }

  const bodyLines = [...preamble, ...lines.slice(nextIndex)];
  return {
    frontmatter: frontmatter.join("\n").trimEnd(),
    body: bodyLines.join("\n").trimStart(),
  };
}

/**
 * Resolve the skills directory by scanning expected locations or env override.
 * @returns Absolute path to the skills directory.
 */
export function resolveSkillDir(): string {
  if (SKILL_DIR_CACHE.value) {
    return SKILL_DIR_CACHE.value;
  }

  const envOverride = process.env[SKILL_DIR_ENV];
  if (envOverride) {
    const candidate = resolve(envOverride);
    if (existsSync(join(candidate, SKILL_MANIFEST_FILE))) {
      SKILL_DIR_CACHE.value = candidate;
      return candidate;
    }
  }

  let currentDir = dirname(fileURLToPath(import.meta.url));
  for (let depth = 0; depth < SKILL_SEARCH_DEPTH; depth += 1) {
    for (const suffix of SKILL_DIR_CANDIDATES) {
      const candidate = resolve(currentDir, suffix);
      if (existsSync(join(candidate, SKILL_MANIFEST_FILE))) {
        SKILL_DIR_CACHE.value = candidate;
        return candidate;
      }
    }
    const parent = dirname(currentDir);
    if (parent === currentDir) {
      break;
    }
    currentDir = parent;
  }

  throw new Error(
    "Skill directory not found. Set WAYMARK_SKILL_DIR to override."
  );
}

/**
 * Load and parse the skill manifest from a skills directory.
 * @param skillDir - Absolute path to the skills directory.
 * @returns Parsed skill manifest data.
 */
export async function loadSkillManifest(
  skillDir: string
): Promise<SkillManifest> {
  const manifestPath = join(skillDir, SKILL_MANIFEST_FILE);
  const raw = await readFile(manifestPath, "utf8");
  return JSON.parse(raw) as SkillManifest;
}

/**
 * Load and parse a single skill section file.
 * @param skillDir - Absolute path to the skills directory.
 * @param sectionName - Name of the section in the manifest.
 * @param kind - Section category to assign.
 * @param relativePath - Relative path to the section content.
 * @returns Parsed section metadata and content.
 */
export async function loadSkillSection(
  skillDir: string,
  sectionName: string,
  kind: SkillSectionKind,
  relativePath: string
): Promise<SkillSection> {
  const fullPath = join(skillDir, relativePath);
  const raw = await readFile(fullPath, "utf8");
  const { body, frontmatter } = extractFrontmatter(raw);
  return {
    name: sectionName,
    kind,
    path: fullPath,
    content: body.trimEnd(),
    ...(frontmatter ? { frontmatter } : {}),
  };
}

/**
 * Load the full skill manifest and referenced sections.
 * @param skillDir - Absolute path to the skills directory.
 * @returns Aggregated skill data with sections attached.
 */
export async function loadSkillData(skillDir: string): Promise<SkillData> {
  const manifest = await loadSkillManifest(skillDir);
  const entryPath = manifest.entry || "SKILL.md";
  const core = await loadSkillSection(skillDir, "core", "core", entryPath);

  const commandsEntries = Object.entries(manifest.commands ?? {});
  const referencesEntries = Object.entries(manifest.references ?? {});
  const commands: Record<string, SkillSection> = {};
  const references: Record<string, SkillSection> = {};
  const examples: Record<string, SkillSection> = {};

  for (const [name, relativePath] of commandsEntries) {
    commands[name] = await loadSkillSection(
      skillDir,
      name,
      "command",
      relativePath
    );
  }

  for (const [name, relativePath] of referencesEntries) {
    const kind = relativePath.startsWith("examples/") ? "example" : "reference";
    const target = kind === "example" ? examples : references;
    target[name] = await loadSkillSection(skillDir, name, kind, relativePath);
  }

  return {
    ...manifest,
    sections: {
      core,
      commands,
      references,
      examples,
    },
  };
}

/**
 * List the named sections grouped by type.
 * @param manifest - Skill manifest to inspect.
 * @returns Grouped section names for commands, references, and examples.
 */
export function listSkillSections(manifest: SkillManifest): {
  commands: string[];
  references: string[];
  examples: string[];
} {
  const commandNames = Object.keys(manifest.commands ?? {});
  const referenceEntries = Object.entries(manifest.references ?? {});
  const references: string[] = [];
  const examples: string[] = [];

  for (const [name, relativePath] of referenceEntries) {
    if (relativePath.startsWith("examples/")) {
      examples.push(name);
    } else {
      references.push(name);
    }
  }

  return {
    commands: commandNames.sort(),
    references: references.sort(),
    examples: examples.sort(),
  };
}
