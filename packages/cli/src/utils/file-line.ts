// tldr ::: shared parser for FILE:LINE inputs

export type FileLineTarget = {
  file: string;
  line: number;
};

type FileLineParseMessages = {
  missingSeparator: string;
  invalidLine: string;
};

/**
 * Parse a FILE:LINE token into structured data.
 * @param value - Input string containing file and line.
 * @param messages - Error messages for invalid input.
 * @returns Parsed file and line target.
 */
export function parseFileLineTarget(
  value: string,
  messages: FileLineParseMessages
): FileLineTarget {
  const colonIndex = value.lastIndexOf(":");
  if (colonIndex === -1) {
    throw new Error(messages.missingSeparator);
  }
  const file = value.slice(0, colonIndex).trim();
  const lineValue = value.slice(colonIndex + 1).trim();
  const line = Number.parseInt(lineValue, 10);
  if (!(file && Number.isFinite(line)) || line <= 0) {
    throw new Error(messages.invalidLine);
  }
  return { file, line };
}
