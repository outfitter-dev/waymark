// tldr ::: write operations for waymark cache including batch inserts

import type { Database } from "bun:sqlite";
import type { WaymarkRecord } from "@waymarks/grammar";
import { updateFileInfo } from "./files.ts";

export function insertWaymarks(db: Database, records: WaymarkRecord[]): void {
  if (records.length === 0) {
    return;
  }

  const transaction = db.transaction((items: WaymarkRecord[]) => {
    insertWaymarksUnsafe(db, items);
  });

  transaction(records);
}

export function insertWaymarksBatch(
  db: Database,
  recordsByFile: Map<string, WaymarkRecord[]>
): void {
  const allRecords: WaymarkRecord[] = [];
  for (const records of recordsByFile.values()) {
    allRecords.push(...records);
  }

  if (allRecords.length === 0) {
    return;
  }

  const transaction = db.transaction(() => {
    insertWaymarksUnsafe(db, allRecords);
  });

  transaction();
}

export function replaceFileWaymarks(
  db: Database,
  args: {
    filePath: string;
    mtime: number;
    size: number;
    hash?: string | null;
    records: WaymarkRecord[];
  }
): void {
  const { filePath, mtime, size, hash, records } = args;
  const transaction = db.transaction(() => {
    deleteFileInternal(db, filePath);
    updateFileInfo(db, filePath, mtime, size, hash);
    if (records.length > 0) {
      insertWaymarksUnsafe(db, records);
    }
  });

  transaction();
}

export function deleteFile(db: Database, filePath: string): void {
  const transaction = db.transaction(() => {
    deleteFileInternal(db, filePath);
  });

  transaction();
}

function insertWaymarksUnsafe(db: Database, records: WaymarkRecord[]): void {
  if (records.length === 0) {
    return;
  }

  const insertWaymark = db.prepare(`
    INSERT OR REPLACE INTO waymarkRecords (
      filePath, startLine, endLine, type, content,
      language, fileCategory, indent, commentLeader, raw,
      signals, properties, relations, canonicals, mentions, tags
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  // Batch insert with prepared statement reuse for performance
  const values = records.map((record) => [
    record.file,
    record.startLine,
    record.endLine,
    record.type,
    record.contentText,
    record.language,
    record.fileCategory,
    record.indent,
    record.commentLeader ?? null,
    record.raw,
    JSON.stringify(record.signals),
    JSON.stringify(record.properties),
    JSON.stringify(record.relations),
    JSON.stringify(record.canonicals),
    JSON.stringify(record.mentions),
    JSON.stringify(record.tags),
  ]);

  // Execute all inserts in a single transaction
  for (const row of values) {
    insertWaymark.run(...row);
  }
}

function deleteFileInternal(db: Database, filePath: string): void {
  const deleteWaymarks = db.prepare(`
    DELETE FROM waymarkRecords WHERE filePath = ?
  `);
  deleteWaymarks.run(filePath);

  const deleteFileRow = db.prepare(`
    DELETE FROM files WHERE path = ?
  `);
  deleteFileRow.run(filePath);
}
