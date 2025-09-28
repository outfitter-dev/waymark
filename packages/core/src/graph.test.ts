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
  signals: { current: false, important: false },
  marker: "todo",
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
    record({ marker: "tldr", canonicals: ["#docs/prd"] }),
    record({
      marker: "todo",
      relations: [
        { kind: "depends", token: "#docs/prd" },
        { kind: "rel", token: "#perf/hotpath" },
      ],
    }),
  ];

  const graph = buildRelationGraph(records);
  expect(graph.canonicals.get("#docs/prd")?.length).toBe(1);
  expect(graph.edges).toHaveLength(2);
  expect(graph.edges[0]?.relation).toBe("depends");
});
