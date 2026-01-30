// tldr ::: core type definitions for waymark grammar

/** Parsed representation of a waymark comment. */
export type WaymarkRecord = {
  file: string;
  language: string;
  fileCategory: "code" | "docs" | "config" | "data" | "test";
  startLine: number;
  endLine: number;
  indent: number;
  commentLeader: string | null;
  signals: {
    current?: boolean;
    flagged: boolean;
    starred: boolean;
  };
  type: string;
  contentText: string;
  properties: Record<string, string>;
  relations: Array<{
    kind: "see" | "docs" | "from" | "replaces";
    token: string;
  }>;
  canonicals: string[];
  mentions: string[];
  tags: string[];
  raw: string;
  codetag?: boolean;
};

/** Options that influence waymark parsing. */
export type ParseOptions = {
  file?: string;
  language?: string;
  /** Include waymarks inside wm:ignore fences (default: false). */
  includeIgnored?: boolean;
  /** Comment leaders to use for parsing. When provided, only these leaders
   *  are recognized. Typically sourced from LanguageRegistry for the file type. */
  leaders?: readonly string[];
};
