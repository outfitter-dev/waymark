// tldr ::: content segment processing and continuation handling for waymark grammar

import { BLESSED_MARKERS, SIGIL } from "./constants";
import {
  extractMentions,
  extractPropertiesAndRelations,
  extractTags,
} from "./properties";
import type { WaymarkRecord } from "./types";

const LEADING_SPACES_REGEX = /^\s+/;
const HTML_COMMENT_CLOSE_REGEX = /\s*-->\s*$/;

// Known property keys that can act as pseudo-markers in continuation context
const PROPERTY_KEYS = new Set([
  "ref",
  "rel",
  "depends",
  "needs",
  "blocks",
  "dupeof",
  "owner",
  "since",
  "fixes",
  "affects",
  "priority",
  "status",
]);

export type ContentSegment = {
  text: string;
  closes: boolean;
};

export type ContinuationResult = {
  type: "text" | "property";
  content: string;
  propertyKey?: string;
  propertyValue?: string;
};

export function stripHtmlCommentClosure(
  content: string,
  commentLeader: string
): string {
  if (commentLeader === "<!--") {
    return content.replace(HTML_COMMENT_CLOSE_REGEX, "");
  }
  return content;
}

export function processContentSegment(
  segment: string,
  commentLeader: string
): ContentSegment {
  let working = segment;

  working = working.replace(LEADING_SPACES_REGEX, "");
  working = stripHtmlCommentClosure(working, commentLeader);

  let closes = false;
  const closingIndex = working.lastIndexOf(SIGIL);
  if (closingIndex >= 0) {
    const afterSigil = working.slice(closingIndex + SIGIL.length).trim();
    if (afterSigil.length === 0 || afterSigil === "-->") {
      closes = true;
      working = working.slice(0, closingIndex);
    }
  }

  working = stripHtmlCommentClosure(working, commentLeader);

  return {
    text: working.trim(),
    closes,
  };
}

export function parseContinuation(
  line: string,
  commentLeader: string,
  inWaymarkContext: boolean
): ContinuationResult | null {
  const trimmed = line.trimStart();
  if (!trimmed.startsWith(commentLeader)) {
    return null;
  }

  const afterLeader = trimmed.slice(commentLeader.length);

  // Check if this line contains ::: (the sigil)
  const sigilIndex = afterLeader.indexOf(SIGIL);
  if (sigilIndex === -1) {
    return null;
  }

  // Only process markerless ::: if we're in waymark context
  if (!inWaymarkContext) {
    return null;
  }

  const beforeSigil = afterLeader.slice(0, sigilIndex).trim();
  const afterSigil = afterLeader.slice(sigilIndex + SIGIL.length);

  // Check if this is a property-as-marker pattern
  if (beforeSigil.length > 0 && !beforeSigil.includes(" ")) {
    const lowerKey = beforeSigil.toLowerCase();

    // CRITICAL: Check if it's a blessed marker first - if so, it's NOT a continuation
    // This prevents markers like 'needs' and 'blocks' from being treated as property continuations
    if (
      BLESSED_MARKERS.includes(lowerKey as (typeof BLESSED_MARKERS)[number])
    ) {
      return null;
    }

    // Check if it's a known property key
    if (PROPERTY_KEYS.has(lowerKey)) {
      // This is a property continuation
      const strippedValue = stripHtmlCommentClosure(afterSigil, commentLeader);
      const propertyValue = strippedValue.trim();
      return {
        type: "property",
        content: propertyValue,
        propertyKey: lowerKey,
        propertyValue,
      };
    }
  }

  // If beforeSigil is empty or just whitespace, it's a text continuation
  if (beforeSigil.length === 0) {
    return {
      type: "text",
      content: afterSigil,
    };
  }

  // Otherwise, this line has a marker and shouldn't be treated as a continuation
  return null;
}

export function analyzeContent(content: string): {
  properties: Record<string, string>;
  relations: WaymarkRecord["relations"];
  canonicals: string[];
  mentions: string[];
  tags: string[];
} {
  const { properties, relations, canonicals } =
    extractPropertiesAndRelations(content);
  const mentions = extractMentions(content);
  const tags = extractTags(content);

  return {
    properties,
    relations,
    canonicals,
    mentions,
    tags,
  };
}
