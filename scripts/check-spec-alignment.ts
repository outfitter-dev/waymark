#!/usr/bin/env bun
// tldr ::: validate schema enums and patterns stay aligned with runtime constants #scripts/spec

import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { RELATION_KIND_MAP } from "../packages/grammar/src/properties";

const EXPECTED_MENTION_PATTERN = "^@[a-z][A-Za-z0-9/_-]*$";

type JsonRecord = Record<string, unknown>;

function asRecord(value: unknown): JsonRecord | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  return value as JsonRecord;
}

function readEnum(root: unknown, path: string[]): string[] | null {
  let current: unknown = root;
  for (const segment of path) {
    const record = asRecord(current);
    if (!record) {
      return null;
    }
    current = record[segment];
  }

  if (
    Array.isArray(current) &&
    current.every((item) => typeof item === "string")
  ) {
    return current;
  }

  return null;
}

function readString(root: unknown, path: string[]): string | null {
  let current: unknown = root;
  for (const segment of path) {
    const record = asRecord(current);
    if (!record) {
      return null;
    }
    current = record[segment];
  }

  return typeof current === "string" ? current : null;
}

function normalize(values: string[]): string[] {
  return Array.from(new Set(values)).sort();
}

function arraysEqual(left: string[], right: string[]): boolean {
  if (left.length !== right.length) {
    return false;
  }
  for (let index = 0; index < left.length; index += 1) {
    if (left[index] !== right[index]) {
      return false;
    }
  }
  return true;
}

const rootDir = dirname(dirname(fileURLToPath(import.meta.url)));
const schemaPath = join(rootDir, "schemas", "waymark-record.schema.json");
const schemaText = await readFile(schemaPath, "utf8");
const schema = JSON.parse(schemaText) as JsonRecord;

const errors: string[] = [];

const schemaRelationKinds = readEnum(schema, [
  "properties",
  "relations",
  "items",
  "properties",
  "kind",
  "enum",
]);
if (schemaRelationKinds) {
  const runtimeKinds = normalize(Object.values(RELATION_KIND_MAP));
  const schemaKinds = normalize(schemaRelationKinds);
  if (!arraysEqual(schemaKinds, runtimeKinds)) {
    errors.push(
      `Relation kind enum mismatch. schema=[${schemaKinds.join(
        ", "
      )}] runtime=[${runtimeKinds.join(", ")}].`
    );
  }
} else {
  errors.push("Missing relation kind enum in waymark-record.schema.json.");
}

const schemaMentionPattern = readString(schema, [
  "properties",
  "mentions",
  "items",
  "pattern",
]);
if (!schemaMentionPattern) {
  errors.push("Missing mention pattern in waymark-record.schema.json.");
} else if (schemaMentionPattern !== EXPECTED_MENTION_PATTERN) {
  errors.push(
    `Mention pattern mismatch. schema=${schemaMentionPattern} expected=${EXPECTED_MENTION_PATTERN}.`
  );
}

if (errors.length > 0) {
  console.error("Spec alignment check failed:");
  for (const error of errors) {
    console.error(`- ${error}`);
  }
  process.exit(1);
}

console.log("Spec alignment check passed.");
