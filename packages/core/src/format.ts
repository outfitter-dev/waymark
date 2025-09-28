// tldr ::: formatting utilities for normalizing waymark comments

import type { ParseOptions, WaymarkRecord } from "@waymarks/grammar";
import { parse, SIGIL } from "@waymarks/grammar";

import { resolveConfig } from "./config";
import type { WaymarkConfig } from "./types";

export type FormatOptions = ParseOptions & {
  config?: Partial<WaymarkConfig>;
};

export type FormatEdit = {
  startLine: number;
  endLine: number;
  original: string;
  replacement: string;
  reason: string;
};

export type FormatResult = {
  formattedText: string;
  edits: FormatEdit[];
};

const HTML_COMMENT_LEADER = "<!--";
const SINGLE_SPACE = " ";
const NEWLINE = "\n";
const LINE_SPLIT_REGEX = /\r?\n/;

export function formatText(
  source: string,
  options: FormatOptions = {}
): FormatResult {
  const config = resolveConfig(options.config);
  const records = parse(source, options);
  const lines = source.split(LINE_SPLIT_REGEX);
  const edits: FormatEdit[] = [];

  for (const record of records) {
    if (record.startLine === record.endLine) {
      const index = record.startLine - 1;
      const originalLine = lines[index] ?? "";
      const formattedLine = formatSingleLine(record, config);

      if (!formattedLine || formattedLine === originalLine) {
        continue;
      }

      lines[index] = formattedLine;
      edits.push({
        startLine: record.startLine,
        endLine: record.endLine,
        original: originalLine,
        replacement: formattedLine,
        reason: "normalize-waymark",
      });
      continue;
    }

    const formattedBlock = formatMultiLine(record, config);
    if (!formattedBlock) {
      continue;
    }

    const startIndex = record.startLine - 1;
    const blockLength = record.endLine - record.startLine + 1;
    const originalBlock = lines.slice(startIndex, startIndex + blockLength);

    const changed = formattedBlock.some(
      (line, idx) => line !== originalBlock[idx]
    );
    if (!changed) {
      continue;
    }

    for (let offset = 0; offset < blockLength; offset += 1) {
      lines[startIndex + offset] = formattedBlock[offset] ?? "";
    }

    edits.push({
      startLine: record.startLine,
      endLine: record.endLine,
      original: originalBlock.join(NEWLINE),
      replacement: formattedBlock.join(NEWLINE),
      reason: "normalize-waymark",
    });
  }

  const formattedText = lines.join(NEWLINE);
  return { formattedText, edits };
}

function formatSingleLine(
  record: WaymarkRecord,
  config: WaymarkConfig
): string | null {
  const { commentLeader } = record;
  if (!commentLeader) {
    return null;
  }

  const indent = " ".repeat(record.indent);
  const signals = buildSignalPrefix(record);
  const marker = config.format.normalizeCase
    ? record.marker.toLowerCase()
    : record.marker;
  const markerToken = `${signals}${marker}`;

  if (!markerToken.trim()) {
    return null;
  }

  const sigil = config.format.spaceAroundSigil ? ` ${SIGIL} ` : SIGIL;
  const content = record.contentText;
  const leaderSeparator = needsSpaceAfterLeader(commentLeader)
    ? SINGLE_SPACE
    : "";
  let rendered = `${indent}${commentLeader}${leaderSeparator}${markerToken}${sigil}`;

  if (content.length > 0) {
    rendered += config.format.spaceAroundSigil ? content : `${content}`;
  } else if (!config.format.spaceAroundSigil && rendered.endsWith(SIGIL)) {
    // leave as-is when compact formatting requested without trailing content
  }

  if (commentLeader === HTML_COMMENT_LEADER) {
    rendered = appendHtmlClosure(rendered, content.length > 0);
  }

  return rendered.trimEnd();
}

function formatMultiLine(
  record: WaymarkRecord,
  config: WaymarkConfig
): string[] | null {
  const { commentLeader } = record;
  if (!commentLeader) {
    return null;
  }

  const indent = " ".repeat(record.indent);
  const leaderSeparator = needsSpaceAfterLeader(commentLeader)
    ? SINGLE_SPACE
    : "";
  const markerToken =
    buildSignalPrefix(record) + normalizeMarker(record, config);
  const sigil = config.format.spaceAroundSigil ? ` ${SIGIL} ` : SIGIL;

  const segments = record.contentText.length
    ? record.contentText.split("\n")
    : [""];

  const [firstSegment = "", ...continuations] = segments;

  const blockLines: string[] = [
    renderFirstLine({
      commentLeader,
      leaderSeparator,
      markerToken,
      sigil,
      indent,
      firstSegment,
      config,
    }),
  ];

  blockLines.push(
    ...renderContinuationLines({
      commentLeader,
      leaderSeparator,
      indent,
      continuations,
      config,
    })
  );

  if (commentLeader === HTML_COMMENT_LEADER) {
    ensureHtmlClosure({
      blockLines,
      continuations,
      firstSegment,
    });
  }

  return blockLines;
}

function normalizeMarker(record: WaymarkRecord, config: WaymarkConfig): string {
  return config.format.normalizeCase
    ? record.marker.toLowerCase()
    : record.marker;
}

function buildSignalPrefix(record: WaymarkRecord): string {
  let prefix = "";
  if (record.signals.current) {
    prefix += "*";
  }
  if (record.signals.important) {
    prefix += "!";
  }
  return prefix;
}

function needsSpaceAfterLeader(commentLeader: string): boolean {
  return commentLeader.length > 0;
}

function appendHtmlClosure(rendered: string, hasContent: boolean): string {
  if (hasContent) {
    return rendered.endsWith(SINGLE_SPACE)
      ? `${rendered}-->`
      : `${rendered.trimEnd()} -->`;
  }

  return rendered.endsWith(SINGLE_SPACE)
    ? `${rendered.trimEnd()} -->`
    : `${rendered} -->`;
}

type FirstLineRenderParams = {
  commentLeader: string;
  leaderSeparator: string;
  markerToken: string;
  sigil: string;
  indent: string;
  firstSegment: string;
  config: WaymarkConfig;
};

function renderFirstLine(params: FirstLineRenderParams): string {
  const {
    commentLeader,
    leaderSeparator,
    markerToken,
    sigil,
    indent,
    firstSegment,
    config,
  } = params;

  let rendered = `${indent}${commentLeader}${leaderSeparator}${markerToken}${sigil}`;
  if (firstSegment.length > 0) {
    rendered += config.format.spaceAroundSigil
      ? firstSegment
      : `${firstSegment}`;
  }

  return rendered.trimEnd();
}

type ContinuationRenderParams = {
  commentLeader: string;
  leaderSeparator: string;
  indent: string;
  continuations: string[];
  config: WaymarkConfig;
};

function renderContinuationLines(params: ContinuationRenderParams): string[] {
  const { commentLeader, leaderSeparator, indent, continuations, config } =
    params;
  const lastIndex = continuations.length - 1;

  return continuations.map((segment, index) => {
    let line = `${indent}${commentLeader}${leaderSeparator}...`;
    if (segment.length > 0) {
      line += ` ${segment}`;
    }

    if (index === lastIndex) {
      line += config.format.spaceAroundSigil ? ` ${SIGIL}` : SIGIL;
      if (commentLeader === HTML_COMMENT_LEADER) {
        line = appendHtmlClosure(line, segment.length > 0);
      }
    }

    return line.trimEnd();
  });
}

type EnsureHtmlClosureParams = {
  blockLines: string[];
  continuations: string[];
  firstSegment: string;
};

function ensureHtmlClosure(params: EnsureHtmlClosureParams): void {
  const { blockLines, continuations, firstSegment } = params;
  const lastIndex = blockLines.length - 1;
  const lastLine = blockLines[lastIndex] ?? "";
  const needsClosure = continuations.length === 0 || !lastLine.includes("-->");

  if (!needsClosure) {
    return;
  }

  const lastContinuationIndex = continuations.length - 1;
  const hasContent =
    continuations.length > 0
      ? (continuations[lastContinuationIndex] ?? "").length > 0
      : firstSegment.length > 0;

  const closed = appendHtmlClosure(lastLine, hasContent);
  blockLines[lastIndex] = closed.trimEnd();
}
