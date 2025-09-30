// tldr ::: type definitions for CLI help system

export type FlagConfig = {
  name: string;
  alias?: string;
  type?: "boolean" | "string";
  description: string;
  placeholder?: string;
};

export type CommandExample = string;

export type CommandConfig = {
  name: string;
  usage: string;
  description: string;
  flags?: FlagConfig[];
  examples?: CommandExample[];
};

export type HelpRegistry = Record<string, CommandConfig>;
