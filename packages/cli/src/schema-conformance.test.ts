// tldr ::: validate CLI JSON outputs against published JSON schemas

import { describe, test } from "bun:test";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { resolveConfig } from "@waymarks/core";
import Ajv from "ajv/dist/2020";
import addFormats from "ajv-formats";
import { runDoctorCommand } from "./commands/doctor";
import { lintFiles } from "./commands/lint";
import { scanRecords } from "./commands/scan";
import type { CommandContext } from "./types";
import { renderRecords } from "./utils/output";

type JsonRecord = Record<string, unknown>;

type TempFile = {
  dir: string;
  file: string;
  cleanup: () => Promise<void>;
};

const rootDir = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const schemasDir = join(rootDir, "schemas");

async function loadSchema(name: string): Promise<JsonRecord> {
  const raw = await readFile(join(schemasDir, name), "utf8");
  return JSON.parse(raw) as JsonRecord;
}

async function createValidator(): Promise<Ajv> {
  const ajv = new Ajv({ allErrors: true, strict: false });
  addFormats(ajv);

  const schemas = await Promise.all([
    loadSchema("waymark-record.schema.json"),
    loadSchema("waymark-scan-result.schema.json"),
    loadSchema("lint-report.schema.json"),
    loadSchema("doctor-report.schema.json"),
  ]);

  for (const schema of schemas) {
    ajv.addSchema(schema);
  }

  return ajv;
}

function assertValid(ajv: Ajv, schemaId: string, payload: unknown): void {
  const validate = ajv.getSchema(schemaId);
  if (!validate) {
    throw new Error(`Schema not registered: ${schemaId}`);
  }
  const valid = validate(payload);
  if (!valid) {
    throw new Error(
      `${schemaId} validation failed: ${ajv.errorsText(validate.errors)}`
    );
  }
}

async function withTempFile(content: string): Promise<TempFile> {
  const dir = await mkdtemp(join(tmpdir(), "waymark-schema-"));
  const file = join(dir, "sample.ts");
  await writeFile(file, content, "utf8");
  return {
    dir,
    file,
    cleanup: () => rm(dir, { recursive: true, force: true }),
  };
}

describe("Schema conformance", () => {
  test("scan output matches scan-result schema", async () => {
    const { file, cleanup } = await withTempFile("// todo ::: schema check\n");
    const config = resolveConfig();
    const records = await scanRecords([file], config);
    const output = renderRecords(records, "json");
    const parsed = JSON.parse(output) as unknown;
    const ajv = await createValidator();
    assertValid(
      ajv,
      "https://outfitter.dev/schemas/waymark-scan-result.schema.json",
      parsed
    );
    await cleanup();
  });

  test("lint report matches lint-report schema", async () => {
    const { file, cleanup } = await withTempFile("// unknown ::: lint me\n");
    const config = resolveConfig();
    const report = await lintFiles([file], config.allowTypes, config);
    const ajv = await createValidator();
    assertValid(
      ajv,
      "https://outfitter.dev/schemas/lint-report.schema.json",
      report
    );
    await cleanup();
  });

  test("doctor report matches doctor-report schema", async () => {
    const { dir, cleanup } = await withTempFile("// todo ::: doctor check\n");
    const config = resolveConfig();
    const context: CommandContext = {
      config,
      globalOptions: {},
      workspaceRoot: dir,
    };
    const report = await runDoctorCommand(context, { json: true });
    const ajv = await createValidator();
    assertValid(
      ajv,
      "https://outfitter.dev/schemas/doctor-report.schema.json",
      report
    );
    await cleanup();
  });
});
