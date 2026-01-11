// tldr ::: extract YAML frontmatter while preserving markdown preambles [[cli/skill-frontmatter]]

export type FrontmatterExtraction = {
  frontmatter?: string;
  body: string;
};

function normalizeLineEndings(value: string): string {
  return value.replace(/\r\n/g, "\n");
}

function consumeCommentBlock(
  lines: string[],
  startIndex: number
): { collected: string[]; nextIndex: number } {
  const collected: string[] = [];
  let index = startIndex;

  while (index < lines.length) {
    const line = lines[index] ?? "";
    collected.push(line);
    index += 1;
    if (line.includes("-->")) {
      break;
    }
  }

  return { collected, nextIndex: index };
}

function consumePreamble(lines: string[]): {
  preamble: string[];
  index: number;
} {
  const preamble: string[] = [];
  let index = 0;

  while (index < lines.length) {
    const line = lines[index] ?? "";
    const trimmed = line.trim();
    if (trimmed.length === 0) {
      preamble.push(line);
      index += 1;
      continue;
    }
    if (trimmed.startsWith("<!--")) {
      const { collected, nextIndex } = consumeCommentBlock(lines, index);
      preamble.push(...collected);
      index = nextIndex;
      continue;
    }
    break;
  }

  return { preamble, index };
}

function readFrontmatter(
  lines: string[],
  startIndex: number
): { frontmatter: string[]; nextIndex: number; closed: boolean } {
  if ((lines[startIndex] ?? "").trim() !== "---") {
    return { frontmatter: [], nextIndex: startIndex, closed: false };
  }

  const frontmatter: string[] = [];
  let index = startIndex + 1;

  while (index < lines.length && (lines[index] ?? "").trim() !== "---") {
    frontmatter.push(lines[index] ?? "");
    index += 1;
  }

  if (index >= lines.length) {
    return { frontmatter: [], nextIndex: startIndex, closed: false };
  }

  return { frontmatter, nextIndex: index + 1, closed: true };
}

export function extractFrontmatter(raw: string): FrontmatterExtraction {
  const normalized = normalizeLineEndings(raw);
  const lines = normalized.split("\n");
  const { preamble, index } = consumePreamble(lines);
  const { frontmatter, nextIndex, closed } = readFrontmatter(lines, index);

  if (!closed) {
    return { body: normalized };
  }

  const bodyLines = [...preamble, ...lines.slice(nextIndex)];
  return {
    frontmatter: frontmatter.join("\n").trimEnd(),
    body: bodyLines.join("\n").trimStart(),
  };
}
