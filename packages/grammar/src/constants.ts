// tldr ::: waymark grammar constants and blessed markers

export const SIGIL = ":::" as const;

// Signal constants
// ^ = raised (work-in-progress, branch-scoped)
// * = starred (important, high-priority)
export const SIGNALS = {
  raised: "^",
  starred: "*",
} as const;

export type MarkerCategory =
  | "work"
  | "info"
  | "caution"
  | "workflow"
  | "inquiry";

export type MarkerDefinition = {
  name: string;
  category: MarkerCategory;
  aliases?: string[];
  description?: string;
};

export const MARKER_DEFINITIONS: MarkerDefinition[] = [
  // Work/Action
  { name: "todo", category: "work", description: "Task to be completed" },
  {
    name: "fix",
    category: "work",
    aliases: ["fixme"],
    description: "Bug or issue to resolve",
  },
  { name: "wip", category: "work", description: "Work currently in progress" },
  { name: "done", category: "work", description: "Completed task" },
  {
    name: "review",
    category: "work",
    description: "Code or design needing review",
  },
  {
    name: "test",
    category: "work",
    description: "Test needed or test-related marker",
  },
  {
    name: "check",
    category: "work",
    description: "Validation or verification needed",
  },

  // Information
  {
    name: "note",
    category: "info",
    description: "General annotation or context",
  },
  {
    name: "context",
    category: "info",
    aliases: ["why"],
    description: "Explains reasoning or background",
  },
  {
    name: "tldr",
    category: "info",
    description: "File-level summary (one per file)",
  },
  { name: "about", category: "info", description: "Section/block summary" },
  {
    name: "example",
    category: "info",
    description: "Illustrative code or usage example",
  },
  {
    name: "idea",
    category: "info",
    description: "Suggestion or potential improvement",
  },
  {
    name: "comment",
    category: "info",
    description: "General comment or observation",
  },

  // Caution/Quality
  {
    name: "warn",
    category: "caution",
    description: "Warning about potential issues",
  },
  {
    name: "alert",
    category: "caution",
    description: "Important notice requiring attention",
  },
  {
    name: "deprecated",
    category: "caution",
    description: "Outdated code pending removal",
  },
  {
    name: "temp",
    category: "caution",
    aliases: ["tmp"],
    description: "Temporary code not for production",
  },
  {
    name: "hack",
    category: "caution",
    aliases: ["stub"],
    description: "Workaround or incomplete implementation",
  },

  // Workflow
  {
    name: "blocked",
    category: "workflow",
    description: "Work blocked by dependency",
  },
  {
    name: "needs",
    category: "workflow",
    description: "Requirement or dependency",
  },

  // Inquiry
  {
    name: "question",
    category: "inquiry",
    aliases: ["ask"],
    description: "Question needing answer",
  },
];

// Build a flat list of all markers including aliases for backward compatibility
// Note: "needs" and "blocks" appear in both BLESSED_MARKERS and PROPERTY_KEYS by design.
// In continuation context, the parser explicitly excludes blessed markers from being
// treated as property continuations (see parseContinuation in content.ts).
export const BLESSED_MARKERS = MARKER_DEFINITIONS.flatMap((def) => [
  def.name,
  ...(def.aliases || []),
]) as readonly string[];

// Build a map for quick lookups from any marker/alias to its definition
export const MARKER_MAP = new Map<string, MarkerDefinition>();
for (const def of MARKER_DEFINITIONS) {
  MARKER_MAP.set(def.name, def);
  for (const alias of def.aliases || []) {
    MARKER_MAP.set(alias, def);
  }
}

// Helper to get canonical type name from any alias
export function getCanonicalType(type: string): string {
  const def = MARKER_MAP.get(type.toLowerCase());
  return def?.name || type.toLowerCase();
}

// Helper to get type category
export function getTypeCategory(type: string): MarkerCategory | undefined {
  const def = MARKER_MAP.get(type.toLowerCase());
  return def?.category;
}

// Common marker names as string constants for runtime usage
export const MARKERS = {
  todo: "todo",
  fix: "fix",
  fixme: "fixme",
  wip: "wip",
  done: "done",
  review: "review",
  test: "test",
  check: "check",
  note: "note",
  context: "context",
  why: "why",
  tldr: "tldr",
  about: "about",
  example: "example",
  idea: "idea",
  comment: "comment",
  warn: "warn",
  alert: "alert",
  deprecated: "deprecated",
  temp: "temp",
  tmp: "tmp",
  hack: "hack",
  stub: "stub",
  blocked: "blocked",
  needs: "needs",
  question: "question",
  ask: "ask",
} as const;

// Known property keys that can act as pseudo-markers in continuation context
// This is the single source of truth for property keys recognized by the parser and formatter
// Note: "needs" and "blocks" appear in both BLESSED_MARKERS and PROPERTY_KEYS by design.
// When these appear in continuation context (after another waymark), they are treated as
// property continuations only if they are NOT valid blessed markers in that position.
export const PROPERTY_KEYS = new Set([
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
