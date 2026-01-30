// tldr ::: waymark record construction and continuation processing

import {
  analyzeContent,
  type ContentSegment,
  parseContinuation,
  processContentSegment,
} from "./content";
import { inferFileCategory, inferLanguageFromFile } from "./metadata";
import { addRelationTokens, RELATION_KIND_MAP } from "./properties";
import { normalizeLine, type ParsedHeader } from "./tokenizer";
import type { ParseOptions, WaymarkRecord } from "./types";

export type BuildRecordArgs = {
  options: ParseOptions;
  header: ParsedHeader;
  raw: string;
  contentText: string;
  startLine: number;
  endLine: number;
};

export type WaymarkContext = {
  lines: string[];
  index: number;
  options: ParseOptions;
  inWaymarkContext: boolean;
};

export type ProcessedWaymark = {
  record: WaymarkRecord;
  newIndex: number;
};

type ContinuationParams = {
  startLine: number;
  firstSegment: ContentSegment;
  rawLines: string[];
};

/**
 * Build a WaymarkRecord from parsed header and content.
 * @param args - Record construction inputs.
 * @returns Waymark record.
 */
export function buildRecord(args: BuildRecordArgs): WaymarkRecord {
  const { options, header, raw, contentText, startLine, endLine } = args;
  const file = options.file ?? "";
  const language = options.language ?? inferLanguageFromFile(file);
  const fileCategory = inferFileCategory(file, options.categoryRegistry);

  const { properties, relations, canonicals, mentions, tags } =
    analyzeContent(contentText);

  return {
    file,
    language,
    fileCategory,
    startLine,
    endLine,
    indent: header.indent,
    commentLeader: header.commentLeader,
    signals: header.signals,
    type: header.type,
    contentText: contentText.trim(),
    properties,
    relations,
    canonicals,
    mentions,
    tags,
    raw,
  };
}

/**
 * Process continuation lines that follow a waymark header.
 * @param context - Waymark parsing context.
 * @param header - Parsed header data.
 * @param params - Continuation processing params.
 * @returns Continuation content segments and metadata.
 */
export function processContinuations(
  context: WaymarkContext,
  header: ParsedHeader,
  params: ContinuationParams
): {
  contentSegments: string[];
  endLine: number;
  extraProperties: Record<string, string>;
  newIndex: number;
} {
  const { startLine, firstSegment, rawLines } = params;
  const contentSegments = [firstSegment.text];
  const extraProperties: Record<string, string> = {};
  let endLine = startLine;
  let closed = firstSegment.closes;
  let index = context.index;

  while (!closed && index + 1 < context.lines.length) {
    const nextLine = normalizeLine(context.lines[index + 1] ?? "");
    const continuation = parseContinuation(
      nextLine,
      header.commentLeader,
      context.inWaymarkContext
    );

    if (!continuation) {
      break;
    }

    index += 1;
    rawLines.push(nextLine);

    if (continuation.type === "property") {
      if (continuation.propertyKey && continuation.propertyValue) {
        extraProperties[continuation.propertyKey] = continuation.propertyValue;
      }
    } else {
      const nextSegment = processContentSegment(
        continuation.content,
        header.commentLeader
      );
      contentSegments.push(nextSegment.text);
      closed = nextSegment.closes;
    }
    endLine = index + 1;
  }

  return { contentSegments, endLine, extraProperties, newIndex: index };
}

/**
 * Merge continuation properties into a record and update relations.
 * @param record - Record to mutate.
 * @param extraProperties - Extra properties discovered in continuations.
 */
export function mergeExtraProperties(
  record: WaymarkRecord,
  extraProperties: Record<string, string>
): void {
  Object.assign(record.properties, extraProperties);

  for (const [key, value] of Object.entries(extraProperties)) {
    const relationKind = RELATION_KIND_MAP[key];
    if (relationKind) {
      addRelationTokens(record, relationKind, value);
    }
  }
}

/**
 * Process a single waymark header line into a record and updated cursor.
 * @param context - Waymark parsing context.
 * @param header - Parsed header data.
 * @param rawLine - Raw header line string.
 * @returns Processed waymark record and next index.
 */
export function processWaymarkLine(
  context: WaymarkContext,
  header: ParsedHeader,
  rawLine: string
): ProcessedWaymark {
  const startLine = context.index + 1;
  const rawLines = [rawLine];

  const firstSegment = processContentSegment(
    header.content,
    header.commentLeader
  );

  const { contentSegments, endLine, extraProperties, newIndex } =
    processContinuations(context, header, {
      startLine,
      firstSegment,
      rawLines,
    });

  const contentText = contentSegments.join("\n").trim();
  const raw = rawLines.join("\n");

  const record = buildRecord({
    options: context.options,
    header,
    raw,
    contentText,
    startLine,
    endLine,
  });

  mergeExtraProperties(record, extraProperties);

  return { record, newIndex };
}
