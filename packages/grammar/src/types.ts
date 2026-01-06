// tldr ::: core type definitions for waymark grammar

export type WaymarkRecord = {
  file: string;
  language: string;
  fileCategory: "code" | "docs" | "config" | "data" | "test";
  startLine: number;
  endLine: number;
  indent: number;
  commentLeader: string | null;
  signals: {
    /** @deprecated use `flagged` */
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
  legacy?: boolean;
};

export type ParseOptions = {
  file?: string;
  language?: string;
};
