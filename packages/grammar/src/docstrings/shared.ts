// tldr ::: shared utilities for docstring detection

export type LineBlock = { startIndex: number; endIndex: number };

const BLOCK_START_REGEX = /^\/\*\*/;
const BLOCK_END_REGEX = /\*\/$/;

export function stripBlockDocstring(raw: string, leaderChar: string): string {
  const withoutStart = raw.replace(BLOCK_START_REGEX, "");
  const withoutEnd = withoutStart.replace(BLOCK_END_REGEX, "");
  return stripLinePrefix(withoutEnd, new RegExp(`^\\s*\\${leaderChar}\\s?`));
}

export function stripDelimitedDocstring(
  raw: string,
  delimiter: string
): string {
  if (raw.startsWith(delimiter) && raw.endsWith(delimiter)) {
    const inner = raw.slice(delimiter.length, raw.length - delimiter.length);
    return inner.trim();
  }
  return raw.trim();
}

export function stripLinePrefix(raw: string, prefix: RegExp): string {
  return raw
    .split("\n")
    .map((line) => line.replace(prefix, ""))
    .join("\n")
    .trim();
}

export function lineRangeFromMatch(
  content: string,
  raw: string,
  index: number
): { startLine: number; endLine: number } {
  const before = content.slice(0, index);
  const startLine = before.split("\n").length;
  const lineCount = raw.split("\n").length;
  return {
    startLine,
    endLine: startLine + lineCount - 1,
  };
}

export function findLineBlock(
  lines: string[],
  predicate: (line: string) => boolean
): LineBlock | null {
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    if (!(line && predicate(line))) {
      continue;
    }

    let endIndex = i;
    while (endIndex + 1 < lines.length) {
      const nextLine = lines[endIndex + 1];
      if (!(nextLine && predicate(nextLine))) {
        break;
      }
      endIndex += 1;
    }

    return { startIndex: i, endIndex };
  }

  return null;
}

export function findNextNonEmptyLine(content: string): string | null {
  const lines = content.split("\n");
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.length > 0) {
      return trimmed;
    }
  }
  return null;
}

export function findPreviousNonEmptyLine(content: string): string | null {
  const lines = content.split("\n");
  for (let i = lines.length - 1; i >= 0; i -= 1) {
    const line = lines[i];
    if (!line) {
      continue;
    }
    const trimmed = line.trim();
    if (trimmed.length > 0) {
      return trimmed;
    }
  }
  return null;
}

export function getLineStartIndex(content: string, index: number): number {
  const lastNewline = content.lastIndexOf("\n", Math.max(0, index - 1));
  return lastNewline === -1 ? 0 : lastNewline + 1;
}

export function getLinePrefix(content: string, index: number): string {
  const lineStart = getLineStartIndex(content, index);
  return content.slice(lineStart, index);
}

export function isLinePrefixAllowed(
  prefix: string,
  allowedPattern: RegExp
): boolean {
  const trimmed = prefix.trim();
  if (trimmed.length === 0) {
    return true;
  }
  return allowedPattern.test(trimmed);
}
