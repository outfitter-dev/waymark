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
/** Build the CLI program with all commands registered. */
export const createProgram = programCreateProgram;
/** Run the CLI with the provided argv array. */
export const runCli = programRunCli;

if (import.meta.main) {
  runMain();
}
