// tldr ::: relation graph helpers for waymark dependency analysis

import type { WaymarkRecord } from "@waymarks/grammar";

/** Directed relation edge between waymark records. */
export type GraphEdge = {
  from: WaymarkRecord;
  toCanonical: string;
  relation: WaymarkRecord["relations"][number]["kind"];
};

/** Graph structure derived from canonical and relation fields. */
export type WaymarkGraph = {
  canonicals: Map<string, WaymarkRecord[]>;
  edges: GraphEdge[];
};

/**
 * Build a relation graph from a list of waymark records.
 * @param records - Waymark records to analyze.
 * @returns Graph of canonicals and relation edges.
 */
export function buildRelationGraph(records: WaymarkRecord[]): WaymarkGraph {
  const canonicals = new Map<string, WaymarkRecord[]>();
  const edges: GraphEdge[] = [];

  for (const record of records) {
    for (const canonical of record.canonicals) {
      const target = canonical.toLowerCase();
      const existing = canonicals.get(target);
      if (existing) {
        existing.push(record);
      } else {
        canonicals.set(target, [record]);
      }
    }
  }

  for (const record of records) {
    for (const relation of record.relations) {
      const target = relation.token.toLowerCase();
      edges.push({
        from: record,
        toCanonical: target,
        relation: relation.kind,
      });
    }
  }

  return { canonicals, edges };
}
