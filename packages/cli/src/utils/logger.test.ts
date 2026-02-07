// tldr ::: tests for @outfitter/logging-based CLI logger with level control

import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { createLogger } from "./logger.ts";

describe("logger utility", () => {
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    originalEnv = { ...process.env };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  test("creates logger with default warn level", () => {
    const logger = createLogger();
    expect(logger.level).toBe("warn");
  });

  test("creates logger with custom level", () => {
    const logger = createLogger({ level: "debug" });
    expect(logger.level).toBe("debug");
  });

  test("respects LOG_LEVEL environment variable", () => {
    process.env.LOG_LEVEL = "info";
    const logger = createLogger();
    expect(logger.level).toBe("info");
  });

  test("explicit level option overrides environment variable", () => {
    process.env.LOG_LEVEL = "info";
    const logger = createLogger({ level: "error" });
    expect(logger.level).toBe("error");
  });

  test("logger level can be changed after creation via setter", () => {
    const logger = createLogger({ level: "warn" });
    expect(logger.level).toBe("warn");

    logger.level = "debug";
    expect(logger.level).toBe("debug");
  });

  test("logger level can be changed after creation via setLevel", () => {
    const logger = createLogger({ level: "warn" });
    expect(logger.level).toBe("warn");

    logger.setLevel("debug");
    expect(logger.level).toBe("debug");
  });

  test("creates logger with pretty option without crashing", () => {
    const logger = createLogger({ pretty: true });
    expect(logger).toBeDefined();
    expect(logger.level).toBe("warn");
  });

  test("creates logger with pretty disabled", () => {
    const logger = createLogger({ pretty: false });
    expect(logger).toBeDefined();
    expect(logger.level).toBe("warn");
  });

  test("accepts all valid log levels", () => {
    const levels: Array<
      "trace" | "debug" | "info" | "warn" | "error" | "fatal"
    > = ["trace", "debug", "info", "warn", "error", "fatal"];

    for (const level of levels) {
      const logger = createLogger({ level });
      expect(logger.level).toBe(level);
    }
  });

  test("logger has all expected methods", () => {
    const logger = createLogger();

    expect(typeof logger.trace).toBe("function");
    expect(typeof logger.debug).toBe("function");
    expect(typeof logger.info).toBe("function");
    expect(typeof logger.warn).toBe("function");
    expect(typeof logger.error).toBe("function");
    expect(typeof logger.fatal).toBe("function");
    expect(typeof logger.setLevel).toBe("function");
  });
});
