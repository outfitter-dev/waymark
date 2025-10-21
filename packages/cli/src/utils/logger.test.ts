// tldr ::: tests for pino logger configuration and level control

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

  test("logger level can be changed after creation", () => {
    const logger = createLogger({ level: "warn" });
    expect(logger.level).toBe("warn");

    logger.level = "debug";
    expect(logger.level).toBe("debug");
  });

  test("creates logger with pretty format in development", () => {
    process.env.NODE_ENV = "development";
    const logger = createLogger({ pretty: true });
    // Can't easily test pino-pretty integration, but verify it doesn't crash
    expect(logger).toBeDefined();
    expect(logger.level).toBe("warn");
  });

  test("creates logger without pretty format in production", () => {
    process.env.NODE_ENV = "production";
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
  });
});
