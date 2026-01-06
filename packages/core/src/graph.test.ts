// tldr ::: tests for waymark relation graph builder

import { expect, test } from "bun:test";

import type { WaymarkRecord } from "@waymarks/grammar";

import { buildRelationGraph } from "./graph";

const record = (overrides: Partial<WaymarkRecord>): WaymarkRecord => ({
  file: "src/a.ts",
  language: "typescript",
  fileCategory: "code",
  startLine: 1,
  endLine: 1,
  indent: 0,
  commentLeader: "//",
  signals: { flagged: false, starred: false },
  type: "todo",
  contentText: "content",
  properties: {},
  relations: [],
  canonicals: [],
  mentions: [],
  tags: [],
  raw: "// todo ::: content",
  ...overrides,
});

test("collects canonicals and edges", () => {
  const records = [
    record({ type: "tldr", canonicals: ["#docs/prd"] }),
    record({
      type: "todo",
      relations: [
        { kind: "from", token: "#docs/prd" },
        { kind: "see", token: "#perf/hotpath" },
      ],
    }),
  ];

  const graph = buildRelationGraph(records);
  expect(graph.canonicals.get("#docs/prd")?.length).toBe(1);
  expect(graph.edges).toHaveLength(2);
  expect(graph.edges[0]?.relation).toBe("from");
});
