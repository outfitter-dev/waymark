// tldr ::: update command implementation for npm-based wm installs

import { spawn } from "node:child_process";
import { realpathSync } from "node:fs";
import { sep } from "node:path";

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
  exitCode: number;
  skipped?: boolean;
  message?: string;
};

type ChildRunner = (command: string, args: string[]) => Promise<number>;

let customRunner: ChildRunner | undefined;

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

export function detectInstallMethod(executablePath?: string): InstallDetection {
  let resolvedPath = "";
  try {
    resolvedPath = executablePath
      ? realpathSync(executablePath)
      : realpathSync(process.argv[1] ?? "");
  } catch (error) {
    logger.debug(
      { error },
      "Failed to resolve executable path for update detection"
    );
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

export async function runUpdateCommand(
  options: UpdateCommandOptions = {}
): Promise<UpdateCommandResult> {
  const detection = detectInstallMethod();
  const npmArgs = ["install", "-g", "@waymarks/cli"];
  const command = options.command ?? "npm";

  if (options.dryRun) {
    return {
      command: `${command} ${npmArgs.join(" ")}`,
      method: detection.method,
      exitCode: 0,
      skipped: true,
      message: `Dry run: ${command} ${npmArgs.join(" ")}`,
    };
  }

  if (detection.method !== "npm-global" && !options.force) {
    const message =
      detection.method === "workspace"
        ? "wm update currently supports npm global installs. Run with --force if you still want to execute the npm update command."
        : "Could not detect an npm global install. Re-run with --force to execute anyway.";
    return {
      command: `${command} ${npmArgs.join(" ")}`,
      method: detection.method,
      exitCode: 1,
      skipped: true,
      message,
    };
  }

  if (!options.yes) {
    const confirmed = await confirm({
      message: `Run ${command} ${npmArgs.join(" ")} to update wm?`,
      default: true,
    });

    if (!confirmed) {
      return {
        command: `${command} ${npmArgs.join(" ")}`,
        method: detection.method,
        exitCode: 0,
        skipped: true,
        message: "Update cancelled by user",
      };
    }
  }

  logger.info(
    {
      command,
      args: npmArgs,
      cwd: process.cwd(),
      method: detection.method,
      location: detection.binaryPath,
    },
    "Executing wm update via npm"
  );

  try {
    const exitCode = await runChild(command, npmArgs);
    return {
      command: `${command} ${npmArgs.join(" ")}`,
      method: detection.method,
      exitCode,
    };
  } catch (error) {
    logger.error({ error }, "wm update failed to launch npm command");
    return {
      command: `${command} ${npmArgs.join(" ")}`,
      method: detection.method,
      exitCode: 1,
      message:
        error instanceof Error
          ? error.message
          : "Failed to execute npm install",
    };
  }
}
