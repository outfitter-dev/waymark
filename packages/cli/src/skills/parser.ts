// tldr ::: load and normalize skill docs for the wm skill command [[cli/skill-parser]]

import { existsSync, readdirSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export type SkillManifest = {
  name: string;
  version?: string;
  description?: string;
  commands: string[];
  references: string[];
  examples: string[];
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
const SKILL_ENTRY_FILE = "SKILL.md";
const SKILL_SEARCH_DEPTH = 6;
const SKILL_DIR_CANDIDATES = [
  join("skills", "waymark-cli"),
  join("agents", "skills", "waymark-cli"),
  join("packages", "agents", "skills", "waymark-cli"),
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
    if (existsSync(join(candidate, SKILL_ENTRY_FILE))) {
      SKILL_DIR_CACHE.value = candidate;
      return candidate;
    }
  }

  let currentDir = dirname(fileURLToPath(import.meta.url));
  for (let depth = 0; depth < SKILL_SEARCH_DEPTH; depth += 1) {
    for (const suffix of SKILL_DIR_CANDIDATES) {
      const candidate = resolve(currentDir, suffix);
      if (existsSync(join(candidate, SKILL_ENTRY_FILE))) {
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
 * Parse simple YAML key-value pairs from frontmatter content.
 * @param frontmatter - Raw frontmatter string without delimiters.
 * @returns Record of parsed key-value pairs.
 */
function parseFrontmatterYaml(frontmatter: string): Record<string, string> {
  const result: Record<string, string> = {};
  for (const line of frontmatter.split("\n")) {
    const colonIndex = line.indexOf(":");
    if (colonIndex === -1) {
      continue;
    }
    const key = line.slice(0, colonIndex).trim();
    const value = line.slice(colonIndex + 1).trim();
    if (key && value) {
      result[key] = value;
    }
  }
  return result;
}

/**
 * Discover markdown files in a directory by convention.
 * @param dir - Directory path to scan.
 * @returns Sorted list of markdown file basenames without extension.
 */
function discoverMarkdownFiles(dir: string): string[] {
  if (!existsSync(dir)) {
    return [];
  }
  return readdirSync(dir, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith(".md"))
    .map((entry) => basename(entry.name, ".md"))
    .sort();
}

/**
 * Load and parse the skill manifest from a skills directory.
 * @param skillDir - Absolute path to the skills directory.
 * @returns Parsed skill manifest data.
 */
export async function loadSkillManifest(
  skillDir: string
): Promise<SkillManifest> {
  const entryPath = join(skillDir, SKILL_ENTRY_FILE);
  const raw = await readFile(entryPath, "utf8");
  const { frontmatter } = extractFrontmatter(raw);

  const meta = frontmatter ? parseFrontmatterYaml(frontmatter) : {};

  return {
    name: meta.name ?? basename(skillDir),
    ...(meta.version ? { version: meta.version } : {}),
    ...(meta.description ? { description: meta.description } : {}),
    commands: discoverMarkdownFiles(join(skillDir, "commands")),
    references: discoverMarkdownFiles(join(skillDir, "references")),
    examples: discoverMarkdownFiles(join(skillDir, "examples")),
  };
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
  const core = await loadSkillSection(
    skillDir,
    "core",
    "core",
    SKILL_ENTRY_FILE
  );

  const commands: Record<string, SkillSection> = {};
  const references: Record<string, SkillSection> = {};
  const examples: Record<string, SkillSection> = {};

  for (const name of manifest.commands) {
    commands[name] = await loadSkillSection(
      skillDir,
      name,
      "command",
      join("commands", `${name}.md`)
    );
  }

  for (const name of manifest.references) {
    references[name] = await loadSkillSection(
      skillDir,
      name,
      "reference",
      join("references", `${name}.md`)
    );
  }

  for (const name of manifest.examples) {
    examples[name] = await loadSkillSection(
      skillDir,
      name,
      "example",
      join("examples", `${name}.md`)
    );
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
  return {
    commands: manifest.commands,
    references: manifest.references,
    examples: manifest.examples,
  };
}
