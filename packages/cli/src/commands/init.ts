// tldr ::: init command for bootstrapping waymark config files

import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join, resolve } from "node:path";
import { promptSelect } from "@outfitter/cli/prompt";
import { InternalError, Result } from "@outfitter/contracts";
import { CliError } from "../errors.ts";
import { ExitCode } from "../exit-codes.ts";
import { logger } from "../utils/logger.ts";
import { assertPromptAllowed } from "../utils/prompts.ts";

type ConfigFormat = "yaml" | "yml";
type ConfigPreset = "full" | "minimal";
type ConfigScope = "project" | "user";

export type InitCommandOptions = {
  format?: string;
  preset?: string;
  scope?: string;
  force?: boolean;
};

const CONFIG_FORMATS: ConfigFormat[] = ["yaml", "yml"];
const CONFIG_PRESETS: ConfigPreset[] = ["full", "minimal"];
const CONFIG_SCOPES: ConfigScope[] = ["project", "user"];

/**
 * Execute the `wm init` command to generate configuration files.
 * @param options - CLI options for format, preset, and scope.
 * @returns Result wrapping void on success.
 */
export function runInitCommand(
  options: InitCommandOptions = {}
): Promise<Result<void, InternalError>> {
  return Result.tryPromise({
    try: () => runInitCommandInner(options),
    catch: (cause) =>
      new InternalError({
        message: `Init failed: ${cause instanceof Error ? cause.message : String(cause)}`,
      }),
  });
}

// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: sequential prompt branching for interactive init
async function runInitCommandInner(
  options: InitCommandOptions = {}
): Promise<void> {
  let format: ConfigFormat;
  let preset: ConfigPreset;
  let scope: ConfigScope;
  let force: boolean;

  // Interactive mode if no options provided
  const hasOptions =
    options.format || options.preset || options.scope || options.force;

  if (hasOptions) {
    // Validate and set defaults from flags
    format = validateFormat(options.format ?? "yaml");
    preset = validatePreset(options.preset ?? "full");
    scope = validateScope(options.scope ?? "project");
    force = options.force ?? false;
  } else {
    assertPromptAllowed("configuration selection");

    const formatResult = await promptSelect<ConfigFormat>({
      message: "Choose config format:",
      options: CONFIG_FORMATS.map((f) => ({ value: f, label: f })),
      initialValue: "yaml" as ConfigFormat,
    });
    if (formatResult.isErr()) {
      throw new CliError("Init cancelled", ExitCode.usageError);
    }
    format = formatResult.value;

    const presetResult = await promptSelect<ConfigPreset>({
      message: "Choose config preset:",
      options: CONFIG_PRESETS.map((p) => ({ value: p, label: p })),
      initialValue: "full" as ConfigPreset,
    });
    if (presetResult.isErr()) {
      throw new CliError("Init cancelled", ExitCode.usageError);
    }
    preset = presetResult.value;

    const scopeResult = await promptSelect<ConfigScope>({
      message: "Choose config scope:",
      options: CONFIG_SCOPES.map((s) => ({ value: s, label: s })),
      initialValue: "project" as ConfigScope,
    });
    if (scopeResult.isErr()) {
      throw new CliError("Init cancelled", ExitCode.usageError);
    }
    scope = scopeResult.value;

    force = false;
  }

  // Determine config path
  const configPath = getConfigPath(scope, format);

  // Check if config already exists
  if (existsSync(configPath) && !force) {
    throw new Error(
      `Config already exists at ${configPath}\nUse --force to overwrite`
    );
  }

  // Ensure directory exists
  const configDir = resolve(configPath, "..");
  if (!existsSync(configDir)) {
    await mkdir(configDir, { recursive: true });
  }

  // Generate config content
  const content = generateConfig(format, preset);

  // Write config file
  await writeFile(configPath, content, "utf8");

  // Update .gitignore for project scope
  if (scope === "project") {
    await updateGitignore();
  }

  // Print success message
  logger.info(`✓ Created ${configPath}`);

  // Print next steps
  if (scope === "project") {
    logger.info("\nNext steps:");
    logger.info(`  - Review and customize .waymark/config.${format}`);
    logger.info("  - Run 'wm' to see waymarks in your project");
  }
}

function validateFormat(format: string): ConfigFormat {
  if (!CONFIG_FORMATS.includes(format as ConfigFormat)) {
    throw new Error(
      `Invalid format "${format}". Use one of: ${CONFIG_FORMATS.join(", ")}`
    );
  }
  return format as ConfigFormat;
}

function validatePreset(preset: string): ConfigPreset {
  if (!CONFIG_PRESETS.includes(preset as ConfigPreset)) {
    throw new Error(
      `Invalid preset "${preset}". Use one of: ${CONFIG_PRESETS.join(", ")}`
    );
  }
  return preset as ConfigPreset;
}

function validateScope(scope: string): ConfigScope {
  if (!CONFIG_SCOPES.includes(scope as ConfigScope)) {
    throw new Error(
      `Invalid scope "${scope}". Use one of: ${CONFIG_SCOPES.join(", ")}`
    );
  }
  return scope as ConfigScope;
}

function getConfigPath(scope: ConfigScope, format: ConfigFormat): string {
  if (scope === "project") {
    return join(process.cwd(), ".waymark", `config.${format}`);
  }

  // User scope - use XDG_CONFIG_HOME or fallback
  const baseDir = process.env.XDG_CONFIG_HOME
    ? resolve(process.env.XDG_CONFIG_HOME)
    : join(homedir(), ".config");
  return join(baseDir, "waymark", `config.${format}`);
}

function generateConfig(_format: ConfigFormat, preset: ConfigPreset): string {
  return generateYamlConfig(preset);
}

function generateYamlConfig(preset: ConfigPreset): string {
  if (preset === "minimal") {
    return `# Waymark configuration

type_case: lowercase
`;
  }

  return `# Waymark configuration
# For full documentation, see: https://github.com/outfitter-dev/waymark

# Type case normalization (lowercase | uppercase)
type_case: lowercase

# Canonical reference scope (repo | file)
id_scope: repo

# Custom waymark types to allow (in addition to blessed types)
allow_types: []

# Paths to skip during scanning (glob patterns)
skip_paths:
  - "**/.git/**"
  - "**/node_modules/**"
  - "**/dist/**"
  - "**/build/**"
  - "**/.turbo/**"
  - "**/fixtures/**"
  - "**/__fixtures__/**"
  - "**/test-data/**"
  - "**/*.fixture.*"
  - "**/*.invalid.*"

# Paths to explicitly include (overrides skip_paths)
include_paths: []

# Respect .gitignore files
respect_gitignore: true

# Formatting options
format:
  space_around_sigil: true
  normalize_case: true
  align_continuations: true

# Linting rules
lint:
  duplicate_property: warn   # Duplicate property keys
  unknown_marker: warn        # Unknown waymark types
  dangling_relation: error    # Relations without canonical refs
  duplicate_canonical: error  # Duplicate canonical declarations
`;
}

async function updateGitignore(): Promise<void> {
  const gitignorePath = join(process.cwd(), ".gitignore");

  // Read existing .gitignore or create empty
  let content = "";
  if (existsSync(gitignorePath)) {
    content = await readFile(gitignorePath, "utf8");
  }

  // Check if waymark index.json entry already exists
  const hasWaymarkIndex = content.includes(".waymark/index.json");

  if (hasWaymarkIndex) {
    return; // Already configured
  }

  // Append to .gitignore
  const newContent =
    content +
    (content.endsWith("\n") ? "" : "\n") +
    "\n# Waymark index file (regenerated from source)\n" +
    ".waymark/index.json\n";

  await writeFile(gitignorePath, newContent, "utf8");
}
