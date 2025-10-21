// tldr ::: tests for waymark grammar constants and property keys contract

import { describe, expect, test } from "bun:test";
import { PROPERTY_KEYS } from "./constants";

describe("PROPERTY_KEYS contract", () => {
  test("maintains expected set of property keys", () => {
    // This test enforces the contract for PROPERTY_KEYS as the single source of truth.
    // Any additions or removals should be intentional and require updating this test.
    const expectedKeys = [
      "ref",
      "rel",
      "depends",
      "needs",
      "blocks",
      "dupeof",
      "owner",
      "since",
      "fixes",
      "affects",
      "priority",
      "status",
    ].sort();

    expect(Array.from(PROPERTY_KEYS).sort()).toEqual(expectedKeys);
  });
});
