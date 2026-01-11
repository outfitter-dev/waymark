// tldr ::: waymark agent toolkit facade exposing core APIs

import { readFile } from "node:fs/promises";

import { formatText, parse, resolveConfig } from "@waymarks/core";
import packageJson from "../package.json" with { type: "json" };

export type { ParseOptions, WaymarkRecord } from "@waymarks/core";
export type { PartialWaymarkConfig } from "./types.ts";

/** Options for configuring the agent toolkit. */
export type AgentToolkitOptions = {
  config?: import("./types.ts").PartialWaymarkConfig;
};

/**
 * Creates an agent toolkit with waymark parsing, formatting, and scanning capabilities.
 *
 * @param options - Configuration options for the toolkit
 * @returns Toolkit instance with parse, format, and scan methods
 *
 * @example
 * ```ts
 * const toolkit = createAgentToolkit({ config: { typeCase: 'lowercase' } });
 * const records = toolkit.parse('// todo ::: fix bug');
 * const formatted = toolkit.format('//todo:::fix bug');
 * const scanned = await toolkit.scan(['src/index.ts', 'src/utils.ts']);
 * ```
 */
export function createAgentToolkit(options: AgentToolkitOptions = {}) {
  const config = resolveConfig(options.config ?? {});

  return {
    agentVersion: packageJson.version,

    /**
     * Parse waymark syntax from a source string.
     *
     * @param source - Source code containing waymarks
     * @param parseOptions - Optional parsing configuration
     * @returns Array of parsed waymark records
     */
    parse: (
      source: string,
      parseOptions?: import("@waymarks/core").ParseOptions
    ): import("@waymarks/core").WaymarkRecord[] => parse(source, parseOptions),

    /**
     * Format waymark syntax according to configured style rules.
     *
     * @param source - Source code to format
     * @returns Formatted source text with normalized waymark syntax
     */
    format: (source: string): string =>
      formatText(source, { config }).formattedText,

    /**
     * Scan files and return parsed waymark records.
     *
     * @param filePaths - Array of file paths to scan
     * @returns Promise resolving to array of waymark records
     */
    scan: async (
      filePaths: string[]
    ): Promise<import("@waymarks/core").WaymarkRecord[]> => {
      const records: import("@waymarks/core").WaymarkRecord[] = [];

      for (const filePath of filePaths) {
        const source = await readFile(filePath, "utf8").catch((error) => {
          // Only silently skip ENOENT; log other errors
          if (error.code !== "ENOENT") {
            // biome-ignore lint/suspicious/noConsole: CLI tool needs to log errors to stderr
            console.warn(`Failed to read ${filePath}:`, error.message);
          }
          return null;
        });
        if (typeof source !== "string") {
          continue;
        }
        records.push(...parse(source, { file: filePath }));
      }

      return records;
    },
  };
}

/** Current agent package version. */
export const agentVersion = packageJson.version;
