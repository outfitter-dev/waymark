// tldr ::: barrel file exporting all completion generators

// biome-ignore lint/performance/noBarrelFile: Intentional export aggregation for generator types
export { BashGenerator } from "./bash.ts";
export { FishGenerator } from "./fish.ts";
export { NushellGenerator } from "./nushell.ts";
export { PowerShellGenerator } from "./powershell.ts";
export type {
  CompletionGenerator,
  GeneratorOptions,
  ShellType,
} from "./types.ts";
export { getAllTypes, getTypesString } from "./utils.ts";
export { ZshGenerator } from "./zsh.ts";
