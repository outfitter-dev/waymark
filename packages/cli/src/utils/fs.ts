// tldr ::: filesystem helpers for expanding waymark CLI inputs

import { existsSync, statSync } from "node:fs";
import { readdir, stat } from "node:fs/promises";
import { join, relative, resolve } from "node:path";
import type { WaymarkConfig } from "@waymarks/core";
import { getIgnoreFilter, type IgnoreFilter } from "./ignore";

function determineRootDir(inputs: string[]): string {
  const cwd = process.cwd();

  // If scanning a single directory that exists, use it as root
  if (inputs.length === 1 && inputs[0]) {
    const resolved = resolve(cwd, inputs[0]);
    if (existsSync(resolved)) {
      try {
        const stats = statSync(resolved);
        if (stats.isDirectory()) {
          return resolved;
        }
      } catch {
        // Fall through to using cwd
      }
    }
  }

  return cwd;
}

export async function expandInputPaths(
  inputs: string[],
  config: WaymarkConfig
): Promise<string[]> {
  if (inputs.length === 0) {
    return [];
  }

  const rootDir = determineRootDir(inputs);
  const ignoreFilter = getIgnoreFilter({
    rootDir,
    config: {
      skipPaths: config.skipPaths,
      includePaths: config.includePaths,
      respectGitignore: config.respectGitignore,
    },
  });

  const files = new Set<string>();

  for (const input of inputs) {
    const resolved = resolve(rootDir, input);
    if (!existsSync(resolved)) {
      continue;
    }
    await collectFilesRecursive(resolved, files, ignoreFilter);
  }

  return Array.from(files);
}

async function collectFilesRecursive(
  path: string,
  files: Set<string>,
  ignoreFilter: IgnoreFilter
): Promise<void> {
  const info = await stat(path);
  const isDirectory = info.isDirectory();

  // Check if this path should be ignored
  if (ignoreFilter.shouldIgnore(path, isDirectory)) {
    return;
  }

  if (info.isFile()) {
    files.add(normalizePathForOutput(path));
    return;
  }

  if (!isDirectory) {
    return;
  }

  // Note: We removed the hardcoded SKIP_DIRECTORY_NAMES check here
  // because the ignore filter now handles all directory filtering,
  // including respect for includePaths that might target files inside
  // otherwise-skipped directories like dist/ or build/.

  await collectDirectoryEntries(path, files, ignoreFilter);
}

// Removed: shouldSkipDirectory function - now handled by IgnoreFilter

async function collectDirectoryEntries(
  directory: string,
  files: Set<string>,
  ignoreFilter: IgnoreFilter
): Promise<void> {
  const entries = await readdir(directory, { withFileTypes: true });
  for (const entry of entries) {
    const child = join(directory, entry.name);

    if (entry.isDirectory()) {
      // Ignore filter handles all directory filtering now
      await collectFilesRecursive(child, files, ignoreFilter);
    } else if (entry.isFile()) {
      await collectFilesRecursive(child, files, ignoreFilter);
    }
  }
}

function normalizePathForOutput(path: string): string {
  const rel = relative(process.cwd(), path);
  return rel === "" || rel.startsWith("..") ? path : rel;
}

export function ensureFileExists(path: string): void {
  if (!(existsSync(path) || existsSync(resolve(process.cwd(), path)))) {
    throw new Error(`File not found: ${path}`);
  }
}
