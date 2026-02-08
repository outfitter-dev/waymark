// tldr ::: contract coverage for deterministic waymark ID generation

import { describe, expect, it } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { DEFAULT_CONFIG } from "../../config.ts";
import { JsonIdIndex } from "../../id-index.ts";
import {
  fingerprintContent,
  fingerprintContext,
  WaymarkIdManager,
  type WaymarkIdMetadata,
} from "../../ids.ts";
import type { WaymarkIdConfig } from "../../types.ts";

const WORKSPACE_PREFIX = "waymark-contract-ids-";

function createWorkspace(): Promise<string> {
  return mkdtemp(join(tmpdir(), WORKSPACE_PREFIX));
}

async function cleanupWorkspace(path: string | undefined): Promise<void> {
  if (path?.startsWith(join(tmpdir(), WORKSPACE_PREFIX))) {
    await rm(path, { recursive: true, force: true });
  }
}

function buildMetadata(): WaymarkIdMetadata {
  const content = "review roundtrip contracts";
  return {
    file: "/repo/src/contract.ts",
    line: 42,
    type: "todo",
    content,
    contentHash: fingerprintContent(content),
    contextHash: fingerprintContext("/repo/src/contract.ts:42"),
    sourceType: "cli",
  };
}

describe("ID contracts", () => {
  it("produces deterministic IDs across fresh managers", async () => {
    const workspaceA = await createWorkspace();
    const workspaceB = await createWorkspace();

    try {
      const metadata = buildMetadata();
      const config: WaymarkIdConfig = { ...DEFAULT_CONFIG.ids, mode: "auto" };
      const managerA = new WaymarkIdManager(
        config,
        new JsonIdIndex({ workspaceRoot: workspaceA })
      );
      const managerB = new WaymarkIdManager(
        config,
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
    } finally {
      await cleanupWorkspace(workspaceA);
      await cleanupWorkspace(workspaceB);
    }
  });

  it("respects configured length and bracket format", async () => {
    const workspace = await createWorkspace();

    try {
      const metadata = buildMetadata();
      const config: WaymarkIdConfig = {
        ...DEFAULT_CONFIG.ids,
        mode: "auto",
        length: 9,
      };
      const manager = new WaymarkIdManager(
        config,
        new JsonIdIndex({ workspaceRoot: workspace })
      );

      const result = await manager.reserveId(metadata);

      expect(result.isOk()).toBe(true);
      if (!result.isOk()) {
        throw new Error("Expected successful reservation");
      }
      const id = result.value;
      expect(id).toBeDefined();
      if (!id) {
        throw new Error("Expected generated ID");
      }
      expect(id.startsWith("[[")).toBe(true);
      expect(id.endsWith("]]")).toBe(true);
      expect(id.slice(2, -2)).toHaveLength(config.length);
    } finally {
      await cleanupWorkspace(workspace);
    }
  });
});
