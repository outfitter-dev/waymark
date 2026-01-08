import { describe, expect, test } from "bun:test";

import {
  __setChildRunner,
  detectInstallMethod,
  runUpdateCommand,
} from "./update";

describe("update command detection", () => {
  test("detects npm global install paths", () => {
    const detection = detectInstallMethod(
      "/usr/local/lib/node_modules/@waymarks/cli/dist/wm.js"
    );
    expect(detection.method).toBe("npm-global");
    expect(detection.binaryPath).toContain("@waymarks/cli/dist/wm.js");
  });

  test("detects workspace execution", () => {
    const detection = detectInstallMethod(
      "/Users/me/projects/waymark/packages/cli/dist/wm.js"
    );
    expect(detection.method).toBe("workspace");
  });

  test("flags unknown paths", () => {
    const detection = detectInstallMethod("/tmp/random/wm");
    expect(detection.method).toBe("unknown");
    expect(detection.reason).toBeDefined();
  });
});

describe("runUpdateCommand", () => {
  test("dry run returns command string without execution", async () => {
    const result = await runUpdateCommand({ dryRun: true });
    expect(result.exitCode).toBe(0);
    expect(result.skipped).toBe(true);
    expect(result.command).toContain("npm install -g @waymarks/cli");
    expect(result.message).toContain("Dry run");
  });
  test("executes npm install when forced", async () => {
    const calls: Array<{ command: string; args: string[] }> = [];
    __setChildRunner((command, args) => {
      calls.push({ command, args });
      return Promise.resolve(0);
    });

    const result = await runUpdateCommand({ force: true, yes: true });

    expect(result.exitCode).toBe(0);
    expect(result.skipped).toBeUndefined();
    expect(calls).toHaveLength(1);
    expect(calls[0]?.command).toBe("npm");
    expect(calls[0]?.args).toEqual(["install", "-g", "@waymarks/cli"]);

    __setChildRunner();
  });

  test("rejects unsupported update commands", async () => {
    const result = await runUpdateCommand({ command: "rm" });
    expect(result.exitCode).toBe(1);
    expect(result.skipped).toBe(true);
    expect(result.message).toContain("Unsupported update command");
  });

  test("accepts allowed update command override", async () => {
    const calls: Array<{ command: string; args: string[] }> = [];
    __setChildRunner((command, args) => {
      calls.push({ command, args });
      return Promise.resolve(0);
    });

    const result = await runUpdateCommand({
      command: "pnpm",
      force: true,
      yes: true,
    });

    expect(result.exitCode).toBe(0);
    expect(calls[0]?.command).toBe("pnpm");
    expect(calls[0]?.args).toEqual(["install", "-g", "@waymarks/cli"]);

    __setChildRunner();
  });
});
