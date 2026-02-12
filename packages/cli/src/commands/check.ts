// tldr ::: cross-file content integrity validation for waymarks

import { ANSI } from "@outfitter/cli/colors";
import { InternalError, Result } from "@outfitter/contracts";
import { parse, type WaymarkRecord } from "@waymarks/core";
import type { CommandContext } from "../types.ts";
import { expandInputPaths } from "../utils/fs.ts";
import { wrap } from "../utils/theme.ts";

// about ::: threshold for TLDR position warning (lines from top)
const TLDR_TOP_LINES_MAX = 20;

// about ::: max length for content preview in suggestions
const CONTENT_PREVIEW_LENGTH = 50;

// about ::: relation kinds that must reference existing canonicals
const CANONICAL_RELATIONS: WaymarkRecord["relations"][number]["kind"][] = [
  "from",
  "replaces",
  "see",
  "docs",
];

/**
 * Severity levels for check issues.
 */
export type CheckSeverity = "error" | "warning";

/**
 * A single issue found during content integrity checking.
 */
export type CheckIssue = {
  file: string;
  line?: number;
  rule: string;
  severity: CheckSeverity;
  message: string;
  suggestion?: string;
};

/**
 * Report containing all check results.
 */
export type CheckReport = {
  issues: CheckIssue[];
  summary: {
    total: number;
    errors: number;
    warnings: number;
  };
  passed: boolean;
};

/**
 * Command options for the check command.
 */
export type CheckCommandOptions = {
  paths?: string[];
  strict?: boolean;
  fix?: boolean;
  json?: boolean;
};

// about ::: builds map of canonical tokens to their locations
function buildCanonicalMap(
  records: WaymarkRecord[]
): Map<string, { file: string; line: number }[]> {
  const canonicals = new Map<string, { file: string; line: number }[]>();
  for (const record of records) {
    for (const token of record.canonicals || []) {
      if (!canonicals.has(token)) {
        canonicals.set(token, []);
      }
      canonicals
        .get(token)
        ?.push({ file: record.file, line: record.startLine });
    }
  }
  return canonicals;
}

// about ::: checks for duplicate canonical references across files
function checkDuplicateCanonicals(
  canonicals: Map<string, { file: string; line: number }[]>
): CheckIssue[] {
  const issues: CheckIssue[] = [];

  for (const [token, occurrences] of canonicals) {
    if (occurrences.length > 1) {
      const firstOccurrence = occurrences[0];
      const locations = occurrences
        .map((o) => `${o.file}:${o.line}`)
        .join(", ");
      const issue: CheckIssue = {
        file: firstOccurrence?.file ?? "unknown",
        rule: "duplicate-canonical",
        severity: "error",
        message: `Duplicate canonical reference: ${token} defined in ${occurrences.length} places`,
        suggestion: `Remove duplicates. Found at: ${locations}`,
      };
      if (firstOccurrence?.line !== undefined) {
        issue.line = firstOccurrence.line;
      }
      issues.push(issue);
    }
  }

  return issues;
}

// about ::: checks if a relation token should skip canonical validation
function shouldSkipCanonicalValidation(token: string): boolean {
  // ID references (wrapped in [[...]]) reference by ID, not canonical
  const isIdReference = token.startsWith("[[") && token.endsWith("]]");
  // URLs are external references, not canonicals
  const isUrl = token.startsWith("http://") || token.startsWith("https://");
  return isIdReference || isUrl;
}

// about ::: creates a dangling relation issue
function createDanglingRelationIssue(
  record: WaymarkRecord,
  relation: { kind: string; token: string }
): CheckIssue {
  return {
    file: record.file,
    line: record.startLine,
    rule: "dangling-relation",
    severity: "error",
    message: `Dangling relation: ${relation.kind}:${relation.token} (canonical not found)`,
    suggestion: `Add a waymark with ref:${relation.token} or remove this relation`,
  };
}

// about ::: checks for relations pointing to non-existent canonicals
function checkDanglingRelations(
  records: WaymarkRecord[],
  canonicals: Map<string, { file: string; line: number }[]>
): CheckIssue[] {
  const issues: CheckIssue[] = [];

  for (const record of records) {
    for (const relation of record.relations || []) {
      if (!CANONICAL_RELATIONS.includes(relation.kind)) {
        continue;
      }
      if (shouldSkipCanonicalValidation(relation.token)) {
        continue;
      }

      if (!canonicals.has(relation.token)) {
        issues.push(createDanglingRelationIssue(record, relation));
      }
    }
  }

  return issues;
}

// about ::: groups TLDR records by file
function groupTldrsByFile(
  records: WaymarkRecord[]
): Map<string, WaymarkRecord[]> {
  const tldrByFile = new Map<string, WaymarkRecord[]>();
  for (const record of records) {
    if (record.type === "tldr") {
      if (!tldrByFile.has(record.file)) {
        tldrByFile.set(record.file, []);
      }
      tldrByFile.get(record.file)?.push(record);
    }
  }
  return tldrByFile;
}

// about ::: creates issue for multiple TLDRs in a file
function createMultipleTldrIssue(
  file: string,
  tldrs: WaymarkRecord[]
): CheckIssue {
  const secondTldr = tldrs[1];
  const issue: CheckIssue = {
    file,
    rule: "multiple-tldr",
    severity: "error",
    message: `Multiple TLDRs in file (found ${tldrs.length})`,
    suggestion: "Consolidate into single TLDR at top of file",
  };
  if (secondTldr?.startLine !== undefined) {
    issue.line = secondTldr.startLine;
  }
  return issue;
}

// about ::: creates issue for TLDR not at top of file
function createTldrPositionIssue(
  file: string,
  tldr: WaymarkRecord
): CheckIssue {
  return {
    file,
    line: tldr.startLine,
    rule: "tldr-position",
    severity: "warning",
    message: `TLDR should be near top of file (found at line ${tldr.startLine}, expected within first ${TLDR_TOP_LINES_MAX} lines)`,
    suggestion: "Move TLDR to top of file after shebang/frontmatter",
  };
}

// about ::: checks that TLDRs are positioned near the top of files
function checkTldrPositioning(records: WaymarkRecord[]): CheckIssue[] {
  const issues: CheckIssue[] = [];
  const tldrByFile = groupTldrsByFile(records);

  for (const [file, tldrs] of tldrByFile) {
    if (tldrs.length > 1) {
      issues.push(createMultipleTldrIssue(file, tldrs));
    }

    for (const tldr of tldrs) {
      if (tldr.startLine > TLDR_TOP_LINES_MAX) {
        issues.push(createTldrPositionIssue(file, tldr));
      }
    }
  }

  return issues;
}

// about ::: truncates content for display in suggestions
function truncateContent(content: string): string {
  if (content.length <= CONTENT_PREVIEW_LENGTH) {
    return content;
  }
  return `${content.slice(0, CONTENT_PREVIEW_LENGTH)}...`;
}

// about ::: checks for flagged (~) signals that should be cleared before merge
function checkSignalHygiene(records: WaymarkRecord[]): CheckIssue[] {
  const issues: CheckIssue[] = [];

  for (const record of records) {
    if (record.signals.flagged) {
      const preview = truncateContent(record.contentText);
      issues.push({
        file: record.file,
        line: record.startLine,
        rule: "flagged-signal",
        severity: "warning",
        message: `Flagged waymark (~${record.type}) should be cleared before merging`,
        suggestion: `Remove the ~ signal or complete the work: ${preview}`,
      });
    }
  }

  return issues;
}

// about ::: extracts error message from unknown error
function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

// about ::: creates a file read error issue
function createFileReadError(filePath: string, error: unknown): CheckIssue {
  return {
    file: filePath,
    rule: "file-read-error",
    severity: "error",
    message: `File read error: ${getErrorMessage(error)}`,
  };
}

// about ::: creates a parse error issue
function createParseError(filePath: string, error: unknown): CheckIssue {
  return {
    file: filePath,
    rule: "parse-error",
    severity: "error",
    message: `Parse error: ${getErrorMessage(error)}`,
  };
}

// about ::: reads and parses a single file, returning records or an error issue
async function parseFile(
  filePath: string
): Promise<{ records: WaymarkRecord[] } | { error: CheckIssue }> {
  let source: string;
  try {
    source = await Bun.file(filePath).text();
  } catch (error) {
    return { error: createFileReadError(filePath, error) };
  }

  try {
    const records = parse(source, { file: filePath });
    return { records };
  } catch (error) {
    return { error: createParseError(filePath, error) };
  }
}

// about ::: parses all files and collects waymark records
async function parseFiles(
  paths: string[],
  context: CommandContext
): Promise<{ records: WaymarkRecord[]; parseErrors: CheckIssue[] }> {
  const records: WaymarkRecord[] = [];
  const parseErrors: CheckIssue[] = [];

  const inputPaths = paths.length > 0 ? paths : ["."];
  const files = await expandInputPaths(inputPaths, context.config);

  for (const filePath of files) {
    const result = await parseFile(filePath);
    if ("error" in result) {
      parseErrors.push(result.error);
    } else {
      records.push(...result.records);
    }
  }

  return { records, parseErrors };
}

/**
 * Run content integrity checks on waymarks.
 * @param context - CLI context with config.
 * @param options - Check command options.
 * @returns Result containing check report or an InternalError.
 */
export function runCheckCommand(
  context: CommandContext,
  options: CheckCommandOptions
): Promise<Result<CheckReport, InternalError>> {
  return Result.tryPromise({
    try: () => runCheckCommandInner(context, options),
    catch: (cause) =>
      InternalError.create(
        `Check failed: ${cause instanceof Error ? cause.message : String(cause)}`
      ),
  });
}

async function runCheckCommandInner(
  context: CommandContext,
  options: CheckCommandOptions
): Promise<CheckReport> {
  const { records, parseErrors } = await parseFiles(
    options.paths ?? [],
    context
  );

  const issues: CheckIssue[] = [...parseErrors];

  // Build canonical map for relation checks
  const canonicals = buildCanonicalMap(records);

  // Run all checks
  issues.push(...checkDuplicateCanonicals(canonicals));
  issues.push(...checkDanglingRelations(records, canonicals));
  issues.push(...checkTldrPositioning(records));
  issues.push(...checkSignalHygiene(records));

  // Calculate summary
  const errors = issues.filter((i) => i.severity === "error").length;
  const warnings = issues.filter((i) => i.severity === "warning").length;

  // Determine pass/fail based on strict mode
  const passed = options.strict ? errors === 0 && warnings === 0 : errors === 0;

  return {
    issues,
    summary: {
      total: issues.length,
      errors,
      warnings,
    },
    passed,
  };
}

// about ::: formats severity label with color
function formatSeverityLabel(severity: CheckSeverity): string {
  return severity === "error"
    ? wrap("error", ANSI.red)
    : wrap("warn", ANSI.yellow);
}

// about ::: formats a single issue for CLI output
function formatIssue(issue: CheckIssue): string {
  const location = issue.line ? `${issue.file}:${issue.line}` : issue.file;
  const severity = formatSeverityLabel(issue.severity);
  let output = `${location} ${severity} ${issue.rule}: ${issue.message}`;
  if (issue.suggestion) {
    output += `\n  ${wrap(`-> ${issue.suggestion}`, ANSI.dim)}`;
  }
  return output;
}

/**
 * Format check report for human-readable CLI output.
 * @param report - Check report to format.
 * @returns Formatted output string.
 */
export function formatCheckReport(report: CheckReport): string {
  if (report.issues.length === 0) {
    return wrap("check: all integrity checks passed", ANSI.green);
  }

  const lines: string[] = [];

  for (const issue of report.issues) {
    lines.push(formatIssue(issue));
  }

  lines.push("");

  const errorText =
    report.summary.errors === 1 ? "1 error" : `${report.summary.errors} errors`;
  const warningText =
    report.summary.warnings === 1
      ? "1 warning"
      : `${report.summary.warnings} warnings`;

  if (report.summary.errors > 0 && report.summary.warnings > 0) {
    lines.push(
      wrap(
        `check: ${wrap(errorText, ANSI.red)}, ${wrap(warningText, ANSI.yellow)}`,
        ANSI.bold
      )
    );
  } else if (report.summary.errors > 0) {
    lines.push(wrap(`check: ${wrap(errorText, ANSI.red)}`, ANSI.bold));
  } else {
    lines.push(wrap(`check: ${wrap(warningText, ANSI.yellow)}`, ANSI.bold));
  }

  return lines.join("\n");
}
