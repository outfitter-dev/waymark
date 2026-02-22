// tldr ::: filesystem utilities for directory walking and path normalization

import { existsSync, realpathSync } from "node:fs";
import { lstat, readdir, realpath, stat } from "node:fs/promises";
import { join, relative, resolve } from "node:path";
import { Result, ValidationError } from "@outfitter/contracts";
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
 * current workspace. Inputs that escape the workspace produce a ValidationError.
 *
 * @param inputs - Relative or absolute paths provided to the MCP server
 * @returns Result containing a de-duplicated array of files under the workspace root
 */
export async function expandInputPaths(
  inputs: string[]
): Promise<Result<string[], ValidationError>> {
  if (inputs.length === 0) {
    return Result.ok([]);
  }

  const bounds = getWorkspaceBounds();
  const files = new Set<string>();
  const visited = new Set<string>();

  for (const input of inputs) {
    const resolved = resolve(bounds.root, input);
    if (escapesWorkspace(resolved, bounds)) {
      return Result.err(
        ValidationError.fromMessage(
          `Input "${input}" resolves outside workspace: ${resolved}`
        )
      );
    }

    if (!existsSync(resolved)) {
      continue;
    }
    const collectResult = await collectFilesRecursive(
      resolved,
      files,
      bounds,
      visited
    );
    if (collectResult.isErr()) {
      return Result.err(collectResult.error);
    }
  }
  return Result.ok(Array.from(files));
}

/**
 * Recursively collects file paths starting from the provided path, ensuring
 * symlinks stay inside the workspace and preventing traversal cycles.
 *
 * @param path - Candidate path to inspect
 * @param files - Mutable set that accumulates normalized file paths
 * @param bounds - Workspace boundary information
 * @param visited - Set of resolved paths already processed to avoid cycles
 * @returns Result representing success or a ValidationError for workspace escapes
 */
export async function collectFilesRecursive(
  path: string,
  files: Set<string>,
  bounds: WorkspaceBounds,
  visited: Set<string>
): Promise<Result<void, ValidationError>> {
  const resolutionResult = await resolveWithinWorkspace(path, bounds);
  if (resolutionResult.isErr()) {
    return Result.err(resolutionResult.error);
  }

  const resolution = resolutionResult.value;
  if (!resolution) {
    return Result.ok(undefined);
  }

  const { targetPath, stats } = resolution;

  if (visited.has(targetPath)) {
    return Result.ok(undefined);
  }
  visited.add(targetPath);

  if (stats.isFile()) {
    files.add(normalizePathForOutput(targetPath));
    return Result.ok(undefined);
  }

  if (!stats.isDirectory() || shouldSkipDirectory(targetPath)) {
    return Result.ok(undefined);
  }

  const entries = await readdir(targetPath, { withFileTypes: true });
  const results = await Promise.all(
    entries.map(async (entry): Promise<Result<void, ValidationError>> => {
      const child = join(targetPath, entry.name);
      if (entry.isDirectory() || entry.isSymbolicLink()) {
        if (SKIP_DIRECTORY_NAMES.has(entry.name)) {
          return Result.ok(undefined);
        }
        return collectFilesRecursive(child, files, bounds, visited);
      }
      if (entry.isFile()) {
        const fileResolutionResult = await resolveWithinWorkspace(
          child,
          bounds
        );
        if (fileResolutionResult.isErr()) {
          return Result.err(fileResolutionResult.error);
        }
        const fileResolution = fileResolutionResult.value;
        if (!fileResolution) {
          return Result.ok(undefined);
        }
        files.add(normalizePathForOutput(fileResolution.targetPath));
        return Result.ok(undefined);
      }
      return Result.ok(undefined);
    })
  );

  for (const r of results) {
    if (r.isErr()) {
      return Result.err(r.error);
    }
  }
  return Result.ok(undefined);
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
 * @returns Result containing the resolved target path with filesystem stats, or null if not found
 */
async function resolveWithinWorkspace(
  path: string,
  bounds: WorkspaceBounds
): Promise<Result<PathResolution | null, ValidationError>> {
  const lstatInfo = await lstat(path).catch((error) => {
    if (isEnoent(error)) {
      return null;
    }
    throw error;
  });

  if (!lstatInfo) {
    return Result.ok(null);
  }

  // Check the nominal path first so absolute inputs outside the workspace fail.
  if (escapesWorkspace(path, bounds)) {
    return Result.err(
      ValidationError.fromMessage(
        `Input "${path}" resolves outside workspace: ${path}`
      )
    );
  }

  if (!lstatInfo.isSymbolicLink()) {
    return Result.ok({ targetPath: path, stats: lstatInfo });
  }

  const realPath = await realpath(path).catch((error) => {
    if (isEnoent(error)) {
      return null;
    }
    throw error;
  });

  if (!realPath) {
    return Result.ok({ targetPath: path, stats: lstatInfo });
  }

  if (escapesWorkspace(realPath, bounds)) {
    return Result.err(
      ValidationError.fromMessage(
        `Input "${path}" resolves outside workspace: ${realPath}`
      )
    );
  }

  const targetStats = await stat(realPath).catch((error) => {
    if (isEnoent(error)) {
      return lstatInfo;
    }
    throw error;
  });

  return Result.ok({ targetPath: realPath, stats: targetStats });
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
