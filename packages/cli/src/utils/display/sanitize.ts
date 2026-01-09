// tldr ::: sanitize control characters from CLI output [[cli/sanitize-output]]

const CONTROL_CHAR_PATTERN = "[\\u0000-\\u001F\\u007F]";
const CONTROL_CHAR_REGEX = new RegExp(CONTROL_CHAR_PATTERN, "g");

export function sanitizeInlineText(value: string): string {
  return value.replace(CONTROL_CHAR_REGEX, "");
}
