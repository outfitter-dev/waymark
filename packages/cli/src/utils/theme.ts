// tldr ::: shared visual theme for waymark CLI output

import { ANSI } from "@outfitter/cli/colors";
import { supportsColor } from "@outfitter/cli/terminal";

let colorEnabled = supportsColor();

/**
 * Set whether color output is enabled.
 * Called by the CLI when --no-color flag is used.
 * @param enabled - Whether to enable color output.
 */
export function setColorEnabled(enabled: boolean): void {
  colorEnabled = enabled;
}

/**
 * Check if color output is currently enabled.
 * @returns True if colors should be applied.
 */
export function isColorEnabled(): boolean {
  return colorEnabled;
}

/**
 * Wrap text with ANSI escape codes, respecting color state.
 * Returns plain text when colors are disabled.
 * @param text - The text to wrap.
 * @param codes - ANSI escape codes to prepend.
 * @returns Wrapped or plain text.
 */
export function wrap(text: string, ...codes: string[]): string {
  if (!colorEnabled || codes.length === 0) {
    return text;
  }
  return codes.join("") + text + ANSI.reset;
}
