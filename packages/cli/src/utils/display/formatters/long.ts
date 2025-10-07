// tldr ::: long format display for waymark records showing all properties

import type { WaymarkRecord } from "@waymarks/core";

/**
 * Format records with long display (all properties shown)
 */
export function formatLong(records: WaymarkRecord[]): string {
  const lines: string[] = [];

  for (const record of records) {
    lines.push(`${record.file}:${record.startLine}`);
    lines.push(`  Type: ${record.type}`);
    lines.push(
      `  Signals: raised=${record.signals.raised}, starred=${record.signals.important}`
    );
    lines.push(`  Content: ${record.contentText}`);

    if (Object.keys(record.properties).length > 0) {
      lines.push("  Properties:");
      for (const [key, value] of Object.entries(record.properties)) {
        lines.push(`    ${key}: ${value}`);
      }
    }

    if (record.relations.length > 0) {
      lines.push("  Relations:");
      for (const rel of record.relations) {
        lines.push(`    ${rel.kind}: ${rel.token}`);
      }
    }

    if (record.mentions.length > 0) {
      lines.push(`  Mentions: ${record.mentions.join(", ")}`);
    }

    if (record.tags.length > 0) {
      lines.push(`  Tags: ${record.tags.join(", ")}`);
    }

    lines.push(""); // Blank line between records
  }

  return lines.join("\n");
}
