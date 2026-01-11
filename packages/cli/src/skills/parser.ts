// tldr ::: load and normalize skill docs for the wm skill command [[cli/skill-parser]]

import { existsSync, readdirSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parse as parseYaml } from "yaml";
import { extractFrontmatter } from "./frontmatter.ts";
import {
  SKILL_ENTRY_FILE,
  SKILL_MANIFEST_FILE,
  type SkillManifest,
  type SkillManifestSections,
  type SkillSectionKind,
  type SkillSectionManifest,
} from "./types.ts";

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

export type SkillData = Omit<SkillManifest, "sections"> & {
  sections: SkillSections;
};

const SKILL_DIR_ENV = "WAYMARK_SKILL_DIR";
const SKILL_LIVE_SCAN_ENV = "WAYMARK_SKILL_LIVE_SCAN";
const SKILL_DIR_CACHE: { value?: string } = {};
const SKILL_SEARCH_DEPTH = 6;
const SKILL_DIR_CANDIDATES = [
  join("skills", "waymark-cli"),
  join("agents", "skills", "waymark-cli"),
  join("packages", "agents", "skills", "waymark-cli"),
];

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
 * Safely cast a value to a record type.
 * @param value - Unknown value to cast.
 * @returns Record if value is an object, empty record otherwise.
 */
function asRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }
  return value as Record<string, unknown>;
}

/**
 * Parse YAML frontmatter content using the yaml library.
 * @param frontmatter - Raw frontmatter string without delimiters.
 * @param sourcePath - Source file path for error reporting.
 * @returns Record of parsed key-value pairs.
 */
function parseFrontmatterYaml(
  frontmatter: string,
  sourcePath: string
): Record<string, unknown> {
  if (frontmatter.trim().length === 0) {
    return {};
  }

  try {
    return asRecord(parseYaml(frontmatter));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to parse frontmatter in ${sourcePath}: ${message}`);
  }
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

type RawSkillManifest = Omit<
  SkillManifest,
  "commands" | "references" | "examples"
> &
  Partial<Pick<SkillManifest, "commands" | "references" | "examples">>;

/**
 * Build a section manifest entry.
 * @param name - Section name identifier.
 * @param kind - Section category type.
 * @param path - Relative path to the section file.
 * @returns Structured section manifest.
 */
function buildSectionManifest(
  name: string,
  kind: SkillSectionKind,
  path: string
): SkillSectionManifest {
  return { name, kind, path };
}

/**
 * Extract section name lists from manifest sections.
 * @param sections - Manifest sections object.
 * @returns Object with command, reference, and example name arrays.
 */
function buildSectionLists(sections: SkillManifestSections): {
  commands: string[];
  references: string[];
  examples: string[];
} {
  return {
    commands: sections.commands.map((section) => section.name),
    references: sections.references.map((section) => section.name),
    examples: sections.examples.map((section) => section.name),
  };
}

/**
 * Normalize a raw manifest into the full SkillManifest shape.
 * @param manifest - Raw manifest with optional fields.
 * @returns Fully populated skill manifest.
 */
function normalizeManifest(manifest: RawSkillManifest): SkillManifest {
  const { sections } = manifest;
  const lists = buildSectionLists(sections);

  return {
    name: manifest.name,
    ...(manifest.version ? { version: manifest.version } : {}),
    ...(manifest.description ? { description: manifest.description } : {}),
    ...lists,
    sections,
  };
}

/**
 * Parse a manifest JSON string into a SkillManifest.
 * @param raw - Raw JSON string content.
 * @param sourcePath - Path for error reporting.
 * @returns Parsed and normalized skill manifest.
 */
function parseManifest(raw: string, sourcePath: string): SkillManifest {
  let parsed: RawSkillManifest;
  try {
    parsed = JSON.parse(raw) as RawSkillManifest;
  } catch (error) {
    throw new Error(
      `Failed to parse skill manifest at ${sourcePath}: ${(error as Error).message}`
    );
  }

  if (!parsed || typeof parsed !== "object") {
    throw new Error(`Invalid skill manifest at ${sourcePath}.`);
  }

  const record = parsed as Record<string, unknown>;
  if (typeof record.name !== "string") {
    throw new Error(`Missing skill name in manifest at ${sourcePath}.`);
  }

  const sections = record.sections;
  if (!sections || typeof sections !== "object") {
    throw new Error(`Missing sections in manifest at ${sourcePath}.`);
  }

  const sectionRecord = sections as Record<string, unknown>;
  if (
    !(
      sectionRecord.core &&
      sectionRecord.commands &&
      sectionRecord.references &&
      sectionRecord.examples
    )
  ) {
    throw new Error(`Incomplete sections in manifest at ${sourcePath}.`);
  }

  return normalizeManifest(parsed);
}

/**
 * Read and parse a manifest file from disk.
 * @param skillDir - Absolute path to the skills directory.
 * @returns Parsed manifest or null if file not found.
 */
async function readManifestFile(
  skillDir: string
): Promise<SkillManifest | null> {
  const manifestPath = join(skillDir, SKILL_MANIFEST_FILE);
  try {
    const raw = await readFile(manifestPath, "utf8");
    return parseManifest(raw, manifestPath);
  } catch (error) {
    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      (error as NodeJS.ErrnoException).code === "ENOENT"
    ) {
      return null;
    }
    throw error;
  }
}

/**
 * Build manifest sections by scanning the skill directory.
 * @param skillDir - Absolute path to the skills directory.
 * @returns Sections discovered from filesystem structure.
 */
function buildSectionsFromScan(skillDir: string): SkillManifestSections {
  const commands = discoverMarkdownFiles(join(skillDir, "commands")).map(
    (name) =>
      buildSectionManifest(name, "command", join("commands", `${name}.md`))
  );
  const references = discoverMarkdownFiles(join(skillDir, "references")).map(
    (name) =>
      buildSectionManifest(name, "reference", join("references", `${name}.md`))
  );
  const examples = discoverMarkdownFiles(join(skillDir, "examples")).map(
    (name) =>
      buildSectionManifest(name, "example", join("examples", `${name}.md`))
  );

  return {
    core: buildSectionManifest("core", "core", SKILL_ENTRY_FILE),
    commands,
    references,
    examples,
  };
}

/**
 * Build a manifest by scanning the skill directory filesystem.
 * @param skillDir - Absolute path to the skills directory.
 * @returns Manifest built from directory structure and entry file.
 */
async function buildManifestFromScan(skillDir: string): Promise<SkillManifest> {
  const entryPath = join(skillDir, SKILL_ENTRY_FILE);
  const raw = await readFile(entryPath, "utf8");
  const { frontmatter } = extractFrontmatter(raw);

  const meta = frontmatter ? parseFrontmatterYaml(frontmatter, entryPath) : {};
  const sections = buildSectionsFromScan(skillDir);

  return normalizeManifest({
    name: meta.name ?? basename(skillDir),
    ...(meta.version ? { version: meta.version } : {}),
    ...(meta.description ? { description: meta.description } : {}),
    sections,
  });
}

/**
 * Determine whether to use live filesystem scanning.
 * @returns True if live scan should be used instead of cached manifest.
 */
function shouldUseLiveScan(): boolean {
  const override = process.env[SKILL_LIVE_SCAN_ENV];
  if (override) {
    return ["1", "true", "yes", "on"].includes(override.toLowerCase());
  }
  return process.env.NODE_ENV !== "production";
}

/**
 * Load and parse the skill manifest from a skills directory.
 * @param skillDir - Absolute path to the skills directory.
 * @returns Parsed skill manifest data.
 */
export async function loadSkillManifest(
  skillDir: string
): Promise<SkillManifest> {
  const manifest = await readManifestFile(skillDir);
  if (manifest) {
    return manifest;
  }

  if (!shouldUseLiveScan()) {
    throw new Error(
      `Skill manifest not found. Run the build step to generate ${SKILL_MANIFEST_FILE}.`
    );
  }

  return buildManifestFromScan(skillDir);
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
  const { sections: manifestSections, ...manifestData } = manifest;
  const core = await loadSkillSection(
    skillDir,
    manifestSections.core.name,
    "core",
    manifestSections.core.path
  );

  const commands: Record<string, SkillSection> = {};
  const references: Record<string, SkillSection> = {};
  const examples: Record<string, SkillSection> = {};

  for (const section of manifestSections.commands) {
    commands[section.name] = await loadSkillSection(
      skillDir,
      section.name,
      "command",
      section.path
    );
  }

  for (const section of manifestSections.references) {
    references[section.name] = await loadSkillSection(
      skillDir,
      section.name,
      "reference",
      section.path
    );
  }

  for (const section of manifestSections.examples) {
    examples[section.name] = await loadSkillSection(
      skillDir,
      section.name,
      "example",
      section.path
    );
  }

  return {
    ...manifestData,
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
