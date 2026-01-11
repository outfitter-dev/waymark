// tldr ::: build skill manifest data from skill markdown and frontmatter #scripts/skill-manifest

import { basename, dirname, join } from "node:path";
import { parse as parseYaml } from "yaml";

import { extractFrontmatter } from "../packages/cli/src/skills/frontmatter.ts";
import {
  SKILL_ENTRY_FILE,
  type SkillManifest,
  type SkillManifestSections,
  type SkillSectionKind,
  type SkillSectionManifest,
} from "../packages/cli/src/skills/types.ts";

type FrontmatterRecord = Record<string, unknown>;

function asRecord(value: unknown): FrontmatterRecord | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  return value as FrontmatterRecord;
}

function asString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : undefined;
}

function asStringArray(value: unknown): string[] | undefined {
  if (typeof value === "string") {
    return [value];
  }
  if (
    Array.isArray(value) &&
    value.every((entry) => typeof entry === "string")
  ) {
    return value;
  }
  return;
}

function asNumber(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }
  return;
}

function parseFrontmatter(
  raw: string | undefined,
  sourcePath: string
): FrontmatterRecord {
  if (!raw || raw.trim().length === 0) {
    return {};
  }

  try {
    const parsed = parseYaml(raw);
    return asRecord(parsed) ?? {};
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to parse frontmatter in ${sourcePath}: ${message}`);
  }
}

function inferKindFromPath(relativePath: string): SkillSectionKind | null {
  const [prefix] = relativePath.split("/");
  switch (prefix) {
    case "commands":
      return "command";
    case "references":
      return "reference";
    case "examples":
      return "example";
    default:
      return null;
  }
}

function buildSectionManifest(
  section: Omit<
    SkillSectionManifest,
    "aliases" | "order" | "related" | "metadata"
  > &
    Partial<
      Pick<SkillSectionManifest, "aliases" | "order" | "related" | "metadata">
    >
): SkillSectionManifest {
  return {
    name: section.name,
    kind: section.kind,
    path: section.path,
    ...(section.aliases && section.aliases.length > 0
      ? { aliases: section.aliases }
      : {}),
    ...(typeof section.order === "number" ? { order: section.order } : {}),
    ...(section.related && section.related.length > 0
      ? { related: section.related }
      : {}),
    ...(section.metadata && Object.keys(section.metadata).length > 0
      ? { metadata: section.metadata }
      : {}),
  };
}

function compareSections(
  left: SkillSectionManifest,
  right: SkillSectionManifest
): number {
  const leftOrder = left.order ?? Number.POSITIVE_INFINITY;
  const rightOrder = right.order ?? Number.POSITIVE_INFINITY;
  if (leftOrder !== rightOrder) {
    return leftOrder - rightOrder;
  }
  return left.name.localeCompare(right.name);
}

function resolveSectionKind(
  frontmatter: FrontmatterRecord,
  relativePath: string
): SkillSectionKind | null {
  const kindValue = asString(frontmatter.kind);
  if (
    kindValue === "command" ||
    kindValue === "reference" ||
    kindValue === "example" ||
    kindValue === "core"
  ) {
    return kindValue;
  }
  return inferKindFromPath(relativePath);
}

function readText(path: string): Promise<string> {
  return Bun.file(path).text();
}

function buildSectionFromFrontmatter(
  relativePath: string,
  frontmatter: FrontmatterRecord,
  kind: SkillSectionKind
): SkillSectionManifest {
  const name = asString(frontmatter.name) ?? basename(relativePath, ".md");
  const aliases = asStringArray(frontmatter.aliases);
  const related = asStringArray(frontmatter.related);
  const order = asNumber(frontmatter.order);
  const metadata = asRecord(frontmatter.metadata) ?? undefined;

  return buildSectionManifest({
    name,
    kind,
    path: relativePath,
    ...(aliases ? { aliases } : {}),
    ...(related ? { related } : {}),
    ...(typeof order === "number" ? { order } : {}),
    ...(metadata ? { metadata } : {}),
  });
}

export async function discoverSkillDirectories(
  rootDir: string
): Promise<string[]> {
  const glob = new Bun.Glob("**/SKILL.md");
  const skillDirs: string[] = [];

  for await (const match of glob.scan({ cwd: rootDir })) {
    skillDirs.push(join(rootDir, dirname(match)));
  }

  return skillDirs.sort();
}

type SectionBuckets = {
  commands: SkillSectionManifest[];
  references: SkillSectionManifest[];
  examples: SkillSectionManifest[];
};

type SectionRegistry = {
  commands: Set<string>;
  references: Set<string>;
  examples: Set<string>;
};

type AddSectionInput = {
  kind: SkillSectionKind;
  section: SkillSectionManifest;
  buckets: SectionBuckets;
  registry: SectionRegistry;
  skillDir: string;
};

function addSection({
  kind,
  section,
  buckets,
  registry,
  skillDir,
}: AddSectionInput): void {
  if (kind === "command") {
    if (registry.commands.has(section.name)) {
      throw new Error(
        `Duplicate command section "${section.name}" in ${skillDir}`
      );
    }
    registry.commands.add(section.name);
    buckets.commands.push(section);
    return;
  }

  if (kind === "reference") {
    if (registry.references.has(section.name)) {
      throw new Error(
        `Duplicate reference section "${section.name}" in ${skillDir}`
      );
    }
    registry.references.add(section.name);
    buckets.references.push(section);
    return;
  }

  if (kind === "example") {
    if (registry.examples.has(section.name)) {
      throw new Error(
        `Duplicate example section "${section.name}" in ${skillDir}`
      );
    }
    registry.examples.add(section.name);
    buckets.examples.push(section);
  }
}

async function resolveSection(
  skillDir: string,
  relativePath: string
): Promise<{ kind: SkillSectionKind; section: SkillSectionManifest } | null> {
  if (relativePath === SKILL_ENTRY_FILE) {
    return null;
  }

  const content = await readText(join(skillDir, relativePath));
  const extracted = extractFrontmatter(content);
    const frontmatter = parseFrontmatter(
      extracted.frontmatter,
      join(skillDir, relativePath)
    );
  const kind = resolveSectionKind(frontmatter, relativePath);

  if (!kind || kind === "core") {
    return null;
  }

  const section = buildSectionFromFrontmatter(relativePath, frontmatter, kind);
  return { kind, section };
}

async function collectSections(skillDir: string): Promise<SectionBuckets> {
  const buckets: SectionBuckets = {
    commands: [],
    references: [],
    examples: [],
  };
  const registry: SectionRegistry = {
    commands: new Set<string>(),
    references: new Set<string>(),
    examples: new Set<string>(),
  };

  const glob = new Bun.Glob("**/*.md");
  for await (const relativePath of glob.scan({ cwd: skillDir })) {
    const resolved = await resolveSection(skillDir, relativePath);
    if (!resolved) {
      continue;
    }
    addSection({
      kind: resolved.kind,
      section: resolved.section,
      buckets,
      registry,
      skillDir,
    });
  }

  buckets.commands.sort(compareSections);
  buckets.references.sort(compareSections);
  buckets.examples.sort(compareSections);

  return buckets;
}

async function readSkillMetadata(
  skillDir: string
): Promise<{ name: string; description?: string; version?: string }> {
  const entryPath = join(skillDir, SKILL_ENTRY_FILE);
  const entryContent = await readText(entryPath);
  const entryExtracted = extractFrontmatter(entryContent);
  const entryFrontmatter = parseFrontmatter(
    entryExtracted.frontmatter,
    entryPath
  );
  const description = asString(entryFrontmatter.description);
  const version = asString(entryFrontmatter.version);

  return {
    name: asString(entryFrontmatter.name) ?? basename(skillDir),
    ...(description ? { description } : {}),
    ...(version ? { version } : {}),
  };
}

export async function buildSkillManifest(
  skillDir: string
): Promise<SkillManifest> {
  const metadata = await readSkillMetadata(skillDir);
  const { commands, references, examples } = await collectSections(skillDir);

  const sections: SkillManifestSections = {
    core: buildSectionManifest({
      name: "core",
      kind: "core",
      path: SKILL_ENTRY_FILE,
    }),
    commands,
    references,
    examples,
  };

  return {
    name: metadata.name,
    ...(metadata.version ? { version: metadata.version } : {}),
    ...(metadata.description ? { description: metadata.description } : {}),
    commands: sections.commands.map((section) => section.name),
    references: sections.references.map((section) => section.name),
    examples: sections.examples.map((section) => section.name),
    sections,
  };
}

export function formatSkillManifest(manifest: SkillManifest): string {
  const normalized: SkillManifest = {
    name: manifest.name,
    ...(manifest.version ? { version: manifest.version } : {}),
    ...(manifest.description ? { description: manifest.description } : {}),
    commands: manifest.commands,
    references: manifest.references,
    examples: manifest.examples,
    sections: manifest.sections,
  };

  return `${JSON.stringify(normalized, null, 2)}\n`;
}
