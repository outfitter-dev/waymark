// tldr ::: waymark record serialization and deserialization helpers

import type { WaymarkRecord } from "@waymarks/grammar";

export type WaymarkRow = {
  filePath: string;
  startLine: number;
  endLine: number;
  type: string;
  content: string;
  language: string;
  fileCategory: string;
  indent: number;
  commentLeader?: string | null;
  raw?: string | null;
  signals?: string | null;
  properties?: string | null;
  relations?: string | null;
  canonicals?: string | null;
  mentions?: string | null;
  tags?: string | null;
};

export function deserializeRecord(row: WaymarkRow): WaymarkRecord {
  return {
    file: row.filePath,
    startLine: row.startLine,
    endLine: row.endLine,
    type: row.type,
    contentText: row.content,
    signals: parseSignals(row.signals),
    properties: parseProperties(row.properties),
    relations: parseRelations(row.relations),
    canonicals: parseStringArray(row.canonicals),
    mentions: parseStringArray(row.mentions),
    tags: parseStringArray(row.tags),
    language: row.language,
    fileCategory: row.fileCategory as WaymarkRecord["fileCategory"],
    indent: row.indent,
    commentLeader: row.commentLeader ?? null,
    raw: row.raw ?? "",
  };
}

function parseSignals(
  source: string | null | undefined
): WaymarkRecord["signals"] {
  const parsed = safeParse<Record<string, unknown>>(source, {});
  let flaggedValue = false;
  if (parsed.flagged !== undefined) {
    flaggedValue = Boolean(parsed.flagged);
  } else if (parsed.raised !== undefined) {
    flaggedValue = Boolean(parsed.raised);
  } else if (parsed.current !== undefined) {
    flaggedValue = Boolean(parsed.current);
  }

  const currentValue =
    parsed.current !== undefined ? Boolean(parsed.current) : flaggedValue;
  return {
    flagged: flaggedValue,
    current: currentValue,
    starred:
      parsed.starred === undefined
        ? parsed.important === undefined
          ? false
          : Boolean(parsed.important)
        : Boolean(parsed.starred),
  };
}

function parseProperties(
  source: string | null | undefined
): WaymarkRecord["properties"] {
  const parsed = safeParse<Record<string, unknown>>(source, {});
  const result: Record<string, string> = {};
  for (const [key, value] of Object.entries(parsed)) {
    if (typeof value === "string") {
      result[key] = value;
    } else if (value !== undefined && value !== null) {
      result[key] = String(value);
    }
  }
  return result;
}

function parseRelations(
  source: string | null | undefined
): WaymarkRecord["relations"] {
  const parsed = safeParse<Partial<WaymarkRecord["relations"][number]>[]>(
    source,
    []
  );
  return parsed
    .filter(
      (relation): relation is WaymarkRecord["relations"][number] =>
        typeof relation?.kind === "string" &&
        typeof relation?.token === "string"
    )
    .map((relation) => ({
      kind: relation.kind,
      token: relation.token,
    }));
}

function parseStringArray(source: string | null | undefined): string[] {
  const parsed = safeParse<unknown[]>(source, []);
  return parsed.filter((value): value is string => typeof value === "string");
}

function safeParse<T>(source: string | null | undefined, fallback: T): T {
  if (!source) {
    return fallback;
  }

  try {
    return JSON.parse(source) as T;
  } catch {
    return fallback;
  }
}
