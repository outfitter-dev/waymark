#!/usr/bin/env bun

// tldr ::: waymark CLI entrypoint bootstrap

import {
  createProgram as programCreateProgram,
  runCli as programRunCli,
  __test as programTest,
  runMain,
} from "./program.ts";

/** @internal */
export const __test = programTest;
/** Build a Commander program with all CLI commands registered. */
export const createProgram = programCreateProgram;
/** Run the CLI with a custom argv array, capturing stdout/stderr. Returns exit code and captured output. */
export const runCli = programRunCli;

if (import.meta.main) {
  runMain();
}
