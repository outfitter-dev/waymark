#!/usr/bin/env bun
// tldr ::: main orchestrator for generating shell completions from grammar

import { resolve } from "node:path";
import {
  BashGenerator,
  type CompletionGenerator,
  FishGenerator,
  getAllTypes,
  NushellGenerator,
  PowerShellGenerator,
  ZshGenerator,
} from "./generators/index.ts";

/**
 * Generate all completion files
 */
export async function generateAll(): Promise<void> {
  const types = getAllTypes();
  const options = { types };

  // Initialize all generators
  const generators: CompletionGenerator[] = [
    new NushellGenerator(options),
    new BashGenerator(options),
    new FishGenerator(options),
    new ZshGenerator(options),
    new PowerShellGenerator(options),
  ];

  // Output directory (relative to this file)
  const completionsDir = resolve(import.meta.dir, "../../completions");

  // Generate each completion file
  const results: string[] = [];
  for (const generator of generators) {
    const filename = generator.getFilename();
    const content = generator.generate();
    const filepath = resolve(completionsDir, filename);

    await Bun.write(filepath, content);
    results.push(`  - ${filename}`);
  }

  // biome-ignore lint/suspicious/noConsole: Build script output
  console.log("✅ Generated completion files:");
  for (const result of results) {
    // biome-ignore lint/suspicious/noConsole: Build script output
    console.log(result);
  }
  // biome-ignore lint/suspicious/noConsole: Build script output
  console.log(`\nTypes included: ${types.join(", ")}`);
}

// Run if executed directly
if (import.meta.main) {
  await generateAll();
}
