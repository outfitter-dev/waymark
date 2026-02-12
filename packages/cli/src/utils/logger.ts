// tldr ::: @outfitter/logging-based logger configuration for CLI with level control

import {
  createConsoleSink,
  createLogger as createOutfitterLogger,
  type LoggerInstance,
  type LogLevel,
  resolveLogLevel,
} from "@outfitter/logging";

export type { LogLevel } from "@outfitter/logging";

/**
 * Options for creating a CLI logger instance.
 */
export type LoggerOptions = {
  level?: LogLevel;
  pretty?: boolean;
};

/**
 * CLI logger type extending LoggerInstance with a level getter/setter
 * for backward compatibility with `logger.level = "debug"` usage.
 */
export type Logger = LoggerInstance & {
  level: LogLevel;
};

/**
 * Create a configured logger instance using @outfitter/logging.
 *
 * Uses `resolveLogLevel()` for level resolution:
 * `OUTFITTER_LOG_LEVEL` > explicit > env profile > "warn" default.
 * @param options - Logger configuration options.
 * @returns Configured logger instance with level getter/setter.
 */
export function createLogger(options: LoggerOptions = {}): Logger {
  const level: LogLevel = resolveLogLevel(options.level ?? "warn");
  const pretty = options.pretty ?? process.env.NODE_ENV !== "production";

  const inner = createOutfitterLogger({
    name: "waymark",
    level,
    sinks: [createConsoleSink({ colors: pretty })],
  });

  let currentLevel = level;
  const originalSetLevel = inner.setLevel.bind(inner);

  // Override setLevel to also track current level locally
  Object.defineProperty(inner, "setLevel", {
    value: (newLevel: LogLevel): void => {
      currentLevel = newLevel;
      originalSetLevel(newLevel);
    },
    writable: true,
    configurable: true,
  });

  // Define level as a getter/setter property for backward compatibility
  Object.defineProperty(inner, "level", {
    get(): LogLevel {
      return currentLevel;
    },
    set(newLevel: LogLevel) {
      currentLevel = newLevel;
      originalSetLevel(newLevel);
    },
    enumerable: true,
    configurable: true,
  });

  return inner as Logger;
}

/**
 * Default logger instance for the CLI.
 *
 * Import and use directly:
 *   import \{ logger \} from "../utils/logger.ts";
 *
 * Log levels (from lowest to highest):
 *   logger.trace("very detailed debugging");
 *   logger.debug("debugging information");
 *   logger.info("informational messages");
 *   logger.warn("warning messages");
 *   logger.error("error messages");
 *   logger.fatal("fatal errors");
 *
 * Default level is 'warn', so only warn/error/fatal show by default.
 * Use --verbose for info level, --debug for debug level, --quiet for error level only.
 *
 * The logger level is automatically configured by the CLI's preAction hook
 * based on --verbose, --debug, or --quiet flags.
 */
export const logger = createLogger();
