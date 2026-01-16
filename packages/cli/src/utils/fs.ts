// tldr ::: filesystem helpers for expanding waymark CLI inputs

import { existsSync, realpathSync, statSync } from "node:fs";
import { lstat, readdir, realpath, stat } from "node:fs/promises";
import { isAbsolute, join, relative, resolve } from "node:path";
import type { WaymarkConfig } from "@waymarks/core";
import { getIgnoreFilter, type IgnoreFilter } from "./ignore";

/**
 * Chooses the workspace directory that should act as the traversal root for the
 * given CLI inputs. We prefer a single directory input when possible so relative
 * traversal checks later on use the most specific anchor.
 */
function determineRootDir(inputs: string[]): string {
  const cwd = process.cwd();
  const cwdReal = tryRealpathSync(cwd) ?? cwd;

  if (inputs.length !== 1) {
    return cwd;
  }

  const [input] = inputs;
  if (!input) {
    return cwd;
  }

  const resolved = resolve(cwd, input);

  if (!isAbsolute(input) && escapesWorkspace(resolved, cwd, cwdReal)) {
    return cwd;
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
  rootRealPath: string,
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

  try {
    const resolvedReal = realpathSync(resolved);
    const relativeReal = relative(rootRealPath, resolvedReal);
    if (relativeReal.startsWith("..")) {
      throw new Error(
        `Input "${input}" resolves outside workspace: ${resolvedReal}`
      );
    }
  } catch (error) {
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      (error as NodeJS.ErrnoException).code === "ENOENT"
    ) {
      // Non-existent paths handled later
      return;
    }
    throw error;
  }
}

type VisitedSet = Set<string>;

type TraversalContext = {
  rootDir: string;
  rootRealPath: string;
  ignoreFilter: IgnoreFilter;
  visited: VisitedSet;
  enforceBoundary: boolean;
};

/**
 * Expands CLI path inputs into a normalized list of files while enforcing
 * workspace traversal boundaries and respect for configured ignore filters.
 *
 * @param inputs - Raw CLI path arguments (relative or absolute)
 * @param config - Waymark CLI configuration containing skip/include rules
 * @returns A de-duplicated array of normalized file paths ready for scanning
 */
export async function expandInputPaths(
  inputs: string[],
  config: WaymarkConfig
): Promise<string[]> {
  if (inputs.length === 0) {
    return [];
  }

  const rootDir = determineRootDir(inputs);
  const rootRealPath = await getRealPath(rootDir);
  const ignoreFilter = getIgnoreFilter({
    rootDir,
    config: {
      skipPaths: config.skipPaths,
      includePaths: config.includePaths,
      respectGitignore: config.respectGitignore,
    },
  });

  const files = new Set<string>();
  const visited: VisitedSet = new Set();

  for (const input of inputs) {
    const resolved = resolve(rootDir, input);
    const enforceBoundary = !isAbsolute(input);
    const context: TraversalContext = {
      rootDir,
      rootRealPath,
      ignoreFilter,
      visited,
      enforceBoundary,
    };

    // Prevent path traversal attacks using relative paths like "../.."
    assertNoTraversal(rootDir, rootRealPath, input, resolved);

    if (!existsSync(resolved)) {
      continue;
    }
    await collectFilesRecursive(resolved, files, context);
  }

  return Array.from(files);
}

/**
 * Recursively walks a directory tree, applying ignore filters and enforcing
 * symlink boundaries, adding discovered files to the provided set.
 *
 * @param path - Current filesystem path being visited
 * @param files - Mutable set tracking discovered files (normalized)
 * @param context - Shared traversal state (boundary enforcement, ignores, etc.)
 */
async function collectFilesRecursive(
  path: string,
  files: Set<string>,
  context: TraversalContext
): Promise<void> {
  const { ignoreFilter, visited } = context;
  const { targetPath, stats } = await resolveSafePath(path, context);

  if (visited.has(targetPath)) {
    return;
  }
  visited.add(targetPath);

  const isDirectory = stats.isDirectory();

  // Check if this path should be ignored
  if (ignoreFilter.shouldIgnore(targetPath, isDirectory)) {
    return;
  }

  if (stats.isFile()) {
    files.add(normalizePathForOutput(targetPath));
    return;
  }

  if (!isDirectory) {
    return;
  }

  // Note: We removed the hardcoded SKIP_DIRECTORY_NAMES check here
  // because the ignore filter now handles all directory filtering,
  // including respect for includePaths that might target files inside
  // otherwise-skipped directories like dist/ or build/.

  await collectDirectoryEntries(targetPath, files, context);
}

// Removed: shouldSkipDirectory function - now handled by IgnoreFilter

/**
 * Walks a directory's immediate children and recurses into each entry that could
 * contain files, delegating back to `collectFilesRecursive` so boundary checks
 * remain centralized.
 *
 * @param directory - Absolute path to the directory being enumerated
 * @param files - Mutable set tracking discovered files (normalized)
 * @param context - Shared traversal state (boundary enforcement, ignores, etc.)
 */
async function collectDirectoryEntries(
  directory: string,
  files: Set<string>,
  context: TraversalContext
): Promise<void> {
  const entries = await readdir(directory, { withFileTypes: true });
  for (const entry of entries) {
    const child = join(directory, entry.name);

    if (entry.isDirectory() || entry.isFile() || entry.isSymbolicLink()) {
      await collectFilesRecursive(child, files, context);
    }
  }
}

/**
 * Resolves symlinks safely by checking both the nominal and real workspace
 * boundaries before following the link. When boundary enforcement is disabled,
 * the original lstat information is returned unchanged.
 *
 * @param path - Current path candidate that may be a symlink
 * @param context - Traversal metadata including workspace bounds
 * @returns The resolved target path and filesystem stats
 */
async function resolveSafePath(
  path: string,
  context: TraversalContext
): Promise<{ targetPath: string; stats: Awaited<ReturnType<typeof stat>> }> {
  const { rootDir, rootRealPath, enforceBoundary } = context;
  const lstatInfo = await lstat(path);

  if (!enforceBoundary) {
    return followSymlinkWithoutBoundary(path, lstatInfo);
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

  const relativeToRoot = relative(rootDir, realPath);
  const relativeToRealRoot = relative(rootRealPath, realPath);
  if (relativeToRoot.startsWith("..") && relativeToRealRoot.startsWith("..")) {
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
 * Normalizes a filesystem path relative to the current working directory, while
 * preserving absolute paths when the target lies outside the workspace.
 *
 * @param path - Absolute path to normalize
 * @returns A relative path when inside the workspace, otherwise the original path
 */
function normalizePathForOutput(path: string): string {
  const rel = relative(process.cwd(), path);
  return rel === "" || rel.startsWith("..") ? path : rel;
}

/**
 * Asserts that the provided path exists either as-is or relative to the current
 * working directory, throwing a descriptive error when it cannot be found.
 *
 * @param path - The file path to verify
 * @returns Nothing. Throws when the path cannot be resolved.
 * @throws Error if the path does not resolve to an existing file
 */
export function ensureFileExists(path: string): void {
  if (!(existsSync(path) || existsSync(resolve(process.cwd(), path)))) {
    throw new Error(`File not found: ${path}`);
  }
}

/**
 * Attempts to resolve the real path for a candidate path, returning null when
 * the path does not exist instead of throwing so callers can handle ENOENT.
 */
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

/**
 * Determines whether a candidate path escapes either the nominal or real CWD.
 *
 * @param candidate - Path being evaluated
 * @param cwd - The nominal working directory
 * @param cwdReal - The resolved real path of the working directory
 * @returns True when the candidate escapes the workspace boundaries
 */
function escapesWorkspace(
  candidate: string,
  cwd: string,
  cwdReal: string
): boolean {
  const relativeToCwd = relative(cwd, candidate);
  if (relativeToCwd.startsWith("..")) {
    return true;
  }

  const candidateReal = tryRealpathSync(candidate);
  if (!candidateReal) {
    return false;
  }

  return relative(cwdReal, candidateReal).startsWith("..");
}

/**
 * Follows a symlink without enforcing workspace boundaries, falling back to the
 * original lstat information when the target cannot be resolved.
 *
 * @param path - Symlink path being followed
 * @param lstatInfo - Original lstat metadata for the symlink
 * @returns The resolved target path and stats, or the original metadata on ENOENT
 */
function followSymlinkWithoutBoundary(
  path: string,
  lstatInfo: Awaited<ReturnType<typeof lstat>>
): Promise<{ targetPath: string; stats: Awaited<ReturnType<typeof stat>> }> {
  return stat(path)
    .then((directStats) => ({ targetPath: path, stats: directStats }))
    .catch((error) => {
      if (isEnoent(error)) {
        return { targetPath: path, stats: lstatInfo };
      }
      throw error;
    });
}

/**
 * Type guard that checks whether a caught error represents an ENOENT condition.
 */
function isEnoent(error: unknown): error is NodeJS.ErrnoException {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as NodeJS.ErrnoException).code === "ENOENT"
  );
}

/**
 * Resolves the real path for a filesystem entry, returning the original path
 * when it does not exist so callers can continue gracefully.
 */
async function getRealPath(path: string): Promise<string> {
  try {
    return await realpath(path);
  } catch (error) {
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      (error as NodeJS.ErrnoException).code === "ENOENT"
    ) {
      return path;
    }
    throw error;
  }
}
