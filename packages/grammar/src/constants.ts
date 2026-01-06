// tldr ::: waymark grammar constants and blessed markers

export const SIGIL = ":::" as const;

// Signal constants
// ~ = flagged (actively in-progress, branch-scoped)
// * = starred (important, high-priority)
export const SIGNALS = {
  flagged: "~",
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
  { name: "fix", category: "work", description: "Bug or issue to resolve" },
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
    description: "Temporary code not for production",
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
  { name: "ask", category: "inquiry", description: "Question needing answer" },
];

// Build a flat list of all blessed markers
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
  wip: "wip",
  done: "done",
  review: "review",
  test: "test",
  check: "check",
  note: "note",
  context: "context",
  tldr: "tldr",
  about: "about",
  example: "example",
  idea: "idea",
  comment: "comment",
  warn: "warn",
  alert: "alert",
  deprecated: "deprecated",
  temp: "temp",
  blocked: "blocked",
  needs: "needs",
  ask: "ask",
} as const;

// Known property keys that can act as pseudo-markers in continuation context
// This is the single source of truth for property keys recognized by the parser and formatter
export const PROPERTY_KEYS = new Set([
  // Relation keys (see, docs, from, replaces)
  "see",
  "docs",
  "from",
  "replaces",
  // Canonical anchor key
  "ref",
  // Other property keys
  "owner",
  "since",
  "fixes",
  "affects",
  "priority",
  "status",
  "sym",
]);
