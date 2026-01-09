// tldr ::: terminal detection helpers for CLI output [[cli/terminal]]

export type TerminalInfo = {
  isTty: boolean;
  supportsColor: boolean;
  width: number;
};

const DEFAULT_TERMINAL_WIDTH = 80;

function hasNoColor(): boolean {
  return process.env.NO_COLOR !== undefined;
}

function hasForceColor(): boolean {
  return process.env.FORCE_COLOR !== undefined;
}

function isDumbTerminal(): boolean {
  return process.env.TERM === "dumb";
}

export function canPrompt(): boolean {
  return Boolean(process.stdin.isTTY && process.stdout.isTTY);
}

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

export function getTerminalInfo(): TerminalInfo {
  const isTty = Boolean(process.stdout.isTTY);
  const width = isTty
    ? (process.stdout.columns ?? DEFAULT_TERMINAL_WIDTH)
    : DEFAULT_TERMINAL_WIDTH;
  const supportsColor = shouldUseColor();
  return { isTty, supportsColor, width };
}
