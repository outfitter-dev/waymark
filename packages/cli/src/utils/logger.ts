// tldr ::: pino-based logger configuration for CLI with level control

import pino from "pino";

/**
 * Logging in CLI commands:
 *
 * Import and use the default logger instance:
 *   import { logger } from "../utils/logger.ts";
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

export type LogLevel = "trace" | "debug" | "info" | "warn" | "error" | "fatal";

export type LoggerOptions = {
  level?: LogLevel;
  pretty?: boolean;
};

/**
 * Create a configured pino logger instance.
 *
 * For CLI tools, we default to 'warn' level to keep output clean.
 * Use --verbose flag to set level to 'info' or --debug for 'debug'.
 * @param options - Logger configuration options.
 * @returns Configured pino logger instance.
 */
export function createLogger(options: LoggerOptions = {}): pino.Logger {
  const {
    level = (process.env.LOG_LEVEL as LogLevel) || "warn",
    pretty = process.env.NODE_ENV !== "production",
  } = options;

  if (pretty) {
    return pino({
      level,
      transport: {
        target: "pino-pretty",
        options: {
          colorize: true,
          ignore: "pid,hostname",
          translateTime: false,
          messageFormat: "{msg}",
          singleLine: true,
        },
      },
    });
  }

  return pino({ level });
}

// Default logger instance for the CLI
export const logger = createLogger();
