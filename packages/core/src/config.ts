// tldr ::: default waymark configuration helpers, disk loading, and normalization utilities

import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, extname, join, resolve } from "node:path";

import stripJsonComments from "strip-json-comments";
import { parse as parseToml } from "toml";
import { parse as parseYaml } from "yaml";

import type {
  PartialWaymarkConfig,
  WaymarkConfig,
  WaymarkFormatConfig,
  WaymarkLintConfig,
} from "./types";

/** Default configuration values for waymark operations. */
export const DEFAULT_CONFIG: WaymarkConfig = {
  typeCase: "lowercase",
  idScope: "repo",
  allowTypes: [],
  skipPaths: [
    "**/.git/**",
    "**/node_modules/**",
    "**/dist/**",
    "**/build/**",
    "**/.turbo/**",
    "**/fixtures/**",
    "**/__fixtures__/**",
    "**/test-data/**",
    "**/*.fixture.*",
    "**/*.invalid.*",
  ],
  includePaths: [],
  respectGitignore: true,
  scan: {
    includeCodetags: false,
  },
  format: {
    spaceAroundSigil: true,
    normalizeCase: true,
    alignContinuations: true,
  },
  lint: {
    duplicateProperty: "warn",
    unknownMarker: "warn",
    danglingRelation: "error",
    duplicateCanonical: "error",
  },
  ids: {
    mode: "prompt",
    length: 7,
    rememberUserChoice: true,
    trackHistory: true,
    assignOnRefresh: false,
  },
  index: {
    refreshTriggers: ["manual"],
    autoRefreshAfterMinutes: 10,
  },
} as const satisfies WaymarkConfig;

/** Options for resolving a full config from partial overrides. */
export type ResolveConfigOptions = {
  overrides?: PartialWaymarkConfig;
};

/** Indicates which configuration scope should be loaded. */
export type ConfigScope = "default" | "project" | "user";

/** Inputs for loading configuration from disk. */
export type LoadConfigOptions = {
  cwd?: string;
  scope?: ConfigScope;
  explicitPath?: string;
  env?: NodeJS.ProcessEnv;
};

const CONFIG_FILENAMES = [
  "config.toml", // Preferred format
  "config.jsonc",
  "config.yaml",
  "config.yml",
];

// Deep merge utility for config resolution
function deepMerge(
  target: WaymarkConfig,
  source: PartialWaymarkConfig
): WaymarkConfig {
  const result: WaymarkConfig = { ...target };

  for (const key in source) {
    if (!Object.hasOwn(source, key)) {
      continue;
    }
    const sourceValue = source[key as keyof PartialWaymarkConfig];
    const targetValue = result[key as keyof WaymarkConfig];

    if (sourceValue === undefined) {
      continue;
    }

    // Handle arrays - clone instead of merge
    if (Array.isArray(sourceValue)) {
      (result as Record<string, unknown>)[key] = [...sourceValue];
    }
    // Handle objects - recursive merge
    else if (
      typeof sourceValue === "object" &&
      sourceValue !== null &&
      typeof targetValue === "object" &&
      targetValue !== null &&
      !Array.isArray(targetValue)
    ) {
      (result as Record<string, unknown>)[key] = {
        ...targetValue,
        ...sourceValue,
      };
    }
    // Primitives - direct assignment
    else {
      (result as Record<string, unknown>)[key] = sourceValue;
    }
  }

  return result;
}

/** Merge overrides into the default configuration. */
export function resolveConfig(overrides?: PartialWaymarkConfig): WaymarkConfig {
  if (!overrides) {
    return cloneConfig(DEFAULT_CONFIG);
  }

  return deepMerge(DEFAULT_CONFIG, overrides);
}

/** Clone a config object to avoid mutation side effects. */
export function cloneConfig(config: WaymarkConfig): WaymarkConfig {
  return structuredClone(config);
}

/** Load configuration from explicit path, env path, or scoped defaults. */
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
  } else if (scope === "user") {
    overrides = await loadUserOverrides(env);
  } else {
    overrides =
      (await loadProjectOverrides(cwd)) ?? (await loadUserOverrides(env));
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

    if (ext === ".jsonc") {
      const text = stripJsonComments(raw);
      return normalizeConfigShape(JSON.parse(text));
    }

    throw new Error(
      `Unsupported config format: ${ext}. Use .toml, .jsonc, .yaml, or .yml`
    );
  } catch (error) {
    throw new Error(
      `Unable to parse config at ${filePath}: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
  }
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

async function loadUserOverrides(
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
  assignScanOptions(result, raw);
  assignFormatOptions(result, raw);
  assignLintOptions(result, raw);
  assignIdOptions(result, raw);
  assignIndexOptions(result, raw);

  return result;
}

function assignScalarOptions(
  result: Partial<WaymarkConfig>,
  raw: Record<string, unknown>
): void {
  const typeCase = readString(raw, ["typeCase", "type_case"]);
  if (typeCase === "lowercase" || typeCase === "uppercase") {
    result.typeCase = typeCase;
  }

  const idScope = readString(raw, ["idScope", "id_scope"]);
  if (idScope === "repo" || idScope === "file") {
    result.idScope = idScope;
  }

  const allowTypes = readStringArray(raw, ["allowTypes", "allow_types"]);
  if (allowTypes) {
    result.allowTypes = allowTypes.map((type) => type.toLowerCase());
  }

  const skipPaths = readStringArray(raw, ["skipPaths", "skip_paths"]);
  if (skipPaths) {
    result.skipPaths = skipPaths;
  }

  const includePaths = readStringArray(raw, ["includePaths", "include_paths"]);
  if (includePaths) {
    result.includePaths = includePaths;
  }

  const respectGitignore = readBoolean(raw, [
    "respectGitignore",
    "respect_gitignore",
  ]);
  if (typeof respectGitignore === "boolean") {
    result.respectGitignore = respectGitignore;
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

  const format: Partial<WaymarkFormatConfig> = {};
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
  const alignContinuations = readBoolean(formatRaw, [
    "alignContinuations",
    "align_continuations",
  ]);
  if (typeof alignContinuations === "boolean") {
    format.alignContinuations = alignContinuations;
  }
  if (Object.keys(format).length > 0) {
    result.format = format as WaymarkFormatConfig;
  }
}

function assignScanOptions(
  result: Partial<WaymarkConfig>,
  raw: Record<string, unknown>
): void {
  const scanRaw = readObject(raw, "scan");
  if (!scanRaw) {
    return;
  }

  const includeCodetags = readBoolean(scanRaw, [
    "includeCodetags",
    "include_codetags",
  ]);
  if (typeof includeCodetags === "boolean") {
    result.scan = {
      ...(result.scan ?? DEFAULT_CONFIG.scan),
      includeCodetags,
    };
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

  const lint: Partial<WaymarkLintConfig> = {};
  setLintLevel(lintRaw, lint, "duplicateProperty", "duplicate_property");
  setLintLevel(lintRaw, lint, "unknownMarker", "unknown_marker");
  setLintLevel(lintRaw, lint, "danglingRelation", "dangling_relation");
  setLintLevel(lintRaw, lint, "duplicateCanonical", "duplicate_canonical");
  if (Object.keys(lint).length > 0) {
    result.lint = lint as WaymarkLintConfig;
  }
}

function assignIdOptions(
  result: Partial<WaymarkConfig>,
  raw: Record<string, unknown>
): void {
  const idsRaw = readObject(raw, "ids");
  if (!idsRaw) {
    return;
  }

  const out: Partial<WaymarkConfig["ids"]> = {};

  const mode = readString(idsRaw, ["mode"]);
  if (
    mode === "auto" ||
    mode === "prompt" ||
    mode === "off" ||
    mode === "manual"
  ) {
    out.mode = mode;
  }

  const lengthValue = readNumber(idsRaw, ["length"]);
  if (
    typeof lengthValue === "number" &&
    Number.isInteger(lengthValue) &&
    lengthValue > 0
  ) {
    out.length = lengthValue;
  }

  const remember = readBoolean(idsRaw, [
    "rememberUserChoice",
    "remember_user_choice",
  ]);
  if (typeof remember === "boolean") {
    out.rememberUserChoice = remember;
  }

  const trackHistory = readBoolean(idsRaw, ["trackHistory", "track_history"]);
  if (typeof trackHistory === "boolean") {
    out.trackHistory = trackHistory;
  }

  const assignOnRefresh = readBoolean(idsRaw, [
    "assignOnRefresh",
    "assign_on_refresh",
  ]);
  if (typeof assignOnRefresh === "boolean") {
    out.assignOnRefresh = assignOnRefresh;
  }

  result.ids = {
    ...(result.ids ?? DEFAULT_CONFIG.ids),
    ...out,
  };
}

function assignIndexOptions(
  result: Partial<WaymarkConfig>,
  raw: Record<string, unknown>
): void {
  const indexRaw = readObject(raw, "index");
  if (!indexRaw) {
    return;
  }

  const out: Partial<WaymarkConfig["index"]> = {};

  const triggers = readStringArray(indexRaw, [
    "refreshTriggers",
    "refresh_triggers",
  ]);
  if (triggers) {
    out.refreshTriggers = triggers;
  }

  const minutes = readNumber(indexRaw, [
    "autoRefreshAfterMinutes",
    "auto_refresh_after_minutes",
  ]);
  if (typeof minutes === "number" && minutes >= 0) {
    out.autoRefreshAfterMinutes = minutes;
  }

  result.index = {
    ...(result.index ?? DEFAULT_CONFIG.index),
    ...out,
  };
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

function readNumber(
  source: Record<string, unknown>,
  keys: string[]
): number | undefined {
  for (const key of keys) {
    const value = source[key];
    if (typeof value === "number" && Number.isFinite(value)) {
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
  target: Partial<WaymarkLintConfig>,
  camel: keyof WaymarkLintConfig,
  snake: string
): void {
  const value = readString(source, [camel as string, snake]);
  if (value === "warn" || value === "error" || value === "ignore") {
    target[camel] = value;
  }
}
