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
    /** @deprecated use `raised` */
    current?: boolean;
    raised: boolean;
    important: boolean;
  };
  type: string;
  contentText: string;
  properties: Record<string, string>;
  relations: Array<{
    kind: "ref" | "rel" | "depends" | "needs" | "blocks" | "dupeof";
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
