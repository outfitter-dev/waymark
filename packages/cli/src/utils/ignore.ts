// tldr ::: enhanced ignore system combining gitignore and config-based patterns

import { existsSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import type { WaymarkConfig } from "@waymarks/core";
import ignore from "ignore";

export type IgnoreOptions = {
  rootDir: string;
  config: Pick<
    WaymarkConfig,
    "skipPaths" | "includePaths" | "respectGitignore"
  >;
};

export class IgnoreFilter {
  private readonly gitignore: ReturnType<typeof ignore> | null = null;
  private readonly skipPatterns: ReturnType<typeof ignore>;
  private readonly includePatterns: ReturnType<typeof ignore>;
  private readonly rootDir: string;
  private readonly hasIncludes: boolean;

  constructor(options: IgnoreOptions) {
    this.rootDir = options.rootDir;
    this.hasIncludes = options.config.includePaths.length > 0;

    // Load .gitignore if configured
    if (options.config.respectGitignore) {
      this.gitignore = this.loadGitignore();
    }

    // Load config-based patterns
    this.skipPatterns = ignore().add(options.config.skipPaths);
    this.includePatterns = ignore().add(options.config.includePaths);
  }

  private loadGitignore(): ReturnType<typeof ignore> | null {
    const gitignorePath = join(this.rootDir, ".gitignore");
    if (!existsSync(gitignorePath)) {
      return null;
    }

    try {
      const content = readFileSync(gitignorePath, "utf-8");
      return ignore().add(content);
    } catch {
      return null;
    }
  }

  /**
   * Check if a path should be ignored
   *
   * Logic:
   * 1. If path is explicitly included via includePaths → NOT ignored
   * 2. If path matches skipPaths → ignored
   * 3. If path matches .gitignore (and respectGitignore=true) → ignored
   * 4. Otherwise → NOT ignored
   *
   * Note: Directories are never blocked when includePaths exist, since we need
   * to descend into them to check for files that match include patterns.
   */
  shouldIgnore(absolutePath: string, isDirectory = false): boolean {
    const relativePath = relative(this.rootDir, absolutePath);

    // Paths outside root are never ignored (handled elsewhere)
    if (!relativePath || relativePath.startsWith("..")) {
      return false;
    }

    // Explicit inclusion overrides everything
    if (this.includePatterns.ignores(relativePath)) {
      return false;
    }

    // Don't block directories when we have includePaths - need to check files inside
    if (isDirectory && this.hasIncludes) {
      return false;
    }

    // Check skip patterns
    if (this.skipPatterns.ignores(relativePath)) {
      return true;
    }

    // Check gitignore
    if (this.gitignore?.ignores(relativePath)) {
      return true;
    }

    return false;
  }
}

// Cache filters by root directory for performance
const filterCache = new Map<string, IgnoreFilter>();

/**
 * Get a cached ignore filter for the provided options.
 * @param options - Root directory and ignore configuration.
 * @returns Ignore filter instance.
 */
export function getIgnoreFilter(options: IgnoreOptions): IgnoreFilter {
  const cacheKey = `${options.rootDir}:${options.config.respectGitignore}:${options.config.skipPaths.join(",")}:${options.config.includePaths.join(",")}`;

  const cached = filterCache.get(cacheKey);
  if (cached) {
    return cached;
  }

  const filter = new IgnoreFilter(options);
  filterCache.set(cacheKey, filter);
  return filter;
}

/**
 * Clear the ignore filter cache (useful for tests).
 */
export function clearIgnoreCache(): void {
  filterCache.clear();
}
