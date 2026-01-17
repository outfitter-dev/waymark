#!/usr/bin/env bun
// tldr ::: enforce TSDoc coverage for public API exports #scripts/typedoc-check

import { existsSync } from "node:fs";
import { dirname, isAbsolute, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type {
  Comment,
  CommentDisplayPart,
  CommentTag,
  ProjectReflection,
} from "typedoc";
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
  rootDir: string;
};

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const PACKAGES: Record<PackageKey, PackageConfig> = {
  core: {
    key: "core",
    name: "@waymarks/core",
    entryPoint: "packages/core/src/index.ts",
    tsconfig: "packages/core/tsconfig.build.json",
    rootDir: "packages/core",
  },
  cli: {
    key: "cli",
    name: "@waymarks/cli",
    entryPoint: "packages/cli/src/index.ts",
    tsconfig: "packages/cli/tsconfig.build.json",
    rootDir: "packages/cli",
  },
  grammar: {
    key: "grammar",
    name: "@waymarks/grammar",
    entryPoint: "packages/grammar/src/index.ts",
    tsconfig: "packages/grammar/tsconfig.build.json",
    rootDir: "packages/grammar",
  },
  mcp: {
    key: "mcp",
    name: "@waymarks/mcp",
    entryPoint: "apps/mcp/src/index.ts",
    tsconfig: "apps/mcp/tsconfig.build.json",
    rootDir: "apps/mcp",
  },
  agents: {
    key: "agents",
    name: "@waymarks/agents",
    entryPoint: "packages/agents/src/index.ts",
    tsconfig: "packages/agents/tsconfig.build.json",
    rootDir: "packages/agents",
  },
};

const DEFAULT_ENFORCED_PACKAGES: PackageKey[] = [
  "core",
  "cli",
  "grammar",
  "mcp",
  "agents",
];

const DOC_KINDS: ReflectionKind[] = [
  ReflectionKind.Class,
  ReflectionKind.Interface,
  ReflectionKind.Enum,
  ReflectionKind.Function,
  ReflectionKind.Variable,
  ReflectionKind.TypeAlias,
  ReflectionKind.Namespace,
];

const VALID_KEYS = Object.keys(PACKAGES) as PackageKey[];

function normalizeKey(value: string): PackageKey | null {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }
  const key = trimmed.toLowerCase() as PackageKey;
  return key in PACKAGES ? key : null;
}

function warnUnrecognizedKeys(rawValues: string[]): void {
  const unrecognized = rawValues
    .map((v) => v.trim().toLowerCase())
    .filter((v) => v && !(v in PACKAGES));

  if (unrecognized.length === 0) {
    return;
  }

  for (const key of unrecognized) {
    console.warn(`Warning: Unrecognized package key "${key}"`);
  }
  console.warn(`Valid packages: ${VALID_KEYS.join(", ")}`);
}

function resolveEnforcedPackages(): Set<PackageKey> {
  const rawCliArgs = process.argv.slice(2);
  if (rawCliArgs.length > 0) {
    warnUnrecognizedKeys(rawCliArgs);
    const cliArgs = rawCliArgs
      .map(normalizeKey)
      .filter((value): value is PackageKey => Boolean(value));
    if (cliArgs.length > 0) {
      return new Set(cliArgs);
    }
  }

  const envValue =
    process.env.WAYMARK_TSDOC_PACKAGES ?? process.env.DOCS_COVERAGE_PACKAGES;
  if (envValue) {
    const rawEnvValues = envValue.split(",");
    warnUnrecognizedKeys(rawEnvValues);
    const fromEnv = rawEnvValues
      .map(normalizeKey)
      .filter((value): value is PackageKey => Boolean(value));
    if (fromEnv.length > 0) {
      return new Set(fromEnv);
    }
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

  const summary =
    comment.summary?.map((part: CommentDisplayPart) => part.text).join("") ??
    "";
  if (hasText(summary)) {
    return true;
  }

  if (comment.blockTags && comment.blockTags.length > 0) {
    return comment.blockTags.some((tag: CommentTag) => {
      const body =
        tag.content?.map((part: CommentDisplayPart) => part.text).join("") ??
        "";
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

function isWithinPackage(
  packageRoot: string,
  reflection: DeclarationReflection
): boolean {
  const source = reflection.sources?.[0];
  if (!source) {
    return true;
  }

  const relPath = relative(packageRoot, source.fileName);
  return relPath !== "" && !relPath.startsWith("..") && !isAbsolute(relPath);
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

async function checkPackageDocs(
  config: PackageConfig,
  rootDir: string
): Promise<string[]> {
  const entryPoint = resolve(rootDir, config.entryPoint);
  const tsconfig = resolve(rootDir, config.tsconfig);
  const packageRoot = resolve(rootDir, config.rootDir);

  const missing: string[] = [];

  if (!existsSync(entryPoint)) {
    missing.push(`Missing entry point at ${entryPoint}.`);
    return missing;
  }

  if (!existsSync(tsconfig)) {
    missing.push(`Missing tsconfig at ${tsconfig}.`);
    return missing;
  }

  const app = await Application.bootstrap(
    {
      entryPoints: [entryPoint],
      tsconfig,
      excludePrivate: true,
      excludeProtected: true,
      excludeExternals: true,
      excludeInternal: true,
      logLevel: "Error",
    },
    [new TypeDocReader(), new TSConfigReader()]
  );

  const project = await app.convert();
  if (!project) {
    missing.push(`TypeDoc failed to build project for ${config.name}.`);
    return missing;
  }

  const topLevel = collectTopLevel(project);
  for (const reflection of topLevel) {
    if (!isDocKind(reflection)) {
      continue;
    }
    if (!isWithinPackage(packageRoot, reflection)) {
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

  const missing = await checkPackageDocs(config, repoRoot);
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
