// tldr ::: docstring type definitions

export type DocstringKind = "file" | "function";
export type DocstringFormat = "jsdoc" | "python" | "ruby" | "rust";

export type DocstringInfo = {
  language: string;
  kind: DocstringKind;
  format: DocstringFormat;
  raw: string;
  content: string;
  startLine: number;
  endLine: number;
};
