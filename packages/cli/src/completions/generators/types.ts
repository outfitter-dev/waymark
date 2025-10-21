// tldr ::: shared types for shell completion generators

/**
 * Interface that all completion generators must implement
 */
export type CompletionGenerator = {
  /**
   * Generate the completion script content
   */
  generate(): string;

  /**
   * Get the output filename for this generator
   */
  getFilename(): string;
};

/**
 * Shell type discriminator
 */
export type ShellType = "nushell" | "bash" | "fish" | "zsh" | "powershell";

/**
 * Common options for all generators
 */
export type GeneratorOptions = {
  /** All waymark types including aliases */
  types: readonly string[];
};
