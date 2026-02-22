// tldr ::: update command implementation for npm-based wm installs

import { spawn } from "node:child_process";
import { realpathSync } from "node:fs";
import { sep } from "node:path";

import { type AnyKitError, InternalError, Result } from "@outfitter/contracts";
import { logger } from "../utils/logger.ts";
import { confirm } from "../utils/prompts.ts";

export type InstallMethod = "npm-global" | "workspace" | "unknown";

export type InstallDetection = {
  method: InstallMethod;
  binaryPath: string;
  reason?: string;
};

export type UpdateCommandOptions = {
  dryRun?: boolean;
  force?: boolean;
  yes?: boolean;
  command?: string;
};

export type UpdateCommandResult = {
  command: string;
  method: InstallMethod;
  skipped?: boolean;
  message?: string;
};

type ChildRunner = (command: string, args: string[]) => Promise<number>;

let customRunner: ChildRunner | undefined;

const NPM_UPDATE_ARGS = ["install", "-g", "@waymarks/cli"];
const UPDATE_COMMAND_ALLOWLIST = new Set(["npm", "pnpm", "bun", "yarn"]);

/**
 * Inject a custom child-process runner for tests.
 * @param fn - Optional runner override.
 */
export function __setChildRunner(fn?: ChildRunner): void {
  customRunner = fn;
}

function runChild(command: string, args: string[]): Promise<number> {
  if (customRunner) {
    return customRunner(command, args);
  }
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: "inherit",
      env: process.env,
    });

    child.on("error", (error) => {
      reject(error);
    });

    child.on("close", (code) => {
      resolve(code ?? 0);
    });
  });
}

/**
 * Detect how the CLI was installed based on the executable path.
 * @param executablePath - Optional path override for detection.
 * @returns Detected install method metadata.
 */
export function detectInstallMethod(executablePath?: string): InstallDetection {
  let resolvedPath = "";
  try {
    resolvedPath = executablePath
      ? realpathSync(executablePath)
      : realpathSync(process.argv[1] ?? "");
  } catch (error) {
    logger.debug("Failed to resolve executable path for update detection", {
      error,
    });
    resolvedPath = executablePath ?? "";
  }

  if (
    resolvedPath.includes(`${sep}node_modules${sep}@waymarks${sep}cli${sep}`)
  ) {
    return {
      method: "npm-global",
      binaryPath: resolvedPath,
    };
  }

  // Workspace / development execution (bun --bun src/index.ts or ./dist/wm.js)
  if (
    resolvedPath.includes(`${sep}packages${sep}cli${sep}dist${sep}`) ||
    resolvedPath.includes(`${sep}packages${sep}cli${sep}src${sep}`)
  ) {
    return {
      method: "workspace",
      binaryPath: resolvedPath,
      reason: "CLI is running from the local workspace",
    };
  }

  return {
    method: "unknown",
    binaryPath: resolvedPath,
    reason: "Install method could not be detected",
  };
}

type CommandResolution = {
  command: string;
  commandString: string;
  error?: string;
};

function resolveUpdateCommand(commandOverride?: string): CommandResolution {
  const trimmed = commandOverride?.trim();
  if (commandOverride && !trimmed) {
    return {
      command: "npm",
      commandString: `npm ${NPM_UPDATE_ARGS.join(" ")}`,
      error: "Update command cannot be empty.",
    };
  }

  const command = (trimmed ?? "npm").toLowerCase();
  return {
    command,
    commandString: `${command} ${NPM_UPDATE_ARGS.join(" ")}`,
  };
}

function validateUpdateCommandOverride(
  command: string,
  commandOverride?: string
): string | undefined {
  if (!commandOverride) {
    return;
  }

  if (!UPDATE_COMMAND_ALLOWLIST.has(command)) {
    return `Unsupported update command "${commandOverride}". Allowed: ${Array.from(UPDATE_COMMAND_ALLOWLIST).join(", ")}`;
  }
}

function buildSkippedResult(
  detection: InstallDetection,
  commandString: string,
  message: string
): UpdateCommandResult {
  return {
    command: commandString,
    method: detection.method,
    skipped: true,
    message,
  };
}

function getInstallGuardMessage(
  detection: InstallDetection,
  force?: boolean
): string | undefined {
  if (detection.method === "npm-global" || force) {
    return;
  }

  return detection.method === "workspace"
    ? "wm update currently supports npm global installs. Run with --force if you still want to execute the npm update command."
    : "Could not detect an npm global install. Re-run with --force to execute anyway.";
}

async function confirmUpdateCommand(
  detection: InstallDetection,
  commandString: string,
  yes?: boolean
): Promise<UpdateCommandResult | undefined> {
  if (yes) {
    return;
  }

  const confirmed = await confirm({
    message: `Run ${commandString} to update wm?`,
    default: true,
  });

  if (confirmed) {
    return;
  }

  return buildSkippedResult(
    detection,
    commandString,
    "Update cancelled by user"
  );
}

/**
 * Execute the `wm update` command with the provided options.
 * @param options - Update command options.
 * @returns Result metadata wrapped in a Result.
 */
export function runUpdateCommand(
  options: UpdateCommandOptions = {}
): Promise<Result<UpdateCommandResult, AnyKitError>> {
  return Result.tryPromise({
    try: () => runUpdateCommandInner(options),
    catch: (cause) => {
      if (cause instanceof Error && "category" in cause) {
        return cause as AnyKitError;
      }
      return InternalError.create(
        `Update failed: ${cause instanceof Error ? cause.message : String(cause)}`
      );
    },
  });
}

async function runUpdateCommandInner(
  options: UpdateCommandOptions
): Promise<UpdateCommandResult> {
  const detection = detectInstallMethod();
  const resolution = resolveUpdateCommand(options.command);
  if (resolution.error) {
    return buildSkippedResult(detection, "", resolution.error);
  }

  const { command, commandString } = resolution;
  const overrideError = validateUpdateCommandOverride(command, options.command);
  if (overrideError) {
    return buildSkippedResult(detection, commandString, overrideError);
  }

  if (options.command && command !== "npm") {
    logger.warn("Using custom update command for wm update", { command });
  }

  if (options.dryRun) {
    return buildSkippedResult(
      detection,
      commandString,
      `Dry run: ${commandString}`
    );
  }

  const installGuardMessage = getInstallGuardMessage(detection, options.force);
  if (installGuardMessage) {
    return buildSkippedResult(detection, commandString, installGuardMessage);
  }

  const confirmationResult = await confirmUpdateCommand(
    detection,
    commandString,
    options.yes
  );
  if (confirmationResult) {
    return confirmationResult;
  }

  logger.info("Executing wm update via npm", {
    command,
    args: NPM_UPDATE_ARGS,
    cwd: process.cwd(),
    method: detection.method,
    location: detection.binaryPath,
  });

  const childExitCode = await runChild(command, NPM_UPDATE_ARGS);
  if (childExitCode !== 0) {
    throw InternalError.create(`npm install exited with code ${childExitCode}`);
  }

  return {
    command: commandString,
    method: detection.method,
  };
}
