// tldr ::: tests for core waymark parser

import { expect, test } from "bun:test";
import { parse } from "@waymarks/grammar";
import { version } from "./index";

test("version is defined", () => {
  expect(version).toBe("1.0.0-beta.1");
});

test("parse returns empty array for non-waymark content", () => {
  const result = parse("some content");
  expect(result).toEqual([]);
});
