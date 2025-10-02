// tldr ::: utilities for stripping comment markers from waymark raw text

// Regex patterns for stripping different comment styles
const SLASH_COMMENT_PATTERN = /^.*?\/\/\s*/;
const HASH_COMMENT_PATTERN = /^.*?#\s*/;
const HTML_COMMENT_START_PATTERN = /^.*?<!--\s*/;
const HTML_COMMENT_END_PATTERN = /\s*-->.*$/;
const BLOCK_COMMENT_START_PATTERN = /^.*?\/\*\s*/;
const BLOCK_COMMENT_END_PATTERN = /\s*\*\/.*$/;
const SQL_COMMENT_PATTERN = /^.*?--\s*/;

/**
 * Strip comment markers from a waymark's raw text
 * Extracts just the waymark content without the comment syntax
 */
export function stripCommentMarkers(
  raw: string,
  commentLeader: string | null
): string {
  if (!commentLeader) {
    return raw.trim();
  }

  // Handle different comment styles
  if (commentLeader === "//") {
    // Single-line // comments
    return raw.replace(SLASH_COMMENT_PATTERN, "").trim();
  }

  if (commentLeader === "#") {
    // Shell/Python/Ruby style comments
    // Also handles YAML: `key: value # comment`
    return raw.replace(HASH_COMMENT_PATTERN, "").trim();
  }

  if (commentLeader === "<!--") {
    // HTML/XML comments
    return raw
      .replace(HTML_COMMENT_START_PATTERN, "")
      .replace(HTML_COMMENT_END_PATTERN, "")
      .trim();
  }

  if (commentLeader === "/*") {
    // Block comments
    return raw
      .replace(BLOCK_COMMENT_START_PATTERN, "")
      .replace(BLOCK_COMMENT_END_PATTERN, "")
      .trim();
  }

  if (commentLeader === "--") {
    // SQL comments
    return raw.replace(SQL_COMMENT_PATTERN, "").trim();
  }

  // Fallback: just trim
  return raw.trim();
}

/**
 * Strip comment markers from multi-line waymark content
 */
export function stripCommentMarkersMultiLine(
  lines: string[],
  commentLeader: string | null
): string[] {
  return lines.map((line) => stripCommentMarkers(line, commentLeader));
}
