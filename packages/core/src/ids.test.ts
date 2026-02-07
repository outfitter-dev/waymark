// tldr ::: deterministic ID generation tests covering default length and stability

import { describe, expect, it } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DEFAULT_CONFIG } from "./config.ts";
import { JsonIdIndex } from "./id-index.ts";
import {
  fingerprintContent,
  fingerprintContext,
  WaymarkIdManager,
  type WaymarkIdMetadata,
} from "./ids.ts";
import type { WaymarkIdConfig } from "./types.ts";

const DEFAULT_ID_LENGTH = 7;

function createWorkspace(prefix = "waymark-ids-"): Promise<string> {
  return mkdtemp(join(tmpdir(), prefix));
}

async function cleanupWorkspace(path: string | undefined): Promise<void> {
  if (path?.startsWith(join(tmpdir(), "waymark-ids-"))) {
    await rm(path, { recursive: true, force: true });
  }
}

describe("WaymarkIdManager", () => {
  it("defaults to 7-character IDs", () => {
    expect(DEFAULT_CONFIG.ids.length).toBe(DEFAULT_ID_LENGTH);
  });

  it("generates deterministic IDs across fresh manager instances", async () => {
    const workspaceA = await createWorkspace();
    const workspaceB = await createWorkspace();

    try {
      const idConfig: WaymarkIdConfig = { ...DEFAULT_CONFIG.ids, mode: "auto" };
      const metadata: WaymarkIdMetadata = {
        file: "/repo/src/app.ts",
        line: 12,
        type: "todo",
        content: "add coverage",
        contentHash: fingerprintContent("add coverage"),
        contextHash: fingerprintContext("/repo/src/app.ts:12"),
        sourceType: "cli",
      };

      const managerA = new WaymarkIdManager(
        idConfig,
        new JsonIdIndex({ workspaceRoot: workspaceA })
      );
      const managerB = new WaymarkIdManager(
        idConfig,
        new JsonIdIndex({ workspaceRoot: workspaceB })
      );

      const resultA = await managerA.reserveId(metadata);
      const resultB = await managerB.reserveId(metadata);

      expect(resultA.isOk()).toBe(true);
      expect(resultB.isOk()).toBe(true);
      if (!(resultA.isOk() && resultB.isOk())) {
        throw new Error("Expected successful reservation");
      }
      const idA = resultA.value;
      const idB = resultB.value;

      expect(idA).toBeDefined();
      expect(idB).toBeDefined();
      expect(idA).toBe(idB);

      if (!idA) {
        throw new Error("Expected reserved ID");
      }
      expect(idA.slice(2, -2)).toHaveLength(DEFAULT_CONFIG.ids.length);
    } finally {
      await cleanupWorkspace(workspaceA);
      await cleanupWorkspace(workspaceB);
    }
  });
});
