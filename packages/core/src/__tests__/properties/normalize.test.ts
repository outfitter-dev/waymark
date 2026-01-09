// tldr ::: property-based checks for core normalization helpers

import { describe, expect, it } from "bun:test";
import fc from "fast-check";
import {
  normalizeCanonicals,
  normalizeMentions,
  normalizeTags,
  normalizeType,
} from "../../normalize.ts";

const STRING_ARBITRARY = fc.string({ maxLength: 48 });
const STRING_ARRAY_ARBITRARY = fc.array(STRING_ARBITRARY, { maxLength: 24 });

function isSorted(values: string[]): boolean {
  for (let index = 1; index < values.length; index += 1) {
    const previous = values[index - 1] ?? "";
    const current = values[index] ?? "";
    if (previous.localeCompare(current) > 0) {
      return false;
    }
  }
  return true;
}

describe("normalize (property-based)", () => {
  it("normalizeTags is idempotent, unique, and sorted", () => {
    fc.assert(
      fc.property(STRING_ARRAY_ARBITRARY, (tags) => {
        const once = normalizeTags(tags);
        const twice = normalizeTags(once);

        expect(twice).toEqual(once);
        expect(new Set(once).size).toBe(once.length);
        expect(isSorted(once)).toBe(true);
        for (const tag of once) {
          expect(tag).toBe(tag.trim().toLowerCase());
        }
      }),
      { numRuns: 75 }
    );
  });

  it("normalizeCanonicals is idempotent and canonicalizes tokens", () => {
    fc.assert(
      fc.property(STRING_ARRAY_ARBITRARY, (tokens) => {
        const once = normalizeCanonicals(tokens);
        const twice = normalizeCanonicals(once);

        expect(twice).toEqual(once);
        expect(new Set(once).size).toBe(once.length);
        expect(isSorted(once)).toBe(true);
        for (const token of once) {
          if (token.length === 0) {
            expect(token).toBe("");
            continue;
          }
          expect(token.startsWith("#")).toBe(true);
          expect(token).toBe(token.trim().toLowerCase());
        }
      }),
      { numRuns: 75 }
    );
  });

  it("normalizeMentions is idempotent and trims whitespace", () => {
    fc.assert(
      fc.property(STRING_ARRAY_ARBITRARY, (mentions) => {
        const once = normalizeMentions(mentions);
        const twice = normalizeMentions(once);

        expect(twice).toEqual(once);
        expect(new Set(once).size).toBe(once.length);
        expect(isSorted(once)).toBe(true);
        for (const mention of once) {
          expect(mention).toBe(mention.trim());
        }
      }),
      { numRuns: 75 }
    );
  });

  it("normalizeType is idempotent for any string", () => {
    fc.assert(
      fc.property(STRING_ARBITRARY, (input) => {
        const once = normalizeType(input);
        const twice = normalizeType(once);
        expect(twice).toBe(once);
      }),
      { numRuns: 75 }
    );
  });
});
