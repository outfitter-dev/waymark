import { describe, expect, it } from "bun:test";
import { findTldrInsertionPoint } from "./tldr.ts";

const JS_INSERT_LINE = 4;
const PYTHON_INSERT_LINE = 3;
const RUST_INSERT_LINE = 2;
const GO_INSERT_LINE = 4;
const RUBY_INSERT_LINE = 3;
const MARKDOWN_INSERT_LINE = 4;

describe("findTldrInsertionPoint", () => {
  it("skips shebangs and JS directives", () => {
    const content = [
      "#!/usr/bin/env node",
      '/// <reference types="node" />',
      '"use strict";',
      "console.log('hello');",
    ].join("\n");

    expect(findTldrInsertionPoint(content, "javascript")).toBe(JS_INSERT_LINE);
  });

  it("returns -1 when an existing TLDR is present", () => {
    const content = ["// tldr ::: service container", "export {}"].join("\n");

    expect(findTldrInsertionPoint(content, "typescript")).toBe(-1);
  });

  it("skips Python shebang and encoding comment", () => {
    const content = [
      "#!/usr/bin/env python3",
      "# -*- coding: utf-8 -*-",
      "print('hi')",
    ].join("\n");

    expect(findTldrInsertionPoint(content, "python")).toBe(PYTHON_INSERT_LINE);
  });

  it("skips Rust inner attributes", () => {
    const content = ["#![allow(dead_code)]", "fn main() {}"].join("\n");

    expect(findTldrInsertionPoint(content, "rust")).toBe(RUST_INSERT_LINE);
  });

  it("skips Go build tags and blank line", () => {
    const content = [
      "//go:build linux",
      "// +build linux",
      "",
      "package main",
    ].join("\n");

    expect(findTldrInsertionPoint(content, "go")).toBe(GO_INSERT_LINE);
  });

  it("skips Ruby magic comments", () => {
    const content = [
      "#!/usr/bin/env ruby",
      "# frozen_string_literal: true",
      "puts 'hi'",
    ].join("\n");

    expect(findTldrInsertionPoint(content, "ruby")).toBe(RUBY_INSERT_LINE);
  });

  it("skips front matter blocks", () => {
    const content = ["---", "title: Sample", "---", "", "# Heading"].join("\n");

    expect(findTldrInsertionPoint(content, "markdown")).toBe(
      MARKDOWN_INSERT_LINE
    );
  });

  it("returns -1 for unterminated front matter", () => {
    const content = ["---", "title: Sample", "# Heading"].join("\n");

    expect(findTldrInsertionPoint(content, "markdown")).toBe(-1);
  });

  it("returns -1 for unsupported languages", () => {
    const content = "console.log('hi');";

    expect(findTldrInsertionPoint(content, "unknown")).toBe(-1);
  });
});
