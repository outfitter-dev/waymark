// tldr ::: @outfitter/logging-based logger for MCP server

import {
  createConsoleSink,
  createLogger as createOutfitterLogger,
  type LoggerInstance,
  resolveLogLevel,
} from "@outfitter/logging";

export const logger: LoggerInstance = createOutfitterLogger({
  name: "waymark-mcp",
  level: resolveLogLevel("warn"),
  sinks: [createConsoleSink({ colors: false })],
});
