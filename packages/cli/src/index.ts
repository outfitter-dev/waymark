#!/usr/bin/env bun

// tldr ::: waymark CLI entrypoint bootstrap

import {
  createProgram as programCreateProgram,
  runCli as programRunCli,
  __test as programTest,
  runMain,
} from "./program.ts";

export const __test = programTest;
export const createProgram = programCreateProgram;
export const runCli = programRunCli;

if (import.meta.main) {
  runMain();
}
