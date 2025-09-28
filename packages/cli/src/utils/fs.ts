// tldr ::: filesystem helpers for expanding waymark CLI inputs

import { existsSync } from "node:fs";
import { readdir, stat } from "node:fs/promises";
import { basename, join, relative, resolve } from "node:path";

const SKIP_DIRECTORY_NAMES = new Set([
  ".git",
  "node_modules",
  "dist",
  "build",
  ".turbo",
]);

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

async function collectFilesRecursive(
  path: string,
  files: Set<string>
): Promise<void> {
  const info = await stat(path);
  if (info.isFile()) {
    files.add(normalizePathForOutput(path));
    return;
  }

  if (!info.isDirectory() || shouldSkipDirectory(path)) {
    return;
  }

  await collectDirectoryEntries(path, files);
}

function shouldSkipDirectory(path: string): boolean {
  const directoryName = basename(path);
  return directoryName !== "" && SKIP_DIRECTORY_NAMES.has(directoryName);
}

async function collectDirectoryEntries(
  directory: string,
  files: Set<string>
): Promise<void> {
  const entries = await readdir(directory, { withFileTypes: true });
  for (const entry of entries) {
    const child = join(directory, entry.name);
    if (entry.isDirectory()) {
      if (SKIP_DIRECTORY_NAMES.has(entry.name)) {
        continue;
      }
      await collectFilesRecursive(child, files);
    } else if (entry.isFile()) {
      files.add(normalizePathForOutput(child));
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
