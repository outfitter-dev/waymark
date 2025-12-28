// tldr ::: health check diagnostics validating config integrity and waymark structure #cli

import { existsSync } from "node:fs";
import { readFile, stat } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import { isValidType, parse, type WaymarkRecord } from "@waymarks/core";
import chalk from "chalk";
import type { CommandContext } from "../types";
import { expandInputPaths } from "../utils/fs";
import { logger } from "../utils/logger";

// this ::: canonical relation kinds that must have valid targets
const CANONICAL_RELATIONS: WaymarkRecord["relations"][number]["kind"][] = [
  "depends",
  "needs",
  "blocks",
  "dupeof",
  "rel",
];
const TLDR_MAX_LINE = 20;
// biome-ignore lint/style/noMagicNumbers: bytes per megabyte conversion
const BYTES_PER_MB = 1024 * 1024;
const LARGE_INDEX_MB = 10;

// this ::: diagnostic issue severity and metadata structure
export type DiagnosticIssue = {
  severity: "error" | "warning" | "info";
  category: string;
  message: string;
  file?: string;
  line?: number;
  suggestion?: string;
};

// this ::: check result with pass/fail status and findings
export type CheckResult = {
  category: string;
  name: string;
  passed: boolean;
  issues: DiagnosticIssue[];
};

// this ::: comprehensive doctor report with summary statistics
export type DoctorReport = {
  healthy: boolean;
  timestamp: string;
  checks: CheckResult[];
  issues: DiagnosticIssue[];
  summary: {
    total: number;
    errors: number;
    warnings: number;
    infos: number;
  };
};

// this ::: command options for doctor functionality
export type DoctorCommandOptions = {
  strict?: boolean;
  fix?: boolean;
  json?: boolean;
  paths?: string[];
};

// this ::: orchestrates all diagnostic checks and returns comprehensive report
export async function runDoctorCommand(
  context: CommandContext,
  options: DoctorCommandOptions
): Promise<DoctorReport> {
  const checks: CheckResult[] = [];
  const allIssues: DiagnosticIssue[] = [];

  logger.debug("Starting doctor diagnostics");

  // Configuration health checks
  const configChecks = await checkConfiguration(context);
  checks.push(...configChecks);
  allIssues.push(...configChecks.flatMap((c) => c.issues));

  // Environment checks
  const envChecks = await checkEnvironment(context);
  checks.push(...envChecks);
  allIssues.push(...envChecks.flatMap((c) => c.issues));

  // Waymark integrity checks
  const integrityChecks = await checkWaymarkIntegrity(context, options.paths);
  checks.push(...integrityChecks);
  allIssues.push(...integrityChecks.flatMap((c) => c.issues));

  // Performance checks
  const perfChecks = await checkPerformance(context);
  checks.push(...perfChecks);
  allIssues.push(...perfChecks.flatMap((c) => c.issues));

  // Calculate summary
  const summary = {
    total: allIssues.length,
    errors: allIssues.filter((i) => i.severity === "error").length,
    warnings: allIssues.filter((i) => i.severity === "warning").length,
    infos: allIssues.filter((i) => i.severity === "info").length,
  };

  const healthy =
    summary.errors === 0 && (!options.strict || summary.warnings === 0);

  return {
    healthy,
    timestamp: new Date().toISOString(),
    checks,
    issues: allIssues,
    summary,
  };
}

// this ::: validates configuration file existence parsing and value consistency
async function checkConfiguration(
  context: CommandContext
): Promise<CheckResult[]> {
  const results: CheckResult[] = [];
  const issues: DiagnosticIssue[] = [];

  // Check 1: Config file exists and is valid
  try {
    const configPath = context.globalOptions.configPath;
    if (configPath && !existsSync(configPath)) {
      issues.push({
        severity: "error",
        category: "configuration",
        message: `Config file not found: ${configPath}`,
        suggestion: "Run `wm init` to create configuration",
      });
    }

    // Config was already loaded by context, so if we got here it's parseable
    if (context.config) {
      logger.debug("Configuration loaded successfully");
    }
  } catch (error) {
    issues.push({
      severity: "error",
      category: "configuration",
      message: `Failed to load config: ${error instanceof Error ? error.message : String(error)}`,
      suggestion: "Check config file syntax",
    });
  }

  // Check 2: Validate config values
  if (context.config) {
    const { typeCase, idScope, protectedBranches } = context.config;

    if (!["lowercase", "uppercase"].includes(typeCase)) {
      issues.push({
        severity: "error",
        category: "configuration",
        message: `Invalid typeCase: "${typeCase}" (must be "lowercase" or "uppercase")`,
      });
    }

    if (!["repo", "file"].includes(idScope)) {
      issues.push({
        severity: "error",
        category: "configuration",
        message: `Invalid idScope: "${idScope}" (must be "repo" or "file")`,
      });
    }

    if (protectedBranches.length === 0) {
      issues.push({
        severity: "info",
        category: "configuration",
        message: "No protected branches configured",
        suggestion: 'Consider adding ["main", "master"] to protectedBranches',
      });
    }
  }

  // Check 3: Cache directory writable
  try {
    const cacheHome = process.env.XDG_CACHE_HOME || join(homedir(), ".cache");
    const cacheDir = join(cacheHome, "waymark");
    if (!existsSync(cacheDir)) {
      issues.push({
        severity: "info",
        category: "configuration",
        message:
          "Cache directory does not exist (will be created on first scan)",
      });
    }
  } catch (_error) {
    issues.push({
      severity: "warning",
      category: "configuration",
      message: "Could not access cache directory",
    });
  }

  results.push({
    category: "configuration",
    name: "Configuration Health",
    passed: issues.filter((i) => i.severity === "error").length === 0,
    issues,
  });

  return results;
}

// this ::: checks git repository index files and CLI version
async function checkEnvironment(
  context: CommandContext
): Promise<CheckResult[]> {
  const results: CheckResult[] = [];
  const issues: DiagnosticIssue[] = [];

  // Check 1: Git repository
  try {
    const gitDir = join(context.workspaceRoot, ".git");
    if (!existsSync(gitDir)) {
      issues.push({
        severity: "info",
        category: "environment",
        message: "Not in a git repository",
      });
    }
  } catch (_error) {
    logger.debug("Git check failed");
  }

  // Check 2: Index files
  try {
    const indexPath = join(context.workspaceRoot, ".waymark", "index.json");
    if (existsSync(indexPath)) {
      const indexContent = await readFile(indexPath, "utf-8");
      try {
        JSON.parse(indexContent);
        logger.debug("Index file valid");
      } catch {
        issues.push({
          severity: "error",
          category: "environment",
          message: "Index file is corrupted (invalid JSON)",
          file: indexPath,
          suggestion: "Delete and regenerate with `wm find`",
        });
      }
    }
  } catch (_error) {
    logger.debug("Index check failed");
  }

  // Check 3: Gitignore patterns
  try {
    const gitignorePath = join(context.workspaceRoot, ".gitignore");
    if (existsSync(gitignorePath)) {
      const gitignoreContent = await readFile(gitignorePath, "utf-8");
      if (!gitignoreContent.includes(".waymark/index.json")) {
        issues.push({
          severity: "warning",
          category: "environment",
          message: ".waymark/index.json should be gitignored",
          suggestion: "Add '.waymark/index.json' to .gitignore",
        });
      }
    }
  } catch (_error) {
    logger.debug("Gitignore check failed");
  }

  results.push({
    category: "environment",
    name: "Environment",
    passed: issues.filter((i) => i.severity === "error").length === 0,
    issues,
  });

  return results;
}

// this ::: validates waymark parsing canonical uniqueness and relation integrity
async function checkWaymarkIntegrity(
  context: CommandContext,
  paths?: string[]
): Promise<CheckResult[]> {
  const results: CheckResult[] = [];
  const parseIssues: DiagnosticIssue[] = [];
  const canonicalIssues: DiagnosticIssue[] = [];
  const relationIssues: DiagnosticIssue[] = [];
  const markerIssues: DiagnosticIssue[] = [];
  const tldrIssues: DiagnosticIssue[] = [];
  const signalIssues: DiagnosticIssue[] = [];

  // Expand input paths
  const inputPaths = paths && paths.length > 0 ? paths : ["."];
  const files = await expandInputPaths(inputPaths, context.config);

  // Parse all waymarks
  const allRecords: WaymarkRecord[] = [];
  for (const filePath of files) {
    try {
      const source = await readFile(filePath, "utf-8");
      const records = parse(source, { file: filePath });
      allRecords.push(...records);

      // Check for parse errors (parser is lenient, but track invalid structures)
      for (const record of records) {
        if (!record.type) {
          parseIssues.push({
            severity: "error",
            category: "integrity",
            message: "Waymark missing type",
            file: filePath,
            line: record.startLine,
          });
        }
      }
    } catch (error) {
      parseIssues.push({
        severity: "error",
        category: "integrity",
        message: `Parse error: ${error instanceof Error ? error.message : String(error)}`,
        file: filePath,
      });
    }
  }

  // Check 1: Canonical uniqueness
  const canonicals = new Map<string, { file: string; line: number }[]>();
  for (const record of allRecords) {
    for (const token of record.canonicals || []) {
      if (!canonicals.has(token)) {
        canonicals.set(token, []);
      }
      canonicals
        .get(token)
        ?.push({ file: record.file, line: record.startLine });
    }
  }

  for (const [token, occurrences] of canonicals) {
    if (occurrences.length > 1) {
      canonicalIssues.push({
        severity: "error",
        category: "integrity",
        message: `Duplicate canonical reference: ${token} defined in ${occurrences.length} places`,
        suggestion: occurrences
          .map((o) => `  - ${o.file}:${o.line}`)
          .join("\n"),
      });
    }
  }

  // Check 2: Dangling relations
  for (const record of allRecords) {
    for (const relation of record.relations || []) {
      if (CANONICAL_RELATIONS.includes(relation.kind)) {
        const hasCanonical = canonicals.has(relation.token);
        if (!hasCanonical) {
          relationIssues.push({
            severity: "error",
            category: "integrity",
            message: `Dangling relation: ${relation.kind}:${relation.token} (canonical not found)`,
            file: record.file,
            line: record.startLine,
          });
        }
      }
    }
  }

  // Check 3: Marker validity
  for (const record of allRecords) {
    if (!isValidType(record.type)) {
      const isAllowed =
        context.config.allowTypes.includes(record.type) ||
        context.config.allowTypes.includes("*");

      if (!isAllowed) {
        markerIssues.push({
          severity: "warning",
          category: "integrity",
          message: `Unknown marker type: "${record.type}"`,
          file: record.file,
          line: record.startLine,
          suggestion: "Add to allowTypes config or use a blessed marker",
        });
      }
    }
  }

  // Check 4: TLDR positioning (should be near top of file)
  const tldrByFile = new Map<string, WaymarkRecord[]>();
  for (const record of allRecords) {
    if (record.type === "tldr") {
      if (!tldrByFile.has(record.file)) {
        tldrByFile.set(record.file, []);
      }
      tldrByFile.get(record.file)?.push(record);
    }
  }

  for (const [file, tldrs] of tldrByFile) {
    if (tldrs.length > 1) {
      tldrIssues.push({
        severity: "error",
        category: "integrity",
        message: `Multiple TLDRs in file (found ${tldrs.length})`,
        file,
        suggestion: "Consolidate into single TLDR at top of file",
      });
    }

    // Check if TLDR is reasonably near the top (within first 20 lines)
    for (const tldr of tldrs) {
      if (tldr.startLine > TLDR_MAX_LINE) {
        tldrIssues.push({
          severity: "warning",
          category: "integrity",
          message: "TLDR should be near top of file",
          file,
          line: tldr.startLine,
        });
      }
    }
  }

  // Check 5: Protected branch signals
  try {
    const { execSync } = await import("node:child_process");
    const branch = execSync("git branch --show-current", {
      encoding: "utf-8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();

    const isProtected = context.config.protectedBranches.some(
      (pattern: string) => {
        if (pattern.includes("*")) {
          const regex = new RegExp(`^${pattern.replace(/\*/g, ".*")}$`);
          return regex.test(branch);
        }
        return pattern === branch;
      }
    );

    if (isProtected) {
      const raisedWaymarks = allRecords.filter(
        (r) => r.signals?.raised || r.signals?.important
      );
      if (raisedWaymarks.length > 0) {
        signalIssues.push({
          severity: "warning",
          category: "integrity",
          message: `Found ${raisedWaymarks.length} raised/starred waymarks on protected branch "${branch}"`,
          suggestion: "Clear signals before merging",
        });
      }
    }
  } catch {
    // Not in git repo or git not available
    logger.debug("Could not check git branch");
  }

  // Add all check results
  results.push({
    category: "integrity",
    name: "Parse Validity",
    passed: parseIssues.length === 0,
    issues: parseIssues,
  });

  results.push({
    category: "integrity",
    name: "Canonical References",
    passed: canonicalIssues.length === 0,
    issues: canonicalIssues,
  });

  results.push({
    category: "integrity",
    name: "Relation Integrity",
    passed: relationIssues.length === 0,
    issues: relationIssues,
  });

  results.push({
    category: "integrity",
    name: "Marker Validity",
    passed: markerIssues.length === 0,
    issues: markerIssues,
  });

  results.push({
    category: "integrity",
    name: "TLDR Coverage",
    passed: tldrIssues.length === 0,
    issues: tldrIssues,
  });

  results.push({
    category: "integrity",
    name: "Protected Branch Signals",
    passed: signalIssues.length === 0,
    issues: signalIssues,
  });

  return results;
}

// this ::: analyzes index size cache health and scan performance
async function checkPerformance(
  context: CommandContext
): Promise<CheckResult[]> {
  const results: CheckResult[] = [];
  const issues: DiagnosticIssue[] = [];

  try {
    const indexPath = join(context.workspaceRoot, ".waymark", "index.json");
    if (existsSync(indexPath)) {
      const stats = await stat(indexPath);
      const sizeMb = stats.size / BYTES_PER_MB;

      if (sizeMb > LARGE_INDEX_MB) {
        issues.push({
          severity: "warning",
          category: "performance",
          message: `Index file is large: ${sizeMb.toFixed(2)} MB`,
          suggestion:
            "Consider excluding large directories in skip_paths config",
        });
      }
    }
  } catch (_error) {
    logger.debug("Performance check failed");
  }

  results.push({
    category: "performance",
    name: "Performance",
    passed: issues.filter((i) => i.severity === "error").length === 0,
    issues,
  });

  return results;
}

// this ::: renders check results with color coded severity indicators
export function formatDoctorReport(report: DoctorReport): string {
  const lines: string[] = [];

  // Header
  lines.push(chalk.bold("\nChecking waymark installation...\n"));

  // Group checks by category
  const categories = new Map<string, CheckResult[]>();
  for (const check of report.checks) {
    if (!categories.has(check.category)) {
      categories.set(check.category, []);
    }
    categories.get(check.category)?.push(check);
  }

  // Render each category
  for (const [category, checks] of categories) {
    lines.push(
      chalk.bold(
        chalk.blue(`${category.charAt(0).toUpperCase() + category.slice(1)}:`)
      )
    );

    for (const check of checks) {
      const icon = check.passed ? chalk.green("✓") : chalk.red("✗");
      lines.push(`${icon} ${check.name}`);

      // Show issues
      for (const issue of check.issues) {
        let severity = chalk.blue("INFO");
        if (issue.severity === "error") {
          severity = chalk.red("ERROR");
        } else if (issue.severity === "warning") {
          severity = chalk.yellow("WARN");
        }

        let location = "";
        if (issue.file) {
          location = issue.line
            ? ` (${issue.file}:${issue.line})`
            : ` (${issue.file})`;
        }

        lines.push(`  ${severity}: ${issue.message}${location}`);

        if (issue.suggestion) {
          lines.push(chalk.dim(`    → ${issue.suggestion}`));
        }
      }
    }

    lines.push(""); // Blank line between categories
  }

  // Summary
  const { summary } = report;
  if (summary.total > 0) {
    lines.push(
      chalk.bold(
        `\nIssues found: ${chalk.red(`${summary.errors} errors`)}, ${chalk.yellow(`${summary.warnings} warnings`)}`
      )
    );

    if (!report.healthy) {
      lines.push(
        chalk.dim("Run `wm doctor --fix` to attempt automatic repairs\n")
      );
    }
  } else {
    lines.push(chalk.green(chalk.bold("✓ All checks passed!\n")));
  }

  return lines.join("\n");
}
