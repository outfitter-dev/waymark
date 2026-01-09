#!/usr/bin/env bun

// tldr ::: waymark CLI entrypoint bootstrap

import {
  __test as programTest,
  createProgram as programCreateProgram,
  runCli as programRunCli,
  runMain,
} from "./program.ts";

export const __test = programTest;
export const createProgram = programCreateProgram;
export const runCli = programRunCli;

if (import.meta.main) {
  runMain();
}
