// tldr ::: waymark grammar constants and blessed markers

export const SIGIL = ":::" as const;

export const SIGNALS = {
  raised: "^",
  important: "*",
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
  { name: "this", category: "info", description: "Section/block summary" },
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

// Helper to get canonical marker name from any alias
export function getCanonicalMarker(marker: string): string {
  const def = MARKER_MAP.get(marker.toLowerCase());
  return def?.name || marker.toLowerCase();
}

// Helper to get marker category
export function getMarkerCategory(marker: string): MarkerCategory | undefined {
  const def = MARKER_MAP.get(marker.toLowerCase());
  return def?.category;
}
