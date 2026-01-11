#!/usr/bin/env bun
// tldr ::: enforce TSDoc coverage for public API exports #scripts/typedoc-check

import { existsSync } from "node:fs";
import { dirname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { Comment, ProjectReflection } from "typedoc";
import {
  Application,
  DeclarationReflection,
  ReflectionKind,
  TSConfigReader,
  TypeDocReader,
} from "typedoc";

type PackageKey = "core" | "cli" | "grammar" | "mcp" | "agents";

type PackageConfig = {
  key: PackageKey;
  name: string;
  entryPoint: string;
  tsconfig: string;
};

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const PACKAGES: Record<PackageKey, PackageConfig> = {
  core: {
    key: "core",
    name: "@waymarks/core",
    entryPoint: "packages/core/src/index.ts",
    tsconfig: "packages/core/tsconfig.build.json",
  },
  cli: {
    key: "cli",
    name: "@waymarks/cli",
    entryPoint: "packages/cli/src/index.ts",
    tsconfig: "packages/cli/tsconfig.build.json",
  },
  grammar: {
    key: "grammar",
    name: "@waymarks/grammar",
    entryPoint: "packages/grammar/src/index.ts",
    tsconfig: "packages/grammar/tsconfig.build.json",
  },
  mcp: {
    key: "mcp",
    name: "@waymarks/mcp",
    entryPoint: "packages/mcp/src/index.ts",
    tsconfig: "packages/mcp/tsconfig.build.json",
  },
  agents: {
    key: "agents",
    name: "@waymarks/agents",
    entryPoint: "packages/agents/src/index.ts",
    tsconfig: "packages/agents/tsconfig.build.json",
  },
};

const DEFAULT_ENFORCED_PACKAGES: PackageKey[] = [];

const DOC_KINDS: ReflectionKind[] = [
  ReflectionKind.Class,
  ReflectionKind.Interface,
  ReflectionKind.Enum,
  ReflectionKind.Function,
  ReflectionKind.Variable,
  ReflectionKind.TypeAlias,
  ReflectionKind.Namespace,
];

function normalizeKey(value: string): PackageKey | null {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }
  const key = trimmed.toLowerCase() as PackageKey;
  return key in PACKAGES ? key : null;
}

function resolveEnforcedPackages(): Set<PackageKey> {
  const cliArgs = process.argv
    .slice(2)
    .map(normalizeKey)
    .filter((value): value is PackageKey => Boolean(value));
  if (cliArgs.length > 0) {
    return new Set(cliArgs as PackageKey[]);
  }

  const envValue =
    process.env.WAYMARK_TSDOC_PACKAGES ?? process.env.DOCS_COVERAGE_PACKAGES;
  if (envValue) {
    const fromEnv = envValue
      .split(",")
      .map(normalizeKey)
      .filter((value): value is PackageKey => Boolean(value));
    return new Set(fromEnv);
  }

  return new Set(DEFAULT_ENFORCED_PACKAGES);
}

function hasText(value: string | undefined): boolean {
  return Boolean(value && value.trim().length > 0);
}

function hasCommentText(comment: Comment | undefined): boolean {
  if (!comment) {
    return false;
  }

  const summary = comment.summary?.map((part) => part.text).join("") ?? "";
  if (hasText(summary)) {
    return true;
  }

  if (comment.blockTags && comment.blockTags.length > 0) {
    return comment.blockTags.some((tag) => {
      const body = tag.content?.map((part) => part.text).join("") ?? "";
      return hasText(body);
    });
  }

  return false;
}

function isDocumented(reflection: DeclarationReflection): boolean {
  if (hasCommentText(reflection.comment)) {
    return true;
  }

  const signatures = reflection.signatures ?? [];
  for (const signature of signatures) {
    if (hasCommentText(signature.comment)) {
      return true;
    }
  }

  return false;
}

function isDocKind(reflection: DeclarationReflection): boolean {
  return DOC_KINDS.some((kind) => reflection.kindOf(kind));
}

function formatReflection(
  reflection: DeclarationReflection,
  rootDir: string
): string {
  const kind = ReflectionKind[reflection.kind] ?? "Unknown";
  const source = reflection.sources?.[0];
  if (!source) {
    return `${kind} ${reflection.name}`;
  }
  const file = relative(rootDir, source.fileName);
  return `${kind} ${reflection.name} (${file}:${source.line})`;
}

function collectTopLevel(project: ProjectReflection): DeclarationReflection[] {
  const children = project.children ?? [];
  const modules = children.filter((child) =>
    child.kindOf(ReflectionKind.Module)
  );

  const topLevel =
    modules.length > 0
      ? modules.flatMap((module) => module.children ?? [])
      : children;

  return topLevel.filter(
    (child): child is DeclarationReflection =>
      child instanceof DeclarationReflection
  );
}

function checkPackageDocs(config: PackageConfig, rootDir: string): string[] {
  const entryPoint = resolve(rootDir, config.entryPoint);
  const tsconfig = resolve(rootDir, config.tsconfig);

  const missing: string[] = [];

  if (!existsSync(entryPoint)) {
    missing.push(`Missing entry point at ${entryPoint}.`);
    return missing;
  }

  if (!existsSync(tsconfig)) {
    missing.push(`Missing tsconfig at ${tsconfig}.`);
    return missing;
  }

  const app = new Application();
  app.options.addReader(new TypeDocReader());
  app.options.addReader(new TSConfigReader());
  app.bootstrap({
    entryPoints: [entryPoint],
    tsconfig,
    excludePrivate: true,
    excludeProtected: true,
    excludeExternals: true,
    excludeInternal: true,
    logLevel: "Error",
  });

  const project = app.convert();
  if (!project) {
    missing.push(`TypeDoc failed to build project for ${config.name}.`);
    return missing;
  }

  const topLevel = collectTopLevel(project);
  for (const reflection of topLevel) {
    if (!isDocKind(reflection)) {
      continue;
    }
    if (isDocumented(reflection)) {
      continue;
    }
    missing.push(formatReflection(reflection, rootDir));
  }

  return missing;
}

const enforced = resolveEnforcedPackages();

if (enforced.size === 0) {
  console.log("Doc coverage check skipped (no packages enforced).");
  process.exit(0);
}

const failures: string[] = [];

for (const key of enforced) {
  const config = PACKAGES[key];
  if (!config) {
    failures.push(`Unknown package key: ${key}`);
    continue;
  }

  const missing = checkPackageDocs(config, repoRoot);
  if (missing.length > 0) {
    failures.push(`${config.name} missing docs:`);
    failures.push(...missing.map((entry) => `- ${entry}`));
  }
}

if (failures.length > 0) {
  console.error("Doc coverage check failed:");
  for (const entry of failures) {
    console.error(entry);
  }
  process.exit(1);
}

console.log("Doc coverage check passed.");
