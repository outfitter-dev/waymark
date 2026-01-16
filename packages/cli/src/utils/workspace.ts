// tldr ::: helpers to resolve the workspace root for CLI operations

import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

/**
 * Resolve the workspace root by searching for a .waymark directory.
 * @param start - Directory to start searching from.
 * @returns Resolved workspace root path.
 */
export function resolveWorkspaceRoot(start = process.cwd()): string {
  let current = resolve(start);

  while (true) {
    if (existsSync(join(current, ".waymark"))) {
      return current;
    }

    const parent = dirname(current);
    if (parent === current) {
      return current;
    }

    current = parent;
  }
}
