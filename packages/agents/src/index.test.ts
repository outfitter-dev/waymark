// tldr ::: agent toolkit tests verifying delegation to core APIs

import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { createAgentToolkit } from "./index.ts";

const SAMPLE_SOURCE = `// todo ::: implement feature
// fix ::: handle edge case
// note ::: assumes UTC timezone`;

const MALFORMED_SOURCE = `//todo:::needs spacing
// *fix ::: priority item`;

const EXPECTED_SAMPLE_RECORD_COUNT = 3;
const EXPECTED_SCANNED_RECORD_COUNT = 4;
const EXPECTED_FILE_RECORD_COUNT = 2;

describe("createAgentToolkit", () => {
  test("returns toolkit with correct version", () => {
    const toolkit = createAgentToolkit();
    expect(toolkit.agentVersion).toBe("1.0.0-beta.1");
  });

  test("accepts optional config", () => {
    const toolkit = createAgentToolkit({
      config: { typeCase: "lowercase" },
    });
    expect(toolkit.agentVersion).toBe("1.0.0-beta.1");
  });
});

describe("toolkit.parse", () => {
  test("parses valid waymarks", () => {
    const toolkit = createAgentToolkit();
    const records = toolkit.parse(SAMPLE_SOURCE);

    expect(records).toHaveLength(EXPECTED_SAMPLE_RECORD_COUNT);
    expect(records[0]?.type).toBe("todo");
    expect(records[1]?.type).toBe("fix");
    expect(records[2]?.type).toBe("note");
  });

  test("returns empty array for source without waymarks", () => {
    const toolkit = createAgentToolkit();
    const records = toolkit.parse("// just a regular comment");

    expect(records).toHaveLength(0);
  });

  test("accepts parse options", () => {
    const toolkit = createAgentToolkit();
    const records = toolkit.parse(SAMPLE_SOURCE, {
      file: "test.ts",
      language: "typescript",
    });

    expect(records).toHaveLength(EXPECTED_SAMPLE_RECORD_COUNT);
    expect(records[0]?.file).toBe("test.ts");
    expect(records[0]?.language).toBe("typescript");
  });
});

describe("toolkit.format", () => {
  test("formats malformed waymarks", () => {
    const toolkit = createAgentToolkit();
    const formatted = toolkit.format(MALFORMED_SOURCE);

    expect(formatted).toContain("// todo ::: needs spacing");
    expect(formatted).toContain("// *fix ::: priority item");
  });

  test("preserves well-formatted waymarks", () => {
    const toolkit = createAgentToolkit();
    const formatted = toolkit.format(SAMPLE_SOURCE);

    expect(formatted).toContain("// todo ::: implement feature");
    expect(formatted).toContain("// fix ::: handle edge case");
    expect(formatted).toContain("// note ::: assumes UTC timezone");
  });

  test("normalizes waymark formatting regardless of config", () => {
    const toolkit = createAgentToolkit({
      config: { typeCase: "uppercase" },
    });
    const formatted = toolkit.format("//todo:::test");

    // Format always normalizes to lowercase and adds spacing
    expect(formatted).toContain("// todo ::: test");
  });
});

describe("toolkit.scan", () => {
  let workspace: string;

  beforeEach(async () => {
    workspace = await mkdtemp(join(tmpdir(), "waymark-agents-test-"));
  });

  afterEach(async () => {
    await rm(workspace, { recursive: true, force: true });
  });

  test("scans files and returns records", async () => {
    const sourceDir = join(workspace, "src");
    await mkdir(sourceDir, { recursive: true });

    const file1 = join(sourceDir, "module1.ts");
    await writeFile(
      file1,
      `// tldr ::: module 1 summary
// todo ::: implement feature
export const x = 1;`,
      "utf8"
    );

    const file2 = join(sourceDir, "module2.ts");
    await writeFile(
      file2,
      `// tldr ::: module 2 summary
// fix ::: handle errors
export const y = 2;`,
      "utf8"
    );

    const toolkit = createAgentToolkit();
    const records = await toolkit.scan([file1, file2]);

    expect(records).toHaveLength(EXPECTED_SCANNED_RECORD_COUNT);
    expect(records.filter((r) => r.file === file1)).toHaveLength(2);
    expect(records.filter((r) => r.file === file2)).toHaveLength(2);
    expect(records.some((r) => r.type === "tldr")).toBe(true);
  });

  test("returns empty array for non-existent paths", async () => {
    const toolkit = createAgentToolkit();
    const records = await toolkit.scan([join(workspace, "nonexistent.ts")]);

    expect(records).toHaveLength(0);
  });

  test("parses all waymarks when scanning", async () => {
    const sourceDir = join(workspace, "src");
    await mkdir(sourceDir, { recursive: true });

    const file = join(sourceDir, "test.ts");
    await writeFile(
      file,
      `// tldr ::: test file
// todo ::: implement feature`,
      "utf8"
    );

    const toolkit = createAgentToolkit({
      config: { typeCase: "lowercase" },
    });
    const records = await toolkit.scan([file]);

    expect(records).toHaveLength(EXPECTED_FILE_RECORD_COUNT);
    expect(records.some((r) => r.type === "tldr")).toBe(true);
    expect(records.some((r) => r.type === "todo")).toBe(true);
  });
});

describe("toolkit exports", () => {
  test("exports agentVersion constant", async () => {
    const { agentVersion } = await import("./index.ts");
    expect(agentVersion).toBe("1.0.0-beta.1");
  });

  test("exports type definitions", async () => {
    // This test verifies that TypeScript types are exported correctly
    // by attempting to import them (compile-time check)
    const module = await import("./index.ts");
    expect(module.createAgentToolkit).toBeDefined();
  });
});
