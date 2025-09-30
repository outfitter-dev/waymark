// tldr ::: formatting utilities for normalizing waymark comments

import type { ParseOptions, WaymarkRecord } from "@waymarks/grammar";
import { parse, SIGIL } from "@waymarks/grammar";

import { resolveConfig } from "./config";
import type { PartialWaymarkConfig, WaymarkConfig } from "./types";

export type FormatOptions = ParseOptions & {
  config?: PartialWaymarkConfig;
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

// Known property keys that can act as pseudo-markers in continuation context
const PROPERTY_KEYS = new Set([
  "ref",
  "rel",
  "depends",
  "needs",
  "blocks",
  "dupeof",
  "owner",
  "since",
  "fixes",
  "affects",
  "priority",
  "status",
]);

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
  const type = config.format.normalizeCase
    ? record.type.toLowerCase()
    : record.type;
  const markerToken = `${signals}${type}`;

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
  const markerToken = buildSignalPrefix(record) + normalizeType(record, config);
  const sigil = config.format.spaceAroundSigil ? ` ${SIGIL} ` : SIGIL;

  const segments = record.contentText.length
    ? record.contentText.split("\n")
    : [""];

  const [firstSegment = "", ...continuations] = segments;

  // Calculate alignment position for continuations
  const alignContinuations = config.format.alignContinuations ?? true;
  const sigilPosition = alignContinuations
    ? calculateSigilPosition({
        indent,
        commentLeader,
        leaderSeparator,
        markerToken,
        config,
      })
    : 0;

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

  // Add text continuations
  blockLines.push(
    ...renderContinuationLines({
      commentLeader,
      leaderSeparator,
      indent,
      continuations,
      config,
      sigilPosition,
    })
  );

  // Add property continuations from record.properties
  blockLines.push(
    ...renderPropertyContinuations({
      commentLeader,
      leaderSeparator,
      indent,
      properties: record.properties,
      config,
      sigilPosition,
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

function normalizeType(record: WaymarkRecord, config: WaymarkConfig): string {
  return config.format.normalizeCase ? record.type.toLowerCase() : record.type;
}

function buildSignalPrefix(record: WaymarkRecord): string {
  let prefix = "";
  if (record.signals.raised) {
    prefix += "^";
  }
  if (record.signals.important) {
    prefix += "*";
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
  sigilPosition: number;
};

function renderContinuationLines(params: ContinuationRenderParams): string[] {
  const {
    commentLeader,
    leaderSeparator,
    indent,
    continuations,
    config,
    sigilPosition,
  } = params;
  const lastIndex = continuations.length - 1;
  const alignContinuations = config.format.alignContinuations ?? true;

  return continuations.map((segment, index) => {
    // Build the base line with comment leader
    const base = `${indent}${commentLeader}${leaderSeparator}`;

    // Calculate alignment padding
    let alignment = "";
    if (alignContinuations && sigilPosition > base.length) {
      alignment = " ".repeat(sigilPosition - base.length);
    }

    // Build the continuation line with markerless :::
    let line = `${base}${alignment}${SIGIL}`;

    if (segment.length > 0) {
      line += config.format.spaceAroundSigil ? ` ${segment}` : segment;
    }

    // Handle explicit closing on last line
    const isLast = index === lastIndex;
    if (
      isLast &&
      segment.endsWith(` ${SIGIL}`) &&
      commentLeader === HTML_COMMENT_LEADER &&
      !line.includes("-->")
    ) {
      // Already has closing, don't add another
      line = appendHtmlClosure(line, segment.length > 0);
    }

    return line.trimEnd();
  });
}

type PropertyContinuationParams = {
  commentLeader: string;
  leaderSeparator: string;
  indent: string;
  properties: Record<string, string>;
  config: WaymarkConfig;
  sigilPosition: number;
};

function renderPropertyContinuations(
  params: PropertyContinuationParams
): string[] {
  const {
    commentLeader,
    leaderSeparator,
    indent,
    properties,
    config,
    sigilPosition,
  } = params;
  const lines: string[] = [];
  const alignContinuations = config.format.alignContinuations ?? true;

  for (const [key, value] of Object.entries(properties)) {
    // Only render known properties as continuation lines
    if (!PROPERTY_KEYS.has(key)) {
      continue;
    }

    // Build the base line with comment leader and property key
    const base = `${indent}${commentLeader}${leaderSeparator}`;

    // For property continuations, the property key comes before :::
    // But we need to align the ::: position
    let line = "";
    if (alignContinuations && sigilPosition > 0) {
      // Calculate padding needed before the property key
      const keyLength = key.length;
      const targetPosition = sigilPosition - keyLength - 1; // -1 for space before :::
      if (targetPosition > base.length) {
        const padding = " ".repeat(targetPosition - base.length);
        line = `${base}${padding}${key} ${SIGIL}`;
      } else {
        // Can't align properly, just place normally
        line = `${base}${key} ${SIGIL}`;
      }
    } else {
      line = `${base}${key} ${SIGIL}`;
    }

    if (value.length > 0) {
      line += config.format.spaceAroundSigil ? ` ${value}` : value;
    }

    lines.push(line.trimEnd());
  }

  return lines;
}

type SigilPositionParams = {
  indent: string;
  commentLeader: string;
  leaderSeparator: string;
  markerToken: string;
  config: WaymarkConfig;
};

function calculateSigilPosition(params: SigilPositionParams): number {
  const { indent, commentLeader, leaderSeparator, markerToken, config } =
    params;

  // Calculate where the ::: starts in the first line
  const baseLength =
    indent.length + commentLeader.length + leaderSeparator.length;
  const markerLength = markerToken.length;
  const spaceBeforeSigil = config.format.spaceAroundSigil ? 1 : 0;

  return baseLength + markerLength + spaceBeforeSigil;
}

type EnsureHtmlClosureParams = {
  blockLines: string[];
  continuations: string[];
  firstSegment: string;
};

function ensureHtmlClosure(params: EnsureHtmlClosureParams): void {
  const { blockLines } = params;

  // For HTML comments, each line needs to be properly closed with -->
  for (let i = 0; i < blockLines.length; i++) {
    const line = blockLines[i] ?? "";

    // Skip if line already has closure
    if (line.includes("-->")) {
      continue;
    }

    // Add closure to lines that need it
    const hasContent = line.includes(":::");
    const closed = appendHtmlClosure(line, hasContent);
    blockLines[i] = closed.trimEnd();
  }
}
