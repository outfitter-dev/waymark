// tldr ::: helper to create optional CLI spinners

import ora from "ora";

import { shouldUseColor } from "./terminal.ts";

export type SpinnerHandle = {
  start: () => void;
  stop: () => void;
  succeed: (text?: string) => void;
  fail: (text?: string) => void;
};

export type SpinnerOptions = {
  enabled: boolean;
  text: string;
  noColor?: boolean;
};

const noop = (..._args: unknown[]): void => {
  return;
};

const noopSpinner: SpinnerHandle = {
  start: noop,
  stop: noop,
  succeed: noop,
  fail: noop,
};

export function createSpinner(options: SpinnerOptions): SpinnerHandle {
  if (!options.enabled) {
    return noopSpinner;
  }

  const color = shouldUseColor(options.noColor) ? "cyan" : undefined;
  const spinner = ora({
    text: options.text,
    ...(color ? { color } : {}),
    stream: process.stderr,
  });

  return spinner;
}
