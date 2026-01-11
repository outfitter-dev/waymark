// tldr ::: tests for the wm skill command output paths [[cli/skill-test]]

import { describe, expect, test } from "bun:test";
import { fileURLToPath } from "node:url";
import {
  runSkillCommand,
  runSkillListCommand,
  runSkillPathCommand,
  runSkillShowCommand,
} from "./skill.ts";
import { runCli } from "../program.ts";

const skillDir = fileURLToPath(
  new URL("../../../agents/skills/waymark-cli", import.meta.url)
);

describe("skill command", () => {
  test("prints core skill markdown by default", async () => {
    const result = await runSkillCommand({}, { skillDir });
    expect(result.exitCode).toBe(0);
    expect(result.output).toContain("# Waymark CLI Skill");
  });

  test("prints command documentation via show", async () => {
    const result = await runSkillShowCommand("add", {}, { skillDir });
    expect(result.output).toContain("# wm add");
  });

  test("prints example documentation via show", async () => {
    const result = await runSkillShowCommand("workflows", {}, { skillDir });
    expect(result.output).toContain("# Workflows");
  });

  test("lists commands, references, and examples", async () => {
    const result = await runSkillListCommand({ skillDir });
    expect(result.output).toContain("Commands:");
    expect(result.output).toContain("add");
    expect(result.output).toContain("References:");
    expect(result.output).toContain("schemas");
    expect(result.output).toContain("Examples:");
    expect(result.output).toContain("workflows");
  });

  test("outputs structured JSON when --json is set", async () => {
    const result = await runSkillCommand({ json: true }, { skillDir });
    const parsed = JSON.parse(result.output) as {
      sections: { core: { content: string } };
    };
    expect(parsed.sections.core.content).toContain("# Waymark CLI Skill");
  });

  test("outputs structured JSON for show", async () => {
    const result = await runSkillShowCommand(
      "add",
      { json: true },
      { skillDir }
    );
    const parsed = JSON.parse(result.output) as {
      kind: string;
      content: string;
    };
    expect(parsed.kind).toBe("command");
    expect(parsed.content).toContain("# wm add");
  });

  test("supports --json for skill show via CLI parsing", async () => {
    const result = await runCli(["skill", "show", "add", "--json"]);
    expect(result.exitCode).toBe(0);
    const parsed = JSON.parse(result.stdout.trim()) as {
      kind: string;
      name: string;
    };
    expect(parsed.kind).toBe("command");
    expect(parsed.name).toBe("add");
  });

  test("unknown sections throw usage errors", async () => {
    await expect(
      runSkillShowCommand("missing-section", {}, { skillDir })
    ).rejects.toThrow("Unknown skill section");
  });

  test("prints skill directory path", () => {
    const result = runSkillPathCommand({ skillDir });
    expect(result.output).toBe(skillDir);
  });
});
