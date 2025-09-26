// tldr ::: waymark grammar constants and blessed markers

export const SIGIL = ":::" as const;

export const SIGNALS = {
  current: "*",
  important: "!",
} as const;

export const BLESSED_MARKERS = [
  // Work/Action
  "todo",
  "fix",
  "fixme",
  "wip",
  "done",
  "review",
  "test",
  "check",
  // Information
  "note",
  "context",
  "why",
  "tldr",
  "this",
  "example",
  "idea",
  // Caution/Quality
  "warn",
  "alert",
  "deprecated",
  "temp",
  "tmp",
  "hack",
  "stub",
  // Workflow
  "blocked",
  "needs",
  // Inquiry
  "question",
  "ask",
] as const;
