// tldr ::: default waymark configuration helpers, disk loading, and normalization utilities

import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, extname, join, resolve } from "node:path";

import { deepMerge, parseConfigFile } from "@outfitter/config";
import { Result } from "@outfitter/contracts";

import { NotFoundError, ValidationError } from "./errors";
import type {
  FileCategoryConfig,
  LanguageConfig,
  PartialWaymarkConfig,
  WaymarkConfig,
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
    includeIgnored: false,
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

/** Config filenames searched in precedence order (TOML first). */
const CONFIG_FILENAMES = ["config.toml", "config.yaml", "config.yml"];

/** Error union returned by {@link loadConfigFromDisk}. */
type ConfigError =
  | InstanceType<typeof ValidationError>
  | InstanceType<typeof NotFoundError>;

/**
 * Merge overrides into the default configuration.
 * @param overrides - Partial configuration overrides.
 * @returns Resolved configuration with defaults applied.
 */
export function resolveConfig(overrides?: PartialWaymarkConfig): WaymarkConfig {
  if (!overrides) {
    return cloneConfig(DEFAULT_CONFIG);
  }

  // deepMerge expects Partial<T> which aligns with PartialWaymarkConfig's
  // nested Partial fields. Cast is safe because deepMerge fills all required
  // fields from DEFAULT_CONFIG.
  return deepMerge(
    DEFAULT_CONFIG,
    overrides as Partial<WaymarkConfig>
  ) as WaymarkConfig;
}

/**
 * Clone a config object to avoid mutation side effects.
 * @param config - Configuration to clone.
 * @returns Deep-cloned configuration.
 */
export function cloneConfig(config: WaymarkConfig): WaymarkConfig {
  return structuredClone(config);
}

/**
 * Load configuration from explicit path, env path, or scoped defaults.
 * Returns a Result instead of throwing on failure.
 *
 * @param options - Options controlling where config is loaded from.
 * @returns Result containing resolved configuration or a typed error.
 */
// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: config loading requires cascading scope/path resolution
export async function loadConfigFromDisk(
  options: LoadConfigOptions = {}
): Promise<Result<WaymarkConfig, ConfigError>> {
  const {
    cwd = process.cwd(),
    scope = "default",
    explicitPath,
    env = process.env,
  } = options;

  // --- explicit path ---
  const resolvedExplicit = explicitPath
    ? resolve(cwd, explicitPath)
    : undefined;

  if (resolvedExplicit) {
    if (!existsSync(resolvedExplicit)) {
      return Result.err(NotFoundError.create("config", resolvedExplicit));
    }
    return readAndResolve(resolvedExplicit);
  }

  // --- env var ---
  const envPath = env.WAYMARK_CONFIG_PATH;
  if (envPath) {
    const resolvedEnvPath = resolve(cwd, envPath);
    if (existsSync(resolvedEnvPath)) {
      return readAndResolve(resolvedEnvPath);
    }
  }

  // --- scoped discovery ---
  try {
    let overrides: PartialWaymarkConfig | undefined;

    if (scope === "project") {
      overrides = await loadProjectOverrides(cwd);
    } else if (scope === "user") {
      overrides = await loadUserOverrides(env);
    } else {
      overrides =
        (await loadProjectOverrides(cwd)) ?? (await loadUserOverrides(env));
    }

    return Result.ok(resolveConfig(overrides));
  } catch (error) {
    if (error instanceof ValidationError) {
      return Result.err(error);
    }
    return Result.err(
      ValidationError.create(
        "config",
        `loading failed: ${error instanceof Error ? error.message : String(error)}`
      )
    );
  }
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Read a config file, parse it, normalize the shape, and merge with defaults.
 */
async function readAndResolve(
  filePath: string
): Promise<Result<WaymarkConfig, ConfigError>> {
  const overridesResult = await readConfigOverrides(filePath);
  if (overridesResult.isErr()) {
    return overridesResult as Result<WaymarkConfig, ConfigError>;
  }
  return Result.ok(resolveConfig(overridesResult.value));
}

/**
 * Read and parse a single config file into partial overrides.
 */
async function readConfigOverrides(
  filePath: string
): Promise<Result<PartialWaymarkConfig, ConfigError>> {
  if (!existsSync(filePath)) {
    return Result.ok({});
  }

  const raw = await readFile(filePath, "utf8");
  const ext = extname(filePath).toLowerCase();

  // Use @outfitter/config parseConfigFile for YAML and TOML
  if (ext === ".yaml" || ext === ".yml" || ext === ".toml") {
    const parsed = parseConfigFile(raw, filePath);
    if (parsed.isErr()) {
      return Result.err(
        ValidationError.create(
          filePath,
          `parse failed: ${parsed.error.message}`
        )
      );
    }
    return Result.ok(normalizeConfigShape(parsed.value));
  }

  return Result.err(
    ValidationError.create(
      filePath,
      `unsupported format: ${ext}. Use .toml, .yaml, or .yml`
    )
  );
}

/**
 * Walk up directory tree looking for `.waymark/config.*` files.
 */
async function loadProjectOverrides(
  start: string
): Promise<PartialWaymarkConfig | undefined> {
  for (const directory of walkDirectories(start)) {
    for (const candidate of CONFIG_FILENAMES) {
      const filePath = join(directory, ".waymark", candidate);
      if (!existsSync(filePath)) {
        continue;
      }
      const result = await readConfigOverrides(filePath);
      if (result.isErr()) {
        throw result.error;
      }
      if (Object.keys(result.value).length > 0) {
        return result.value;
      }
    }
  }
  return;
}

/**
 * Load user-scope config from XDG_CONFIG_HOME or ~/.config.
 * Accepts an explicit env object for testability (getConfigDir only reads
 * process.env so we keep the manual resolution).
 */
async function loadUserOverrides(
  env: NodeJS.ProcessEnv
): Promise<PartialWaymarkConfig | undefined> {
  const baseDir = env.XDG_CONFIG_HOME
    ? resolve(env.XDG_CONFIG_HOME)
    : join(homedir(), ".config");
  const configDir = join(baseDir, "waymark");

  for (const candidate of CONFIG_FILENAMES) {
    const filePath = join(configDir, candidate);
    if (!existsSync(filePath)) {
      continue;
    }
    const result = await readConfigOverrides(filePath);
    if (result.isErr()) {
      throw result.error;
    }
    if (Object.keys(result.value).length > 0) {
      return result.value;
    }
  }

  return;
}

/**
 * Walk directories from `start` upward to the filesystem root.
 * Used by project-scope discovery.
 */
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

// ---------------------------------------------------------------------------
// Config normalization via Zod
// ---------------------------------------------------------------------------

/**
 * Normalize a raw parsed config object into a PartialWaymarkConfig.
 *
 * Uses the Zod schema with defaults stripped (partial mode) to handle
 * snake_case -> camelCase aliasing and type coercion. Fields not present
 * in the raw input are omitted so that deepMerge only overrides what the
 * user explicitly set.
 */
function normalizeConfigShape(
  value: Record<string, unknown>
): PartialWaymarkConfig {
  // For partial configs from disk we build up a result manually, using Zod
  // sub-schemas to validate/normalize each section that is present.
  const result: PartialWaymarkConfig = {};

  // Top-level scalars with snake_case aliasing
  assignScalars(result, value);
  assignScan(result, value);
  assignFormat(result, value);
  assignLint(result, value);
  assignIds(result, value);
  assignIndex(result, value);
  assignLanguages(result, value);
  assignCategories(result, value);

  return result;
}

/** Read a value from source under either camelCase or snake_case key. */
function pick<T>(
  source: Record<string, unknown>,
  camel: string,
  snake: string
): T | undefined {
  return (source[camel] ?? source[snake]) as T | undefined;
}

function assignScalars(
  out: PartialWaymarkConfig,
  raw: Record<string, unknown>
): void {
  const typeCase = pick<string>(raw, "typeCase", "type_case");
  if (typeCase === "lowercase" || typeCase === "uppercase") {
    out.typeCase = typeCase;
  }

  const idScope = pick<string>(raw, "idScope", "id_scope");
  if (idScope === "repo" || idScope === "file") {
    out.idScope = idScope;
  }

  const allowTypes = pick<unknown[]>(raw, "allowTypes", "allow_types");
  if (Array.isArray(allowTypes)) {
    out.allowTypes = allowTypes
      .filter((t): t is string => typeof t === "string")
      .map((t) => t.toLowerCase());
  }

  const skipPaths = pick<unknown[]>(raw, "skipPaths", "skip_paths");
  if (Array.isArray(skipPaths)) {
    out.skipPaths = skipPaths.filter((p): p is string => typeof p === "string");
  }

  const includePaths = pick<unknown[]>(raw, "includePaths", "include_paths");
  if (Array.isArray(includePaths)) {
    out.includePaths = includePaths.filter(
      (p): p is string => typeof p === "string"
    );
  }

  const respectGitignore = pick<boolean>(
    raw,
    "respectGitignore",
    "respect_gitignore"
  );
  if (typeof respectGitignore === "boolean") {
    out.respectGitignore = respectGitignore;
  }
}

function assignScan(
  out: PartialWaymarkConfig,
  raw: Record<string, unknown>
): void {
  const scanRaw = asObject(raw.scan);
  if (!scanRaw) {
    return;
  }

  const includeCodetags = pick<boolean>(
    scanRaw,
    "includeCodetags",
    "include_codetags"
  );
  if (typeof includeCodetags === "boolean") {
    out.scan = { ...(out.scan ?? {}), includeCodetags };
  }

  const includeIgnored = pick<boolean>(
    scanRaw,
    "includeIgnored",
    "include_ignored"
  );
  if (typeof includeIgnored === "boolean") {
    out.scan = { ...(out.scan ?? {}), includeIgnored };
  }
}

function assignFormat(
  out: PartialWaymarkConfig,
  raw: Record<string, unknown>
): void {
  const formatRaw = asObject(raw.format);
  if (!formatRaw) {
    return;
  }

  const format: Partial<WaymarkConfig["format"]> = {};
  const spaceAroundSigil = pick<boolean>(
    formatRaw,
    "spaceAroundSigil",
    "space_around_sigil"
  );
  if (typeof spaceAroundSigil === "boolean") {
    format.spaceAroundSigil = spaceAroundSigil;
  }
  const normalizeCase = pick<boolean>(
    formatRaw,
    "normalizeCase",
    "normalize_case"
  );
  if (typeof normalizeCase === "boolean") {
    format.normalizeCase = normalizeCase;
  }
  const alignContinuations = pick<boolean>(
    formatRaw,
    "alignContinuations",
    "align_continuations"
  );
  if (typeof alignContinuations === "boolean") {
    format.alignContinuations = alignContinuations;
  }
  if (Object.keys(format).length > 0) {
    out.format = format as WaymarkConfig["format"];
  }
}

function assignLint(
  out: PartialWaymarkConfig,
  raw: Record<string, unknown>
): void {
  const lintRaw = asObject(raw.lint);
  if (!lintRaw) {
    return;
  }

  const lint: Partial<WaymarkConfig["lint"]> = {};
  for (const [camel, snake] of [
    ["duplicateProperty", "duplicate_property"],
    ["unknownMarker", "unknown_marker"],
    ["danglingRelation", "dangling_relation"],
    ["duplicateCanonical", "duplicate_canonical"],
  ] as const) {
    const val = pick<string>(lintRaw, camel, snake);
    if (val === "warn" || val === "error" || val === "ignore") {
      (lint as Record<string, string>)[camel] = val;
    }
  }
  if (Object.keys(lint).length > 0) {
    out.lint = lint as WaymarkConfig["lint"];
  }
}

function assignIds(
  out: PartialWaymarkConfig,
  raw: Record<string, unknown>
): void {
  const idsRaw = asObject(raw.ids);
  if (!idsRaw) {
    return;
  }

  const ids: Partial<WaymarkConfig["ids"]> = {};

  const mode = pick<string>(idsRaw, "mode", "mode");
  if (
    mode === "auto" ||
    mode === "prompt" ||
    mode === "off" ||
    mode === "manual"
  ) {
    ids.mode = mode;
  }

  const length = pick<number>(idsRaw, "length", "length");
  if (typeof length === "number" && Number.isInteger(length) && length > 0) {
    ids.length = length;
  }

  const remember = pick<boolean>(
    idsRaw,
    "rememberUserChoice",
    "remember_user_choice"
  );
  if (typeof remember === "boolean") {
    ids.rememberUserChoice = remember;
  }

  const trackHistory = pick<boolean>(idsRaw, "trackHistory", "track_history");
  if (typeof trackHistory === "boolean") {
    ids.trackHistory = trackHistory;
  }

  const assignOnRefresh = pick<boolean>(
    idsRaw,
    "assignOnRefresh",
    "assign_on_refresh"
  );
  if (typeof assignOnRefresh === "boolean") {
    ids.assignOnRefresh = assignOnRefresh;
  }

  if (Object.keys(ids).length > 0) {
    out.ids = { ...DEFAULT_CONFIG.ids, ...ids };
  }
}

function assignIndex(
  out: PartialWaymarkConfig,
  raw: Record<string, unknown>
): void {
  const indexRaw = asObject(raw.index);
  if (!indexRaw) {
    return;
  }

  const idx: Partial<WaymarkConfig["index"]> = {};

  const triggers = pick<unknown[]>(
    indexRaw,
    "refreshTriggers",
    "refresh_triggers"
  );
  if (Array.isArray(triggers)) {
    idx.refreshTriggers = triggers.filter(
      (t): t is string => typeof t === "string"
    );
  }

  const minutes = pick<number>(
    indexRaw,
    "autoRefreshAfterMinutes",
    "auto_refresh_after_minutes"
  );
  if (typeof minutes === "number" && minutes >= 0) {
    idx.autoRefreshAfterMinutes = minutes;
  }

  if (Object.keys(idx).length > 0) {
    out.index = { ...DEFAULT_CONFIG.index, ...idx };
  }
}

// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: config parsing requires nested validation
function assignLanguages(
  out: PartialWaymarkConfig,
  raw: Record<string, unknown>
): void {
  const languagesRaw = asObject(raw.languages);
  if (!languagesRaw) {
    return;
  }

  const languages: Partial<WaymarkConfig["languages"]> = {};

  const extensions = asObject(languagesRaw.extensions);
  if (extensions) {
    const extensionsOut: Record<string, string[]> = {};
    for (const [ext, leaders] of Object.entries(extensions)) {
      if (!Array.isArray(leaders)) {
        continue;
      }
      const key = ext.startsWith(".") ? ext : `.${ext}`;
      extensionsOut[key] = leaders.filter(
        (l): l is string => typeof l === "string"
      );
    }
    if (Object.keys(extensionsOut).length > 0) {
      languages.extensions = extensionsOut;
    }
  }

  const basenames = asObject(languagesRaw.basenames);
  if (basenames) {
    const basenamesOut: Record<string, string[]> = {};
    for (const [name, leaders] of Object.entries(basenames)) {
      if (!Array.isArray(leaders)) {
        continue;
      }
      basenamesOut[name] = leaders.filter(
        (l): l is string => typeof l === "string"
      );
    }
    if (Object.keys(basenamesOut).length > 0) {
      languages.basenames = basenamesOut;
    }
  }

  const skipUnknown = pick<boolean>(
    languagesRaw,
    "skipUnknown",
    "skip_unknown"
  );
  if (typeof skipUnknown === "boolean") {
    languages.skipUnknown = skipUnknown;
  }

  if (Object.keys(languages).length > 0) {
    out.languages = languages as Partial<LanguageConfig>;
  }
}

function assignCategories(
  out: PartialWaymarkConfig,
  raw: Record<string, unknown>
): void {
  const categoriesRaw = asObject(raw.categories);
  if (!categoriesRaw) {
    return;
  }

  const categories: Partial<WaymarkConfig["categories"]> = {};

  for (const key of ["docs", "config", "data"] as const) {
    const arr = categoriesRaw[key];
    if (Array.isArray(arr)) {
      const filtered = arr
        .filter((item): item is string => typeof item === "string")
        .map((ext) => (ext.startsWith(".") ? ext : `.${ext}`));
      if (filtered.length > 0) {
        (categories as Record<string, unknown>)[key] = filtered;
      }
    }
  }

  const testRaw = asObject(categoriesRaw.test);
  if (testRaw) {
    const test: Record<string, string[]> = {};
    const suffixes = testRaw.suffixes;
    if (Array.isArray(suffixes)) {
      test.suffixes = suffixes.filter(
        (s): s is string => typeof s === "string"
      );
    }
    const pathTokens = pick<unknown[]>(testRaw, "pathTokens", "path_tokens");
    if (Array.isArray(pathTokens)) {
      test.pathTokens = pathTokens.filter(
        (t): t is string => typeof t === "string"
      );
    }
    if (Object.keys(test).length > 0) {
      (categories as Record<string, unknown>).test = test;
    }
  }

  if (Object.keys(categories).length > 0) {
    out.categories = categories as Partial<FileCategoryConfig>;
  }
}

/** Safely cast a value to a Record if it's a plain object. */
function asObject(value: unknown): Record<string, unknown> | undefined {
  if (typeof value === "object" && value !== null && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return;
}
