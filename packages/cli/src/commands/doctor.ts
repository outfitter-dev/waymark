// tldr ::: health check diagnostics validating tool and environment health #cli

import { existsSync } from "node:fs";
import { readFile, stat } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import { ANSI } from "@outfitter/cli/colors";
import { InternalError, Result } from "@outfitter/contracts";
import type { CommandContext } from "../types";
import { logger } from "../utils/logger";
import { wrap } from "../utils/theme";

// biome-ignore lint/style/noMagicNumbers: bytes per megabyte conversion
const BYTES_PER_MB = 1024 * 1024;
const MAX_INDEX_MB = 10;

// about ::: diagnostic issue severity and metadata structure
export type DiagnosticIssue = {
  severity: "error" | "warning" | "info";
  category: string;
  message: string;
  file?: string;
  line?: number;
  suggestion?: string;
};

// about ::: check result with pass/fail status and findings
export type CheckResult = {
  category: string;
  name: string;
  passed: boolean;
  issues: DiagnosticIssue[];
};

// about ::: comprehensive doctor report with summary statistics
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

// about ::: command options for doctor functionality
export type DoctorCommandOptions = {
  strict?: boolean;
  fix?: boolean;
  json?: boolean;
};

// about ::: orchestrates all diagnostic checks and returns comprehensive report
/**
 * Run the doctor diagnostics and return a report.
 * @param context - CLI context with config and logger.
 * @param options - Doctor command options.
 * @returns Result containing comprehensive doctor report or an InternalError.
 */
export function runDoctorCommand(
  context: CommandContext,
  options: DoctorCommandOptions
): Promise<Result<DoctorReport, InternalError>> {
  return Result.tryPromise({
    try: () => runDoctorCommandInner(context, options),
    catch: (cause) =>
      InternalError.create(
        `Doctor diagnostics failed: ${cause instanceof Error ? cause.message : String(cause)}`
      ),
  });
}

async function runDoctorCommandInner(
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

  const cacheChecks = await checkCacheStatus();
  checks.push(...cacheChecks);
  allIssues.push(...cacheChecks.flatMap((c) => c.issues));

  const completionChecks = checkCompletions();
  checks.push(...completionChecks);
  allIssues.push(...completionChecks.flatMap((c) => c.issues));

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

// about ::: validates configuration file existence parsing and value consistency
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
    const { typeCase, idScope } = context.config;

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
  }

  results.push({
    category: "configuration",
    name: "Configuration Health",
    passed: issues.filter((i) => i.severity === "error").length === 0,
    issues,
  });

  return results;
}

// about ::: checks git repository index files and CLI version
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

// about ::: reports cache directory and database status [[cli/doctor-cache]]
async function checkCacheStatus(): Promise<CheckResult[]> {
  const results: CheckResult[] = [];
  const issues: DiagnosticIssue[] = [];

  try {
    const cacheHome = process.env.XDG_CACHE_HOME || join(homedir(), ".cache");
    const cacheDir = join(cacheHome, "waymark");
    const cacheDb = join(cacheDir, "waymark-cache.db");

    if (!existsSync(cacheDir)) {
      issues.push({
        severity: "info",
        category: "environment",
        message: "Cache directory not found (will be created on first scan)",
        suggestion: "Run `wm find` to initialize the cache",
      });
    } else if (existsSync(cacheDb)) {
      const stats = await stat(cacheDb);
      const sizeMb = stats.size / BYTES_PER_MB;
      issues.push({
        severity: "info",
        category: "environment",
        message: `Cache database present (${sizeMb.toFixed(2)} MB)`,
        file: cacheDb,
      });
    } else {
      issues.push({
        severity: "info",
        category: "environment",
        message: "Cache directory exists but cache database is missing",
        suggestion: "Run `wm find` to populate the cache database",
      });
    }
  } catch (_error) {
    issues.push({
      severity: "warning",
      category: "environment",
      message: "Could not access cache directory",
      suggestion: "Check permissions for the cache directory",
    });
  }

  results.push({
    category: "environment",
    name: "Cache Status",
    passed: issues.filter((i) => i.severity === "error").length === 0,
    issues,
  });

  return results;
}

// about ::: reports whether shell completions are installed [[cli/doctor-completions]]
function checkCompletions(): CheckResult[] {
  const issues: DiagnosticIssue[] = [];
  const home = homedir();
  const targets = [
    {
      shell: "zsh",
      path: join(home, ".local/share/waymark/completions/wm.zsh"),
    },
    {
      shell: "bash",
      path: join(home, ".local/share/waymark/completions/wm.bash"),
    },
    {
      shell: "fish",
      path: join(home, ".config/fish/completions/wm.fish"),
    },
    {
      shell: "powershell",
      path: join(home, ".config/waymark/completions/wm.ps1"),
    },
  ];

  const installed = targets.filter((target) => existsSync(target.path));

  if (installed.length === 0) {
    issues.push({
      severity: "info",
      category: "environment",
      message: "Shell completions are not installed",
      suggestion: "Run `wm completions <shell>` and source the file",
    });
  } else {
    const shells = installed.map((target) => target.shell).join(", ");
    issues.push({
      severity: "info",
      category: "environment",
      message: `Shell completions installed for: ${shells}`,
    });
  }

  return [
    {
      category: "environment",
      name: "Shell Completions",
      passed: issues.filter((i) => i.severity === "error").length === 0,
      issues,
    },
  ];
}

// about ::: analyzes index size cache health and scan performance
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

      if (sizeMb > MAX_INDEX_MB) {
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

// about ::: renders check results with color coded severity indicators
/**
 * Format a doctor report for CLI output.
 * @param report - Doctor report to format.
 * @returns Human-readable report string.
 */
export function formatDoctorReport(report: DoctorReport): string {
  const lines: string[] = [];

  // Header
  lines.push(wrap("\nChecking waymark installation...\n", ANSI.bold));

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
      wrap(
        `${category.charAt(0).toUpperCase() + category.slice(1)}:`,
        ANSI.bold,
        ANSI.blue
      )
    );

    for (const check of checks) {
      const icon = check.passed
        ? wrap("\u2713", ANSI.green)
        : wrap("\u2717", ANSI.red);
      lines.push(`${icon} ${check.name}`);

      // Show issues
      for (const issue of check.issues) {
        const severity = formatSeverityLabel(issue.severity);

        let location = "";
        if (issue.file) {
          location = issue.line
            ? ` (${issue.file}:${issue.line})`
            : ` (${issue.file})`;
        }

        lines.push(`  ${severity}: ${issue.message}${location}`);

        if (issue.suggestion) {
          lines.push(wrap(`    \u2192 ${issue.suggestion}`, ANSI.dim));
        }
      }
    }

    lines.push(""); // Blank line between categories
  }

  // Summary
  const { summary } = report;
  if (summary.total > 0) {
    lines.push(
      wrap(
        `\nIssues found: ${wrap(`${summary.errors} errors`, ANSI.red)}, ${wrap(`${summary.warnings} warnings`, ANSI.yellow)}`,
        ANSI.bold
      )
    );

    if (!report.healthy) {
      lines.push(
        wrap("Run `wm doctor --fix` to attempt automatic repairs\n", ANSI.dim)
      );
    }
  } else {
    lines.push(wrap("\u2713 All checks passed!\n", ANSI.green, ANSI.bold));
  }

  return lines.join("\n");
}

function formatSeverityLabel(severity: DiagnosticIssue["severity"]): string {
  switch (severity) {
    case "error":
      return wrap("ERROR", ANSI.red);
    case "warning":
      return wrap("WARN", ANSI.yellow);
    case "info":
      return wrap("INFO", ANSI.blue);
    default:
      return wrap("INFO", ANSI.blue);
  }
}
