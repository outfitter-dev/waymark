// tldr ::: long format display for waymark records showing all properties

import type { WaymarkRecord } from "@waymarks/core";
import { sanitizeInlineText } from "../sanitize";

/**
 * Format records with long display (all properties shown).
 * @param records - Records to format.
 * @returns Long formatted output string.
 */
export function formatLong(records: WaymarkRecord[]): string {
  const lines: string[] = [];

  for (const record of records) {
    lines.push(`${record.file}:${record.startLine}`);
    lines.push(`  Type: ${record.type}`);
    lines.push(
      `  Signals: flagged=${record.signals.flagged}, starred=${record.signals.starred}`
    );
    lines.push(`  Content: ${sanitizeInlineText(record.contentText)}`);

    if (Object.keys(record.properties).length > 0) {
      lines.push("  Properties:");
      for (const [key, value] of Object.entries(record.properties)) {
        lines.push(
          `    ${sanitizeInlineText(key)}: ${sanitizeInlineText(value)}`
        );
      }
    }

    if (record.relations.length > 0) {
      lines.push("  Relations:");
      for (const rel of record.relations) {
        lines.push(
          `    ${sanitizeInlineText(rel.kind)}: ${sanitizeInlineText(rel.token)}`
        );
      }
    }

    if (record.mentions.length > 0) {
      lines.push(
        `  Mentions: ${record.mentions
          .map((mention) => sanitizeInlineText(mention))
          .join(", ")}`
      );
    }

    if (record.tags.length > 0) {
      lines.push(
        `  Tags: ${record.tags
          .map((tag) => sanitizeInlineText(tag))
          .join(", ")}`
      );
    }

    lines.push(""); // Blank line between records
  }

  return lines.join("\n");
}
