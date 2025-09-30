// tldr ::: query operations for waymark cache including search helpers

import type { Database } from "bun:sqlite";
import type { WaymarkRecord } from "@waymarks/grammar";
import { deserializeRecord, type WaymarkRow } from "./serialization.ts";

export function findByFile(db: Database, filePath: string): WaymarkRecord[] {
  const stmt = db.prepare(`
    SELECT * FROM waymarkRecords
    WHERE filePath = ?
    ORDER BY startLine
  `);
  return (stmt.all(filePath) as WaymarkRow[]).map((row) =>
    deserializeRecord(row)
  );
}

export function findByType(db: Database, type: string): WaymarkRecord[] {
  const stmt = db.prepare(`
    SELECT * FROM waymarkRecords
    WHERE type = ?
    ORDER BY filePath, startLine
  `);
  return (stmt.all(type) as WaymarkRow[]).map((row) => deserializeRecord(row));
}

export function findByTag(db: Database, tag: string): WaymarkRecord[] {
  const stmt = db.prepare(`
    SELECT * FROM waymarkRecords
    WHERE tags LIKE ? ESCAPE '\\'
    ORDER BY filePath, startLine
  `);
  return (stmt.all(buildTagPattern(tag)) as WaymarkRow[]).map((row) =>
    deserializeRecord(row)
  );
}

export function findByMention(db: Database, mention: string): WaymarkRecord[] {
  const stmt = db.prepare(`
    SELECT * FROM waymarkRecords
    WHERE mentions LIKE ? ESCAPE '\\'
    ORDER BY filePath, startLine
  `);
  return (stmt.all(buildMentionPattern(mention)) as WaymarkRow[]).map((row) =>
    deserializeRecord(row)
  );
}

export function findByCanonical(
  db: Database,
  canonical: string
): WaymarkRecord[] {
  const stmt = db.prepare(`
    SELECT * FROM waymarkRecords
    WHERE canonicals LIKE ? ESCAPE '\\'
    ORDER BY filePath, startLine
  `);
  return (stmt.all(buildCanonicalPattern(canonical)) as WaymarkRow[]).map(
    (row) => deserializeRecord(row)
  );
}

export function searchContent(db: Database, query: string): WaymarkRecord[] {
  const stmt = db.prepare(`
    SELECT * FROM waymarkRecords
    WHERE content LIKE ? ESCAPE '\\'
    ORDER BY filePath, startLine
  `);
  return (stmt.all(buildContentPattern(query)) as WaymarkRow[]).map((row) =>
    deserializeRecord(row)
  );
}

function buildTagPattern(value: string): string {
  return buildJsonArrayPattern(value);
}

function buildMentionPattern(value: string): string {
  return buildJsonArrayPattern(value);
}

function buildCanonicalPattern(value: string): string {
  return buildJsonArrayPattern(value);
}

function buildContentPattern(value: string): string {
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return "%";
  }
  return `%${escapeForLike(trimmed)}%`;
}

function buildJsonArrayPattern(value: string): string {
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return "%";
  }
  return `%"${escapeForLike(trimmed)}"%`;
}

function escapeForLike(value: string): string {
  return value.replace(/([\\%_])/g, "\\$1");
}
