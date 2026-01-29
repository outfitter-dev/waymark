// tldr ::: config-aware language resolution wrapping @waymarks/grammar registry

import { basename, extname } from "node:path";

import {
  type CommentCapability,
  DEFAULT_LANGUAGE_REGISTRY,
  type LanguageRegistry,
} from "@waymarks/grammar";

import type { WaymarkConfig } from "./types";

/**
 * Build a language registry with config overrides merged on top of defaults.
 * Config extensions and basenames override the corresponding default entries.
 *
 * @param config - Optional waymark config with language overrides
 * @returns A LanguageRegistry with config overrides applied
 *
 * @example
 * ```typescript
 * const registry = buildLanguageRegistry({
 *   languages: {
 *     extensions: { ".xyz": ["//"] },
 *     basenames: { "MyConfig": ["#"] }
 *   }
 * });
 * ```
 */
export function buildLanguageRegistry(
  config?: WaymarkConfig
): LanguageRegistry {
  const langConfig = config?.languages;

  // No overrides - return default registry
  if (!(langConfig?.extensions || langConfig?.basenames)) {
    return DEFAULT_LANGUAGE_REGISTRY;
  }

  // Build extension map with overrides
  const byExtension = new Map(DEFAULT_LANGUAGE_REGISTRY.byExtension);
  if (langConfig.extensions) {
    for (const [ext, leaders] of Object.entries(langConfig.extensions)) {
      const normalizedExt = ext.toLowerCase();
      byExtension.set(normalizedExt, {
        language: "custom",
        leaders: Object.freeze(leaders) as readonly string[],
      });
    }
  }

  // Build basename map with overrides
  const byBasename = new Map(DEFAULT_LANGUAGE_REGISTRY.byBasename);
  if (langConfig.basenames) {
    for (const [name, leaders] of Object.entries(langConfig.basenames)) {
      byBasename.set(name, {
        language: "custom",
        leaders: Object.freeze(leaders) as readonly string[],
      });
    }
  }

  return Object.freeze({
    byExtension,
    byBasename,
  });
}

/**
 * Look up comment capability for a file by its path, respecting config overrides.
 * Checks basename first (for files like Dockerfile, Makefile), then extension.
 *
 * @param filePath - Path to the file
 * @param registry - Language registry to use
 * @returns Comment capability or undefined if file type is not recognized
 */
function getCommentCapability(
  filePath: string,
  registry: LanguageRegistry
): CommentCapability | undefined {
  const name = basename(filePath);

  // Check basename first (for Dockerfile, Makefile, etc.)
  const byBasename = registry.byBasename.get(name);
  if (byBasename) {
    return byBasename;
  }

  // Handle special case: .d.ts, .d.tsx, .d.mts, .d.cts
  const lower = filePath.toLowerCase();
  if (
    lower.endsWith(".d.ts") ||
    lower.endsWith(".d.mts") ||
    lower.endsWith(".d.cts")
  ) {
    return registry.byExtension.get(".ts");
  }
  if (lower.endsWith(".d.tsx")) {
    return registry.byExtension.get(".tsx");
  }

  // Check extension (case-insensitive)
  const ext = extname(name).toLowerCase();
  if (ext) {
    return registry.byExtension.get(ext);
  }

  return;
}

/**
 * Check if a file can have waymarks based on its extension or basename.
 * Respects config overrides and the skipUnknown setting.
 *
 * @param filePath - Path to the file
 * @param config - Optional waymark config with language settings
 * @returns true if file can have waymarks, false if it cannot
 *
 * @example
 * ```typescript
 * canHaveWaymarks("src/index.ts")                    // => true
 * canHaveWaymarks("data.json")                       // => false (no comments)
 * canHaveWaymarks("mystery.xyz")                     // => true (unknown, try to parse)
 * canHaveWaymarks("mystery.xyz", { languages: { skipUnknown: true } })  // => false
 *
 * // Override JSON to have comments
 * canHaveWaymarks("data.json", { languages: { extensions: { ".json": ["//"] } } })
 * // => true
 * ```
 */
export function canHaveWaymarks(
  filePath: string,
  config?: WaymarkConfig
): boolean {
  const registry = buildLanguageRegistry(config);
  const capability = getCommentCapability(filePath, registry);

  // Unknown file type
  if (capability === undefined) {
    // skipUnknown: true means skip unknown files
    // skipUnknown: false (default) means try to parse
    return !(config?.languages?.skipUnknown ?? false);
  }

  // Known file type - check if it has comment support
  return capability.leaders.length > 0;
}

/**
 * Get comment leaders for a file based on its extension or basename.
 * Respects config overrides.
 *
 * @param filePath - Path to the file
 * @param config - Optional waymark config with language settings
 * @returns Array of comment leader strings, or empty array if none found
 *
 * @example
 * ```typescript
 * getCommentLeaders("src/index.ts")   // => ["//", "/*"]
 * getCommentLeaders("data.json")      // => []
 * getCommentLeaders("mystery.xyz")    // => []
 *
 * // With config override
 * getCommentLeaders("data.json", { languages: { extensions: { ".json": ["//"] } } })
 * // => ["//"]
 * ```
 */
export function getCommentLeaders(
  filePath: string,
  config?: WaymarkConfig
): string[] {
  const registry = buildLanguageRegistry(config);
  const capability = getCommentCapability(filePath, registry);

  if (capability === undefined) {
    return [];
  }

  return [...capability.leaders];
}
