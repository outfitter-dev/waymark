// tldr ::: filesystem utilities for directory walking and path normalization

import { existsSync, realpathSync } from "node:fs";
import { lstat, readdir, realpath, stat } from "node:fs/promises";
import { join, relative, resolve } from "node:path";
import { Glob } from "bun";

const SKIP_DIRECTORY_NAMES = new Set([
  ".git",
  "node_modules",
  "dist",
  "build",
  ".turbo",
]);

const PATH_SPLIT_REGEX = /[/\\]/u;

type WorkspaceBounds = {
  root: string;
  rootReal: string;
};

/**
 * Captures the nominal and real workspace paths used to constrain traversal.
 */
function getWorkspaceBounds(): WorkspaceBounds {
  const root = process.cwd();
  return {
    root,
    rootReal: tryRealpathSync(root) ?? root,
  };
}

/**
 * Expands user-supplied paths into a normalized list of files while enforcing
 * that every resolved path (including symlink targets) remains inside the
 * current workspace. Inputs that escape the workspace throw an error.
 *
 * @param inputs - Relative or absolute paths provided to the MCP server
 * @returns A de-duplicated array of files under the workspace root
 * @throws Error when an input resolves outside the workspace
 */
export async function expandInputPaths(inputs: string[]): Promise<string[]> {
  if (inputs.length === 0) {
    return [];
  }

  const bounds = getWorkspaceBounds();
  const files = new Set<string>();
  const visited = new Set<string>();

  for (const input of inputs) {
    const resolved = resolve(bounds.root, input);
    if (escapesWorkspace(resolved, bounds)) {
      throw new Error(
        `Input "${input}" resolves outside workspace: ${resolved}`
      );
    }

    if (!existsSync(resolved)) {
      continue;
    }
    await collectFilesRecursive(resolved, files, bounds, visited);
  }
  return Array.from(files);
}

/**
 * Recursively collects file paths starting from the provided path, ensuring
 * symlinks stay inside the workspace and preventing traversal cycles.
 *
 * @param path - Candidate path to inspect
 * @param files - Mutable set that accumulates normalized file paths
 * @param bounds - Workspace boundary information
 * @param visited - Set of resolved paths already processed to avoid cycles
 */
export async function collectFilesRecursive(
  path: string,
  files: Set<string>,
  bounds: WorkspaceBounds,
  visited: Set<string>
): Promise<void> {
  const resolution = await resolveWithinWorkspace(path, bounds);
  if (!resolution) {
    return;
  }

  const { targetPath, stats } = resolution;

  if (visited.has(targetPath)) {
    return;
  }
  visited.add(targetPath);

  if (stats.isFile()) {
    files.add(normalizePathForOutput(targetPath));
    return;
  }

  if (!stats.isDirectory() || shouldSkipDirectory(targetPath)) {
    return;
  }

  const entries = await readdir(targetPath, { withFileTypes: true });
  await Promise.all(
    entries.map(async (entry) => {
      const child = join(targetPath, entry.name);
      if (entry.isDirectory() || entry.isSymbolicLink()) {
        if (SKIP_DIRECTORY_NAMES.has(entry.name)) {
          return;
        }
        await collectFilesRecursive(child, files, bounds, visited);
      } else if (entry.isFile()) {
        const fileResolution = await resolveWithinWorkspace(child, bounds);
        if (!fileResolution) {
          return;
        }
        files.add(normalizePathForOutput(fileResolution.targetPath));
      }
    })
  );
}

type PathResolution = {
  targetPath: string;
  stats: Awaited<ReturnType<typeof stat>>;
};

/**
 * Resolves the provided path while enforcing workspace boundaries for both the
 * nominal path and any symlink targets that are followed.
 *
 * @param path - The path to resolve
 * @param bounds - Workspace traversal limits
 * @returns The resolved target path with filesystem stats
 * @throws Error when the path resolves outside the workspace
 */
async function resolveWithinWorkspace(
  path: string,
  bounds: WorkspaceBounds
): Promise<PathResolution | null> {
  const lstatInfo = await lstat(path).catch((error) => {
    if (isEnoent(error)) {
      return null;
    }
    throw error;
  });

  if (!lstatInfo) {
    return null;
  }

  // Check the nominal path first so absolute inputs outside the workspace fail.
  if (escapesWorkspace(path, bounds)) {
    throw new Error(`Input "${path}" resolves outside workspace: ${path}`);
  }

  if (!lstatInfo.isSymbolicLink()) {
    return { targetPath: path, stats: lstatInfo };
  }

  const realPath = await realpath(path).catch((error) => {
    if (isEnoent(error)) {
      return null;
    }
    throw error;
  });

  if (!realPath) {
    return { targetPath: path, stats: lstatInfo };
  }

  if (escapesWorkspace(realPath, bounds)) {
    throw new Error(`Input "${path}" resolves outside workspace: ${realPath}`);
  }

  const targetStats = await stat(realPath).catch((error) => {
    if (isEnoent(error)) {
      return lstatInfo;
    }
    throw error;
  });

  return { targetPath: realPath, stats: targetStats };
}

/**
 * Determines whether a directory should be skipped during traversal based on
 * its leaf name (e.g., node_modules or build artifacts).
 */
function shouldSkipDirectory(path: string): boolean {
  const parts = path.split(PATH_SPLIT_REGEX);
  const name = parts.at(-1) ?? "";
  return SKIP_DIRECTORY_NAMES.has(name);
}

/**
 * Normalizes a path so output is relative to the workspace when possible, but
 * preserves absolute paths that fall outside of it.
 */
export function normalizePathForOutput(path: string): string {
  const rel = relative(process.cwd(), path);
  return rel === "" || rel.startsWith("..") ? path : rel;
}

/**
 * Filters a list of paths using glob-based skip patterns, evaluating both the
 * absolute and normalized representations to keep matches predictable.
 */
export function applySkipPaths(
  paths: string[],
  skipPatterns: string[]
): string[] {
  if (skipPatterns.length === 0) {
    return paths;
  }

  const globs = skipPatterns.map((pattern) => new Glob(pattern));
  return paths.filter((path) => {
    const rel = normalizePathForOutput(path);
    return !globs.some((glob) => glob.match(path) || glob.match(rel));
  });
}

/**
 * Returns true when the candidate path escapes either the nominal or the real
 * workspace root.
 */
function escapesWorkspace(candidate: string, bounds: WorkspaceBounds): boolean {
  const relativeToRoot = relative(bounds.root, candidate);
  if (relativeToRoot.startsWith("..")) {
    return true;
  }

  const candidateReal = tryRealpathSync(candidate);
  if (!candidateReal) {
    return false;
  }

  return relative(bounds.rootReal, candidateReal).startsWith("..");
}

function tryRealpathSync(path: string): string | null {
  try {
    return realpathSync(path);
  } catch (error) {
    if (isEnoent(error)) {
      return null;
    }
    throw error;
  }
}

function isEnoent(error: unknown): error is NodeJS.ErrnoException {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as NodeJS.ErrnoException).code === "ENOENT"
  );
}
