// tldr ::: standardized error handling utilities for MCP server

import { logger } from "./logger.ts";

/**
 * Safely read a file with standardized error handling.
 * Returns null on any error and logs the failure.
 */
export async function safeReadFile(
  filePath: string,
  options: { encoding?: BufferEncoding; logContext?: string } = {}
): Promise<string | null> {
  const { encoding = "utf8", logContext = "file read" } = options;

  try {
    const { readFile } = await import("node:fs/promises");
    return await readFile(filePath, encoding);
  } catch (error) {
    logger.debug(`Failed to read file: ${filePath}`, {
      error,
      filePath,
      context: logContext,
    });
    return null;
  }
}
