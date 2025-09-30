// tldr ::: help command helper for waymark CLI (legacy - migrating to help/ directory)

// Re-export from new help system
// biome-ignore lint/performance/noBarrelFile: legacy export during migration
export { displayHelp } from "./help/index.ts";
