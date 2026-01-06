// tldr ::: tests for natural language query parser

import { describe, expect, test } from "bun:test";
import { parseQuery } from "./query-parser";

describe("Query Parser", () => {
  test("parses simple type query", () => {
    const result = parseQuery("todo");
    expect(result.types).toEqual(["todo"]);
    expect(result.mentions).toEqual([]);
    expect(result.tags).toEqual([]);
    expect(result.textTerms).toEqual([]);
  });

  test("parses type with mention", () => {
    const result = parseQuery("todo @agent");
    expect(result.types).toEqual(["todo"]);
    expect(result.mentions).toEqual(["@agent"]);
  });

  test("parses type with tag", () => {
    const result = parseQuery("fix #perf");
    expect(result.types).toEqual(["fix"]);
    expect(result.tags).toEqual(["#perf"]);
  });

  test("parses complex query with all token types", () => {
    const result = parseQuery("todo @agent #perf:hotpath");
    expect(result.types).toEqual(["todo"]);
    expect(result.mentions).toEqual(["@agent"]);
    expect(result.tags).toEqual(["#perf:hotpath"]);
  });

  test("handles property with value", () => {
    const result = parseQuery("owner:@alice");
    expect(result.properties.get("owner")).toBe("@alice");
  });

  test("handles property without value", () => {
    const result = parseQuery("from:");
    expect(result.properties.get("from")).toBe(true);
  });

  test("handles exclusion of type", () => {
    const result = parseQuery("@agent !todo");
    expect(result.mentions).toEqual(["@agent"]);
    expect(result.exclusions.types).toEqual(["todo"]);
  });

  test("handles exclusion of mention", () => {
    const result = parseQuery("fix !@alice");
    expect(result.types).toEqual(["fix"]);
    expect(result.exclusions.mentions).toEqual(["@alice"]);
  });

  test("handles exclusion of tag", () => {
    const result = parseQuery("#perf !fix !todo");
    expect(result.tags).toEqual(["#perf"]);
    expect(result.exclusions.types).toEqual(["fix", "todo"]);
  });

  test("handles quoted strings as text", () => {
    const result = parseQuery('"cache invalidation"');
    expect(result.textTerms).toEqual(["cache invalidation"]);
  });

  test("handles mixed quoted and unquoted", () => {
    const result = parseQuery('todo "add caching" @agent');
    expect(result.types).toEqual(["todo"]);
    expect(result.textTerms).toEqual(["add caching"]);
    expect(result.mentions).toEqual(["@agent"]);
  });

  test("fuzzy matches common type variations", () => {
    expect(parseQuery("todos").types).toEqual(["todo"]);
    expect(parseQuery("to-do").types).toEqual(["todo"]);
    expect(parseQuery("tldrs").types).toEqual(["tldr"]);
  });

  test("handles multiple types", () => {
    const result = parseQuery("todo fix");
    expect(result.types).toEqual(["todo", "fix"]);
  });

  test("treats unknown words as text", () => {
    const result = parseQuery("todo cache performance");
    expect(result.types).toEqual(["todo"]);
    expect(result.textTerms).toEqual(["cache", "performance"]);
  });

  test("handles namespaced tags", () => {
    const result = parseQuery("#wip/feature #sec:boundary");
    expect(result.tags).toEqual(["#wip/feature", "#sec:boundary"]);
  });

  test("handles complex property patterns", () => {
    const result = parseQuery("from:#auth/core owner:@alice");
    expect(result.properties.get("from")).toBe("#auth/core");
    expect(result.properties.get("owner")).toBe("@alice");
  });

  test("handles empty query", () => {
    const result = parseQuery("");
    expect(result.types).toEqual([]);
    expect(result.mentions).toEqual([]);
    expect(result.tags).toEqual([]);
    expect(result.textTerms).toEqual([]);
  });

  test("handles whitespace-only query", () => {
    const result = parseQuery("   ");
    expect(result.types).toEqual([]);
    expect(result.textTerms).toEqual([]);
  });

  test("handles unclosed quotes gracefully", () => {
    const result = parseQuery('"unclosed quote');
    expect(result.textTerms).toEqual(["unclosed quote"]);
  });

  test("preserves property keys with special characters", () => {
    const result = parseQuery("see:#auth/core from:#payments");
    expect(result.properties.get("see")).toBe("#auth/core");
    expect(result.properties.get("from")).toBe("#payments");
  });
});
