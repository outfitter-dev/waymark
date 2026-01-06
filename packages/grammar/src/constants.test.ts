// tldr ::: tests for waymark grammar constants and property keys contract

import { describe, expect, test } from "bun:test";
import {
  BLESSED_MARKERS,
  getCanonicalType,
  MARKER_DEFINITIONS,
  PROPERTY_KEYS,
} from "./constants";

describe("MARKER_DEFINITIONS contract", () => {
  test("includes 'about' marker for section summaries", () => {
    // about ::: section/block summary marker (replaces legacy 'this')
    const aboutDef = MARKER_DEFINITIONS.find((def) => def.name === "about");
    expect(aboutDef).toBeDefined();
    expect(aboutDef?.category).toBe("info");
    expect(aboutDef?.description).toBe("Section/block summary");
  });

  test("'about' is included in BLESSED_MARKERS", () => {
    expect(BLESSED_MARKERS).toContain("about");
  });

  test("getCanonicalType returns 'about' for 'about'", () => {
    expect(getCanonicalType("about")).toBe("about");
    expect(getCanonicalType("ABOUT")).toBe("about");
  });
});

describe("PROPERTY_KEYS contract", () => {
  test("maintains expected set of property keys", () => {
    // This test enforces the contract for PROPERTY_KEYS as the single source of truth.
    // Any additions or removals should be intentional and require updating this test.
    const expectedKeys = [
      // Relation keys
      "see",
      "docs",
      "from",
      "replaces",
      // Other property keys
      "owner",
      "since",
      "fixes",
      "affects",
      "priority",
      "status",
      "sym",
    ].sort();

    expect(Array.from(PROPERTY_KEYS).sort()).toEqual(expectedKeys);
  });
});
