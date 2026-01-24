// tldr ::: docstring detection and summary extraction utilities

export type DocstringKind = "file" | "function";
export type DocstringFormat = "jsdoc" | "python" | "ruby" | "rust";

export type DocstringInfo = {
  language: string;
  kind: DocstringKind;
  format: DocstringFormat;
  raw: string;
  content: string;
  startLine: number;
  endLine: number;
};

const JS_LANGUAGES = new Set(["javascript", "typescript", "js", "ts"]);
const PYTHON_LANGUAGES = new Set(["python", "py"]);
const RUBY_LANGUAGES = new Set(["ruby", "rb"]);
const RUST_LANGUAGES = new Set(["rust", "rs"]);

const JS_ITEM_REGEX =
  /^(export\s+)?(default\s+)?(async\s+)?(function|class|interface|type|enum|const|let|var)\b/;
const PYTHON_OWNER_REGEX = /^\s*(def|class)\b/;
const RUBY_OWNER_REGEX = /^\s*(def|class|module)\b/;
const RUST_OWNER_REGEX = /^\s*(fn|struct|enum|impl|trait|mod)\b/;

export function detectDocstring(
  content: string,
  language: string
): DocstringInfo | null {
  const normalized = language.toLowerCase();
  if (JS_LANGUAGES.has(normalized)) {
    return detectJsDocstring(content, normalized);
  }
  if (PYTHON_LANGUAGES.has(normalized)) {
    return detectPythonDocstring(content, normalized);
  }
  if (RUBY_LANGUAGES.has(normalized)) {
    return detectRubyDocstring(content, normalized);
  }
  if (RUST_LANGUAGES.has(normalized)) {
    return detectRustDocstring(content, normalized);
  }
  return null;
}

export function extractSummary(docstring: DocstringInfo): string {
  const lines = docstring.content
    .split("\n")
    .map((line) => line.trim());

  const summaryLines: string[] = [];
  let started = false;

  for (const line of lines) {
    if (!started && line.length === 0) {
      continue;
    }

    if (line.length === 0) {
      break;
    }

    if (line.startsWith("@")) {
      break;
    }

    started = true;
    summaryLines.push(line);
  }

  return summaryLines.join(" ").trim();
}

function detectJsDocstring(
  content: string,
  language: string
): DocstringInfo | null {
  const regex = /\/\*\*[\s\S]*?\*\//g;
  const match = regex.exec(content);
  if (!match) {
    return null;
  }

  const raw = match[0];
  const index = match.index;
  const { startLine, endLine } = lineRangeFromMatch(content, raw, index);
  const contentText = stripBlockDocstring(raw, "*");
  const kind = classifyByPlacement(content, index, index + raw.length, JS_ITEM_REGEX);

  return {
    language,
    kind,
    format: "jsdoc",
    raw,
    content: contentText,
    startLine,
    endLine,
  };
}

function detectPythonDocstring(
  content: string,
  language: string
): DocstringInfo | null {
  const regex = /"""[\s\S]*?"""/g;
  const match = regex.exec(content);
  if (!match) {
    return null;
  }

  const raw = match[0];
  const index = match.index;
  const { startLine, endLine } = lineRangeFromMatch(content, raw, index);
  const contentText = stripDelimitedDocstring(raw, '"""');
  const kind = classifyPythonPlacement(content, index, index + raw.length);

  return {
    language,
    kind,
    format: "python",
    raw,
    content: contentText,
    startLine,
    endLine,
  };
}

function detectRubyDocstring(
  content: string,
  language: string
): DocstringInfo | null {
  const lines = content.split("\n");
  const block = findLineBlock(lines, (line) => {
    const trimmed = line.trimStart();
    return trimmed.startsWith("#") && !trimmed.startsWith("#!");
  });
  if (!block) {
    return null;
  }

  const { startIndex, endIndex } = block;
  const raw = lines.slice(startIndex, endIndex + 1).join("\n");
  const contentText = stripLinePrefix(raw, /^\s*#\s?/);
  const kind = classifyLineBlockPlacement(lines, block, RUBY_OWNER_REGEX);

  return {
    language,
    kind,
    format: "ruby",
    raw,
    content: contentText,
    startLine: startIndex + 1,
    endLine: endIndex + 1,
  };
}

function detectRustDocstring(
  content: string,
  language: string
): DocstringInfo | null {
  const lines = content.split("\n");
  const block = findLineBlock(lines, (line) => line.trimStart().startsWith("///"));
  if (!block) {
    return null;
  }

  const { startIndex, endIndex } = block;
  const raw = lines.slice(startIndex, endIndex + 1).join("\n");
  const contentText = stripLinePrefix(raw, /^\s*\/\/\/\s?/);
  const kind = classifyLineBlockPlacement(lines, block, RUST_OWNER_REGEX);

  return {
    language,
    kind,
    format: "rust",
    raw,
    content: contentText,
    startLine: startIndex + 1,
    endLine: endIndex + 1,
  };
}

function stripBlockDocstring(raw: string, leaderChar: string): string {
  const withoutStart = raw.replace(/^\/\*\*/, "");
  const withoutEnd = withoutStart.replace(/\*\/$/, "");
  return stripLinePrefix(withoutEnd, new RegExp(`^\\s*\\${leaderChar}\\s?`));
}

function stripDelimitedDocstring(raw: string, delimiter: string): string {
  if (raw.startsWith(delimiter) && raw.endsWith(delimiter)) {
    const inner = raw.slice(delimiter.length, raw.length - delimiter.length);
    return inner.trim();
  }
  return raw.trim();
}

function stripLinePrefix(raw: string, prefix: RegExp): string {
  return raw
    .split("\n")
    .map((line) => line.replace(prefix, ""))
    .join("\n")
    .trim();
}

function lineRangeFromMatch(content: string, raw: string, index: number): {
  startLine: number;
  endLine: number;
} {
  const before = content.slice(0, index);
  const startLine = before.split("\n").length;
  const lineCount = raw.split("\n").length;
  return {
    startLine,
    endLine: startLine + lineCount - 1,
  };
}

function classifyByPlacement(
  content: string,
  startIndex: number,
  endIndex: number,
  ownerRegex: RegExp
): DocstringKind {
  const before = content.slice(0, startIndex);
  if (before.trim().length === 0) {
    return "file";
  }

  const nextLine = findNextNonEmptyLine(content.slice(endIndex));
  if (nextLine && ownerRegex.test(nextLine)) {
    return "function";
  }

  return "function";
}

function classifyPythonPlacement(
  content: string,
  startIndex: number,
  endIndex: number
): DocstringKind {
  const before = content.slice(0, startIndex);
  if (isPythonPreambleOnly(before)) {
    return "file";
  }

  const previousLine = findPreviousNonEmptyLine(before);
  if (previousLine && PYTHON_OWNER_REGEX.test(previousLine)) {
    return "function";
  }

  const nextLine = findNextNonEmptyLine(content.slice(endIndex));
  if (nextLine && PYTHON_OWNER_REGEX.test(nextLine)) {
    return "function";
  }

  return "function";
}

function classifyLineBlockPlacement(
  lines: string[],
  block: { startIndex: number; endIndex: number },
  ownerRegex: RegExp
): DocstringKind {
  const beforeLines = lines.slice(0, block.startIndex);
  const preambleOnly = beforeLines.every((line) => {
    const trimmed = line.trim();
    return (
      trimmed.length === 0 ||
      trimmed.startsWith("#!") ||
      trimmed.startsWith("#")
    );
  });

  if (preambleOnly) {
    return "file";
  }

  const nextLine = findNextNonEmptyLine(
    lines.slice(block.endIndex + 1).join("\n")
  );
  if (nextLine && ownerRegex.test(nextLine)) {
    return "function";
  }

  return "function";
}

function findLineBlock(
  lines: string[],
  predicate: (line: string) => boolean
): { startIndex: number; endIndex: number } | null {
  for (let i = 0; i < lines.length; i += 1) {
    if (!predicate(lines[i])) {
      continue;
    }

    let endIndex = i;
    while (endIndex + 1 < lines.length && predicate(lines[endIndex + 1])) {
      endIndex += 1;
    }

    return { startIndex: i, endIndex };
  }

  return null;
}

function findNextNonEmptyLine(content: string): string | null {
  const lines = content.split("\n");
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.length > 0) {
      return trimmed;
    }
  }
  return null;
}

function findPreviousNonEmptyLine(content: string): string | null {
  const lines = content.split("\n");
  for (let i = lines.length - 1; i >= 0; i -= 1) {
    const trimmed = lines[i].trim();
    if (trimmed.length > 0) {
      return trimmed;
    }
  }
  return null;
}

function isPythonPreambleOnly(content: string): boolean {
  const lines = content.split("\n");
  return lines.every((line) => {
    const trimmed = line.trim();
    if (trimmed.length === 0) {
      return true;
    }
    if (trimmed.startsWith("#!")) {
      return true;
    }
    if (trimmed.startsWith("#") && trimmed.includes("coding")) {
      return true;
    }
    return false;
  });
}
