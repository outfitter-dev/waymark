import { lintFiles } from "./packages/cli/src/commands/lint";
import { resolveConfig } from "@waymarks/config";
import { writeFile, unlink } from "node:fs/promises";

const source = ["// todooo ::: typo marker", "// todo ::: ok"].join("\n");
const tempFile = "/tmp/waymark-test-lint.ts";

await writeFile(tempFile, source);

const config = resolveConfig();
const report = await lintFiles(
  [tempFile],
  config.allowTypes,
  config
);

console.log("Number of issues:", report.issues.length);
console.log("Issues:", JSON.stringify(report.issues, null, 2));

await unlink(tempFile);
