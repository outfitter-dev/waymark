// tldr ::: filesystem helpers for expanding waymark CLI inputs

import { existsSync, statSync } from "node:fs";
import { readdir, stat } from "node:fs/promises";
import { isAbsolute, join, relative, resolve } from "node:path";
import type { WaymarkConfig } from "@waymarks/core";
import { getIgnoreFilter, type IgnoreFilter } from "./ignore";

function determineRootDir(inputs: string[]): string {
  const cwd = process.cwd();

  // If scanning a single directory that exists, use it as root
  if (inputs.length === 1 && inputs[0]) {
    const resolved = resolve(cwd, inputs[0]);

    // Security: Prevent relative path traversal from changing the root directory
    // to a location outside the workspace. Absolute paths are allowed.
    if (!isAbsolute(inputs[0])) {
      const relativePath = relative(cwd, resolved);
      if (relativePath.startsWith("..")) {
        // Don't allow relative traversal to become the root directory
        return cwd;
      }
    }

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

/**
 * Validates that a path input doesn't use relative traversal to escape the workspace.
 *
 * @param rootDir - The workspace root directory
 * @param input - The original input path (before resolution)
 * @param resolved - The resolved absolute path
 * @throws Error if the input uses relative traversal to escape the workspace
 */
function assertNoTraversal(
  rootDir: string,
  input: string,
  resolved: string
): void {
  // Absolute paths are allowed (user explicitly specifies them)
  if (isAbsolute(input)) {
    return;
  }

  // For relative paths, ensure they don't escape the workspace
  const relativePath = relative(rootDir, resolved);

  // Path escapes workspace if relative() returns a path starting with ".."
  if (relativePath.startsWith("..")) {
    throw new Error(`Input "${input}" resolves outside workspace: ${resolved}`);
  }
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

    // Prevent path traversal attacks using relative paths like "../.."
    assertNoTraversal(rootDir, input, resolved);

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
