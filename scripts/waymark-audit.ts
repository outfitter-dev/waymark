#!/usr/bin/env bun
// tldr ::: developer helper to run common ripgrep audits for waymarks #scripts/audit

import { spawn } from "bun";

const audits = {
  all: "rg ':::'",
  tldr: "rg ':::\\s*!?tldr'",
  agents: "rg ':::\\s*@agent'",
  hotpath: "rg '#perf:hotpath|#hotpath'",
} as const;

type AuditName = keyof typeof audits;

const choice = (process.argv[2] ?? "all") as AuditName;
const command = audits[choice];

if (!command) {
  console.error(
    `Unknown audit '${choice}'. Choose one of: ${Object.keys(audits).join(", ")}`
  );
  process.exit(1);
}

console.log(`Running: ${command}`);
await spawn(["bash", "-lc", command], {
  stdio: ["inherit", "inherit", "inherit"],
}).exited;
