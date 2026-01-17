// tldr ::: shared types for skill manifests and sections [[cli/skill-types]]

export type SkillSectionKind = "core" | "command" | "reference" | "example";

export type SkillSectionManifest = {
  name: string;
  kind: SkillSectionKind;
  path: string;
  aliases?: string[];
  order?: number;
  related?: string[];
  metadata?: Record<string, unknown>;
};

export type SkillManifestSections = {
  core: SkillSectionManifest;
  commands: SkillSectionManifest[];
  references: SkillSectionManifest[];
  examples: SkillSectionManifest[];
};

export type SkillManifest = {
  name: string;
  version?: string;
  description?: string;
  commands: string[];
  references: string[];
  examples: string[];
  sections: SkillManifestSections;
};

export const SKILL_ENTRY_FILE = "SKILL.md";
export const SKILL_MANIFEST_FILE = "manifest.json";
