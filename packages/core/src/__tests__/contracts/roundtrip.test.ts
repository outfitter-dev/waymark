// tldr ::: parse/format roundtrip contract for waymark grammar

import { describe, expect, it } from "bun:test";
import { parse, type WaymarkRecord } from "@waymarks/grammar";
import { formatText } from "../../format.ts";

const SOURCE = [
  "// TODO  ::: Review docs see:Alpha priority:high #perf @alice",
  "//       ::: follow up with docs:Spec",
].join("\n");

function pickRecord(record: WaymarkRecord) {
  return {
    type: record.type,
    contentText: record.contentText,
    properties: record.properties,
    relations: record.relations,
    canonicals: record.canonicals,
    mentions: record.mentions,
    tags: record.tags,
    signals: record.signals,
    commentLeader: record.commentLeader,
  };
}

describe("parse/format roundtrip", () => {
  it("preserves record semantics after formatting", () => {
    const options = { file: "src/roundtrip.ts" };
    const original = parse(SOURCE, options).map(pickRecord);
    const { formattedText } = formatText(SOURCE, options);
    const formatted = parse(formattedText, options).map(pickRecord);

    expect(formatted).toEqual(original);

    const { formattedText: formattedAgain } = formatText(
      formattedText,
      options
    );
    expect(formattedAgain).toBe(formattedText);
  });
});
