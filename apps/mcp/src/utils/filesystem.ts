// tldr ::: filesystem utilities for directory walking and path normalization

import { existsSync } from "node:fs";
import { readdir, stat } from "node:fs/promises";
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

export async function expandInputPaths(inputs: string[]): Promise<string[]> {
  if (inputs.length === 0) {
    return [];
  }

  const files = new Set<string>();
  for (const input of inputs) {
    const resolved = resolve(process.cwd(), input);
    if (!existsSync(resolved)) {
      continue;
    }
    await collectFilesRecursive(resolved, files);
  }
  return Array.from(files);
}

export async function collectFilesRecursive(
  path: string,
  files: Set<string>
): Promise<void> {
  const info = await stat(path);
  if (info.isFile()) {
    files.add(path);
    return;
  }

  if (!info.isDirectory() || shouldSkipDirectory(path)) {
    return;
  }

  const entries = await readdir(path, { withFileTypes: true });
  await Promise.all(
    entries.map(async (entry) => {
      const child = join(path, entry.name);
      if (entry.isDirectory()) {
        if (SKIP_DIRECTORY_NAMES.has(entry.name)) {
          return;
        }
        await collectFilesRecursive(child, files);
      } else if (entry.isFile()) {
        files.add(child);
      }
    })
  );
}

function shouldSkipDirectory(path: string): boolean {
  const parts = path.split(PATH_SPLIT_REGEX);
  const name = parts.at(-1) ?? "";
  return SKIP_DIRECTORY_NAMES.has(name);
}

export function normalizePathForOutput(path: string): string {
  const rel = relative(process.cwd(), path);
  return rel === "" || rel.startsWith("..") ? path : rel;
}

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
