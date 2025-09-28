// tldr ::: default waymark configuration helpers, disk loading, and normalization utilities

import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, extname, join, resolve } from "node:path";

import stripJsonComments from "strip-json-comments";
import { parse as parseToml } from "toml";
import { parse as parseYaml } from "yaml";

import type { WaymarkConfig } from "./types";

type FormatConfig = WaymarkConfig["format"];
type LintConfig = WaymarkConfig["lint"];

const DEFAULT_FORMAT: WaymarkConfig["format"] = {
  spaceAroundSigil: true,
  normalizeCase: true,
};

const DEFAULT_LINT: WaymarkConfig["lint"] = {
  duplicateProperty: "warn",
  unknownMarker: "warn",
  danglingRelation: "error",
  duplicateCanonical: "error",
};

export const DEFAULT_CONFIG: WaymarkConfig = {
  markerCase: "lowercase",
  idScope: "repo",
  protectedBranches: ["main", "release/*"],
  signalsOnProtected: "strip",
  allowMarkers: [],
  skipPaths: ["**/.git/**", "**/node_modules/**", "**/dist/**"],
  format: DEFAULT_FORMAT,
  lint: DEFAULT_LINT,
};

export type ResolveConfigOptions = {
  overrides?: Partial<WaymarkConfig>;
};

export type ConfigScope = "default" | "project" | "global";

export type LoadConfigOptions = {
  cwd?: string;
  scope?: ConfigScope;
  explicitPath?: string;
  env?: NodeJS.ProcessEnv;
};

const CONFIG_FILENAMES = [
  "config.jsonc",
  "config.json",
  "config.yaml",
  "config.yml",
  "config.toml",
];

const RC_FILENAMES = [
  ".waymarkrc.jsonc",
  ".waymarkrc.json",
  ".waymarkrc.yaml",
  ".waymarkrc.yml",
  ".waymarkrc.toml",
];

export function resolveConfig(
  overrides?: Partial<WaymarkConfig>
): WaymarkConfig {
  if (!overrides) {
    return cloneConfig(DEFAULT_CONFIG);
  }

  return {
    markerCase: overrides.markerCase ?? DEFAULT_CONFIG.markerCase,
    idScope: overrides.idScope ?? DEFAULT_CONFIG.idScope,
    protectedBranches:
      overrides.protectedBranches?.slice() ??
      DEFAULT_CONFIG.protectedBranches.slice(),
    signalsOnProtected:
      overrides.signalsOnProtected ?? DEFAULT_CONFIG.signalsOnProtected,
    allowMarkers:
      overrides.allowMarkers?.slice() ?? DEFAULT_CONFIG.allowMarkers.slice(),
    skipPaths: overrides.skipPaths?.slice() ?? DEFAULT_CONFIG.skipPaths.slice(),
    format: {
      spaceAroundSigil:
        overrides.format?.spaceAroundSigil ??
        DEFAULT_CONFIG.format.spaceAroundSigil,
      normalizeCase:
        overrides.format?.normalizeCase ?? DEFAULT_CONFIG.format.normalizeCase,
    },
    lint: {
      duplicateProperty:
        overrides.lint?.duplicateProperty ??
        DEFAULT_CONFIG.lint.duplicateProperty,
      unknownMarker:
        overrides.lint?.unknownMarker ?? DEFAULT_CONFIG.lint.unknownMarker,
      danglingRelation:
        overrides.lint?.danglingRelation ??
        DEFAULT_CONFIG.lint.danglingRelation,
      duplicateCanonical:
        overrides.lint?.duplicateCanonical ??
        DEFAULT_CONFIG.lint.duplicateCanonical,
    },
  };
}

export function cloneConfig(config: WaymarkConfig): WaymarkConfig {
  return {
    markerCase: config.markerCase,
    idScope: config.idScope,
    protectedBranches: config.protectedBranches.slice(),
    signalsOnProtected: config.signalsOnProtected,
    allowMarkers: config.allowMarkers.slice(),
    skipPaths: config.skipPaths.slice(),
    format: {
      spaceAroundSigil: config.format.spaceAroundSigil,
      normalizeCase: config.format.normalizeCase,
    },
    lint: {
      duplicateProperty: config.lint.duplicateProperty,
      unknownMarker: config.lint.unknownMarker,
      danglingRelation: config.lint.danglingRelation,
      duplicateCanonical: config.lint.duplicateCanonical,
    },
  };
}

export async function loadConfigFromDisk(
  options: LoadConfigOptions = {}
): Promise<WaymarkConfig> {
  const {
    cwd = process.cwd(),
    scope = "default",
    explicitPath,
    env = process.env,
  } = options;

  const resolvedExplicit = explicitPath
    ? resolve(cwd, explicitPath)
    : undefined;

  if (resolvedExplicit) {
    const overrides = await readConfigOverrides(resolvedExplicit);
    if (overrides) {
      return resolveConfig(overrides);
    }
    throw new Error(`Failed to load config from ${resolvedExplicit}`);
  }

  const envPath = env.WAYMARK_CONFIG_PATH;
  if (envPath) {
    const overrides = await readConfigOverrides(resolve(cwd, envPath));
    if (overrides) {
      return resolveConfig(overrides);
    }
  }

  let overrides: Partial<WaymarkConfig> | undefined;

  if (scope === "project") {
    overrides = await loadProjectOverrides(cwd);
  } else if (scope === "global") {
    overrides = await loadGlobalOverrides(env);
  } else {
    overrides =
      (await findNearestRcOverrides(cwd)) ??
      (await loadProjectOverrides(cwd)) ??
      (await loadGlobalOverrides(env));
  }

  return resolveConfig(overrides);
}

async function readConfigOverrides(
  filePath: string
): Promise<Partial<WaymarkConfig> | undefined> {
  if (!existsSync(filePath)) {
    return;
  }

  const raw = await readFile(filePath, "utf8");
  const ext = extname(filePath).toLowerCase();

  try {
    if (ext === ".yaml" || ext === ".yml") {
      return normalizeConfigShape(parseYaml(raw));
    }

    if (ext === ".toml") {
      return normalizeConfigShape(parseToml(raw));
    }

    const text = ext === ".jsonc" ? stripJsonComments(raw) : raw;
    return normalizeConfigShape(JSON.parse(text));
  } catch (error) {
    throw new Error(
      `Unable to parse config at ${filePath}: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
  }
}

async function findNearestRcOverrides(
  start: string
): Promise<Partial<WaymarkConfig> | undefined> {
  for (const directory of walkDirectories(start)) {
    for (const candidate of RC_FILENAMES) {
      const filePath = join(directory, candidate);
      const overrides = await readConfigOverrides(filePath);
      if (overrides) {
        return overrides;
      }
    }
  }
  return;
}

async function loadProjectOverrides(
  start: string
): Promise<Partial<WaymarkConfig> | undefined> {
  for (const directory of walkDirectories(start)) {
    for (const candidate of CONFIG_FILENAMES) {
      const filePath = join(directory, ".waymark", candidate);
      const overrides = await readConfigOverrides(filePath);
      if (overrides) {
        return overrides;
      }
    }
  }
  return;
}

async function loadGlobalOverrides(
  env: NodeJS.ProcessEnv
): Promise<Partial<WaymarkConfig> | undefined> {
  const baseDir = env.XDG_CONFIG_HOME
    ? resolve(env.XDG_CONFIG_HOME)
    : join(homedir(), ".config");
  const configDir = join(baseDir, "waymark");

  for (const candidate of CONFIG_FILENAMES) {
    const filePath = join(configDir, candidate);
    const overrides = await readConfigOverrides(filePath);
    if (overrides) {
      return overrides;
    }
  }

  return;
}

function* walkDirectories(start: string): Iterable<string> {
  let current = resolve(start);
  while (true) {
    yield current;
    const parent = dirname(current);
    if (parent === current) {
      break;
    }
    current = parent;
  }
}

function normalizeConfigShape(
  value: unknown
): Partial<WaymarkConfig> | undefined {
  if (typeof value !== "object" || value === null) {
    return;
  }

  const raw = value as Record<string, unknown>;
  const result: Partial<WaymarkConfig> = {};

  assignScalarOptions(result, raw);
  assignFormatOptions(result, raw);
  assignLintOptions(result, raw);

  return result;
}

function assignScalarOptions(
  result: Partial<WaymarkConfig>,
  raw: Record<string, unknown>
): void {
  const markerCase = readString(raw, ["markerCase", "marker_case"]);
  if (markerCase === "lowercase" || markerCase === "uppercase") {
    result.markerCase = markerCase;
  }

  const idScope = readString(raw, ["idScope", "id_scope"]);
  if (idScope === "repo" || idScope === "file") {
    result.idScope = idScope;
  }

  const protectedBranches = readStringArray(raw, [
    "protectedBranches",
    "protected_branches",
  ]);
  if (protectedBranches) {
    result.protectedBranches = protectedBranches;
  }

  const signalsOnProtected = readString(raw, [
    "signalsOnProtected",
    "signals_on_protected",
  ]);
  if (
    signalsOnProtected === "strip" ||
    signalsOnProtected === "fail" ||
    signalsOnProtected === "allow"
  ) {
    result.signalsOnProtected = signalsOnProtected;
  }

  const allowMarkers = readStringArray(raw, ["allowMarkers", "allow_markers"]);
  if (allowMarkers) {
    result.allowMarkers = allowMarkers.map((marker) => marker.toLowerCase());
  }

  const skipPaths = readStringArray(raw, ["skipPaths", "skip_paths"]);
  if (skipPaths) {
    result.skipPaths = skipPaths;
  }
}

function assignFormatOptions(
  result: Partial<WaymarkConfig>,
  raw: Record<string, unknown>
): void {
  const formatRaw = readObject(raw, "format");
  if (!formatRaw) {
    return;
  }

  const format: Partial<FormatConfig> = {};
  const spaceAroundSigil = readBoolean(formatRaw, [
    "spaceAroundSigil",
    "space_around_sigil",
  ]);
  if (typeof spaceAroundSigil === "boolean") {
    format.spaceAroundSigil = spaceAroundSigil;
  }
  const normalizeCase = readBoolean(formatRaw, [
    "normalizeCase",
    "normalize_case",
  ]);
  if (typeof normalizeCase === "boolean") {
    format.normalizeCase = normalizeCase;
  }
  if (Object.keys(format).length > 0) {
    result.format = format as FormatConfig;
  }
}

function assignLintOptions(
  result: Partial<WaymarkConfig>,
  raw: Record<string, unknown>
): void {
  const lintRaw = readObject(raw, "lint");
  if (!lintRaw) {
    return;
  }

  const lint: Partial<LintConfig> = {};
  setLintLevel(lintRaw, lint, "duplicateProperty", "duplicate_property");
  setLintLevel(lintRaw, lint, "unknownMarker", "unknown_marker");
  setLintLevel(lintRaw, lint, "danglingRelation", "dangling_relation");
  setLintLevel(lintRaw, lint, "duplicateCanonical", "duplicate_canonical");
  if (Object.keys(lint).length > 0) {
    result.lint = lint as LintConfig;
  }
}

function readString(
  source: Record<string, unknown>,
  keys: string[]
): string | undefined {
  for (const key of keys) {
    const value = source[key];
    if (typeof value === "string") {
      return value;
    }
  }
  return;
}

function readBoolean(
  source: Record<string, unknown>,
  keys: string[]
): boolean | undefined {
  for (const key of keys) {
    const value = source[key];
    if (typeof value === "boolean") {
      return value;
    }
  }
  return;
}

function readStringArray(
  source: Record<string, unknown>,
  keys: string[]
): string[] | undefined {
  for (const key of keys) {
    const value = source[key];
    if (Array.isArray(value)) {
      const strings = value.filter(
        (item): item is string => typeof item === "string"
      );
      return strings.length > 0 ? strings : [];
    }
  }
  return;
}

function readObject(
  source: Record<string, unknown>,
  key: string
): Record<string, unknown> | undefined {
  const value = source[key];
  if (typeof value === "object" && value !== null && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return;
}

function setLintLevel(
  source: Record<string, unknown>,
  target: Partial<LintConfig>,
  camel: keyof LintConfig,
  snake: string
): void {
  const value = readString(source, [camel as string, snake]);
  if (value === "warn" || value === "error" || value === "ignore") {
    target[camel] = value;
  }
}
