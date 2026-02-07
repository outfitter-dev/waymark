// tldr ::: terminal detection helpers for CLI output [[cli/terminal]]

function hasNoColor(): boolean {
  return process.env.NO_COLOR !== undefined;
}

function hasForceColor(): boolean {
  return process.env.FORCE_COLOR !== undefined;
}

function isDumbTerminal(): boolean {
  return process.env.TERM === "dumb";
}

/**
 * Determine whether interactive prompts can be shown.
 * @returns True if stdin and stdout are TTYs.
 */
export function canPrompt(): boolean {
  return Boolean(process.stdin.isTTY && process.stdout.isTTY);
}

/**
 * Determine whether colored output should be used.
 * @param noColorFlag - Flag indicating color should be disabled.
 * @returns True if color should be enabled.
 */
export function shouldUseColor(noColorFlag?: boolean): boolean {
  if (noColorFlag) {
    return false;
  }
  if (hasNoColor()) {
    return false;
  }
  if (hasForceColor()) {
    return true;
  }
  if (!process.stdout.isTTY) {
    return false;
  }
  if (isDumbTerminal()) {
    return false;
  }
  return true;
}
