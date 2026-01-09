// tldr ::: snapshot checks for CLI help output [[cli/help-snapshots]]

import { beforeAll, describe, expect, test } from "bun:test";
import { readFile } from "node:fs/promises";
import type { Command } from "commander";

let program: Command;

async function loadSnapshot(name: string): Promise<string> {
  const baseUrl = new URL("./__tests__/fixtures/help/", import.meta.url);
  return await readFile(new URL(`${name}-help.txt`, baseUrl), "utf8");
}

function normalizeHelp(output: string): string {
  return `${output.trimEnd()}\n`;
}

function requireCommand(target: string): Command {
  const command = program.commands.find((cmd) => cmd.name() === target);
  if (!command) {
    throw new Error(`Missing command: ${target}`);
  }
  return command;
}

beforeAll(async () => {
  const module = await import("./index.ts");
  program = await module.createProgram();
});

describe("help snapshots", () => {
  test("root help output is stable", async () => {
    const snapshot = await loadSnapshot("root");
    expect(normalizeHelp(program.helpInformation())).toBe(snapshot);
  });

  test("find help output is stable", async () => {
    const snapshot = await loadSnapshot("find");
    const findHelp = requireCommand("find").helpInformation();
    expect(normalizeHelp(findHelp)).toBe(snapshot);
  });

  test("config help output is stable", async () => {
    const snapshot = await loadSnapshot("config");
    const configHelp = requireCommand("config").helpInformation();
    expect(normalizeHelp(configHelp)).toBe(snapshot);
  });
});
