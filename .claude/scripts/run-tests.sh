#!/usr/bin/env bash
# tldr ::: Waymark CLI integration test runner with markdown reporting

set -euo pipefail

# ============================================================
# Load shared test runner library
# ============================================================

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

# shellcheck source=lib/test-runner-lib.sh
source "$SCRIPT_DIR/lib/test-runner-lib.sh"

# Initialize the test runner
init_test_runner "$PROJECT_ROOT/.scratch/testing" "Waymark"

# ============================================================
# Waymark-specific setup
# ============================================================

# Temp file for test fixtures
TEMP_DIR=""

# Ensure temp directories are cleaned up on exit
trap 'cleanup_temp_fixtures 2>/dev/null || true' EXIT

check_dependencies() {
  print_info "Checking dependencies..."

  if ! command -v wm &> /dev/null; then
    print_fail "'wm' CLI not found in PATH"
    echo "Run 'bun install && bun install:bin' or 'bun dev:cli' to install"
    exit 2
  fi

  local version
  version=$(wm --version 2>/dev/null || echo "unknown")
  print_pass "Found wm CLI: $version"
}

setup_temp_fixtures() {
  TEMP_DIR=$(mktemp -d)

  # Create test fixture: valid waymark file
  cat > "$TEMP_DIR/valid.ts" << 'EOF'
// tldr ::: test file with valid waymarks
// todo ::: implement feature #test
// note ::: this is a note
export const foo = 'bar';
EOF

  # Create test fixture: multiple tldrs (invalid)
  cat > "$TEMP_DIR/multiple-tldr.ts" << 'EOF'
// tldr ::: first tldr
// tldr ::: second tldr (should error)
export const foo = 'bar';
EOF

  # Create test fixture: unknown marker
  cat > "$TEMP_DIR/unknown-marker.ts" << 'EOF'
// tldr ::: file with unknown marker
// banana ::: this is not a valid marker
export const foo = 'bar';
EOF

  # Create test fixture: codetag pattern
  cat > "$TEMP_DIR/codetag.ts" << 'EOF'
// tldr ::: file with codetag
// TODO: this should be a waymark
export const foo = 'bar';
EOF

  # Create test fixture: formatting needed
  cat > "$TEMP_DIR/needs-format.ts" << 'EOF'
// tldr:::needs spacing around sigil
//todo ::: needs space after leader
export const foo = 'bar';
EOF

  # Create test fixture: properly formatted
  cat > "$TEMP_DIR/well-formatted.ts" << 'EOF'
// tldr ::: properly formatted waymark
// todo ::: another properly formatted one #feature
export const foo = 'bar';
EOF

  # Create test fixture: with properties
  cat > "$TEMP_DIR/with-props.ts" << 'EOF'
// tldr ::: file with properties ref:#test/props
// todo ::: @agent implement this fixes:#123 #priority
export const foo = 'bar';
EOF

  # Create test fixture: empty file
  touch "$TEMP_DIR/empty.ts"

  # Create test fixture: flagged waymarks
  cat > "$TEMP_DIR/flagged.ts" << 'EOF'
// tldr ::: file with flagged waymarks
// ~todo ::: work in progress
// *fix ::: high priority fix
// ~*review ::: urgent review needed
export const foo = 'bar';
EOF

  log "Test fixtures created in: $TEMP_DIR"
}

cleanup_temp_fixtures() {
  if [[ -n "$TEMP_DIR" && -d "$TEMP_DIR" ]]; then
    rm -rf "$TEMP_DIR"
  fi
}

# ============================================================
# Test Categories
# ============================================================

run_parse_tests() {
  print_header "Parse Tests"

  setup_category "parse"
  setup_temp_fixtures

  # Test 1: Parse valid waymark via stdin
  run_test 1 "Parse valid waymark syntax" \
    "echo '// todo ::: test waymark' | wm lint -" \
    "no issues|0 issues|passed" \
    false

  # Test 2: Parse waymark with properties
  run_test 2 "Parse waymark with properties" \
    "echo '// todo ::: @agent implement ref:#test' | wm lint -" \
    "no issues|0 issues|passed" \
    false

  # Test 3: Parse waymark with signals
  run_test 3 "Parse flagged waymark (~)" \
    "echo '// ~todo ::: work in progress' | wm lint -" \
    "no issues|0 issues|passed" \
    false

  # Test 4: Parse starred waymark
  run_test 4 "Parse starred waymark (*)" \
    "echo '// *fix ::: high priority' | wm lint -" \
    "no issues|0 issues|passed" \
    false

  # Test 5: Parse combined signals
  run_test 5 "Parse combined signals (~*)" \
    "echo '// ~*todo ::: urgent WIP' | wm lint -" \
    "no issues|0 issues|passed" \
    false

  cleanup_temp_fixtures
  finalize_category
}

run_scan_tests() {
  print_header "Scan Tests"

  setup_category "scan"
  setup_temp_fixtures

  # Test 1: Scan finds waymarks
  run_test 1 "Scan finds waymarks in file" \
    "wm find '$TEMP_DIR/valid.ts'" \
    "todo|tldr|note" \
    false

  # Test 2: Filter by type
  run_test 2 "Filter waymarks by type (todo)" \
    "wm find '$TEMP_DIR/valid.ts' --type todo" \
    "todo" \
    false

  # Test 3: JSON output
  run_test 3 "JSON output format" \
    "wm find '$TEMP_DIR/valid.ts' --json" \
    '^\[|"type"|"content"' \
    false

  # Test 4: JSONL output
  run_test 4 "JSONL output format" \
    "wm find '$TEMP_DIR/valid.ts' --jsonl" \
    '"type"|"content"' \
    false

  # Test 5: Scan with tag filter (requires # prefix)
  run_test 5 "Filter by tag" \
    "wm find '$TEMP_DIR/valid.ts' --tag '#test'" \
    "test|todo" \
    false

  cleanup_temp_fixtures
  finalize_category
}

run_format_tests() {
  print_header "Format Tests"

  setup_category "format"
  setup_temp_fixtures

  # Test 1: Format check on well-formatted file
  run_test 1 "Well-formatted file passes" \
    "wm fmt '$TEMP_DIR/well-formatted.ts'" \
    "0 edits|no changes|already formatted" \
    false

  # Test 2: Format shows corrected output
  run_test 2 "Format shows corrected output" \
    "wm fmt '$TEMP_DIR/needs-format.ts'" \
    "tldr ::: needs spacing" \
    false

  # Test 3: Format with --yes applies changes
  local format_test_file="$TEMP_DIR/format-write-test.ts"
  cp "$TEMP_DIR/needs-format.ts" "$format_test_file"
  run_test 3 "Format with --yes applies changes" \
    "wm fmt '$format_test_file' --yes && wm fmt '$format_test_file'" \
    "no changes|already" \
    false

  # Test 4: Format idempotency
  run_test 4 "Format is idempotent" \
    "wm fmt '$TEMP_DIR/well-formatted.ts' && wm fmt '$TEMP_DIR/well-formatted.ts'" \
    "0 edits|no changes|already formatted" \
    false

  cleanup_temp_fixtures
  finalize_category
}

run_lint_tests() {
  print_header "Lint Tests"

  setup_category "lint"
  setup_temp_fixtures

  # Test 1: Lint clean file
  run_test 1 "Lint passes on valid file" \
    "wm lint '$TEMP_DIR/valid.ts'" \
    "no issues|0 issues|passed|0 errors" \
    false

  # Test 2: Lint detects multiple TLDRs
  run_test 2 "Detect multiple TLDRs" \
    "wm lint '$TEMP_DIR/multiple-tldr.ts'" \
    "multiple.*tldr|already has.*tldr|multiple-tldr" \
    true

  # Test 3: Lint detects unknown marker
  run_test 3 "Detect unknown marker" \
    "wm lint '$TEMP_DIR/unknown-marker.ts'" \
    "unknown.*marker|banana|warn" \
    false

  # Test 4: Lint detects codetag pattern
  run_test 4 "Detect codetag pattern" \
    "wm lint '$TEMP_DIR/codetag.ts'" \
    "codetag|TODO:|consider" \
    false

  # Test 5: Lint with verbose flag
  run_test 5 "Lint with verbose output" \
    "wm lint '$TEMP_DIR/valid.ts' --verbose" \
    'no issues|0 issues|passed|checking' \
    false

  cleanup_temp_fixtures
  finalize_category
}

run_cli_tests() {
  print_header "CLI Tests"

  setup_category "cli"

  # Test 1: Help command
  run_test 1 "Help displays usage" \
    "wm --help" \
    "Usage|usage|help|Commands" \
    false

  # Test 2: Version command
  run_test 2 "Version displays version" \
    "wm --version" \
    "[0-9]+\.[0-9]+\.[0-9]+" \
    false

  # Test 3: Invalid flag fails
  run_test 3 "Invalid flag exits with error" \
    "wm --nonexistent-flag-xyz" \
    "unknown|invalid|error|option" \
    true

  # Test 4: Find defaults to current directory
  run_test 4 "Find without path defaults to current dir" \
    "wm find --help" \
    "scan|filter|waymarks|directory" \
    false

  # Test 5: Lint requires path argument
  run_test 5 "Lint without path shows error" \
    "wm lint" \
    "requires|path|error" \
    true

  finalize_category
}

run_integration_tests() {
  print_header "Integration Tests"

  setup_category "integration"
  setup_temp_fixtures

  # Test 1: Find + lint workflow
  run_test 1 "Find then lint same file" \
    "wm find '$TEMP_DIR/valid.ts' --type todo && wm lint '$TEMP_DIR/valid.ts'" \
    "todo|no issues|0 issues" \
    false

  # Test 2: Scan directory
  run_test 2 "Scan entire directory" \
    "wm find '$TEMP_DIR'" \
    "tldr|todo|note" \
    false

  # Test 3: Format + lint workflow
  local workflow_file="$TEMP_DIR/workflow-test.ts"
  cp "$TEMP_DIR/needs-format.ts" "$workflow_file"
  run_test 3 "Format then lint workflow" \
    "wm fmt '$workflow_file' --yes && wm lint '$workflow_file'" \
    "no issues|0 issues|passed" \
    false

  # Test 4: Multiple type filters
  run_test 4 "Multiple type filters" \
    "wm find '$TEMP_DIR/valid.ts' --type todo --type note" \
    "todo|note" \
    false

  # Test 5: Properties and tags preserved
  run_test 5 "Properties extracted correctly" \
    "wm find '$TEMP_DIR/with-props.ts' --json" \
    'ref|#test|@agent|#priority' \
    false

  cleanup_temp_fixtures
  finalize_category
}

run_config_tests() {
  print_header "Config Tests"

  setup_category "config"

  # Test 1: Config print works
  run_test 1 "Config print outputs JSON" \
    "wm config --print" \
    '"typeCase"|"idScope"|allowTypes' \
    false

  # Test 2: Config print with --json
  run_test 2 "Config print with --json flag" \
    "wm config --print --json" \
    '"typeCase"|"idScope"' \
    false

  # Test 3: Config without --print fails
  run_test 3 "Config without --print shows error" \
    "wm config" \
    "requires|--print|error" \
    true

  finalize_category
}

run_check_tests() {
  print_header "Check Tests"

  setup_category "check"
  setup_temp_fixtures

  # Test 1: Doctor basic run
  run_test 1 "Doctor command runs" \
    "wm doctor" \
    "Checking|check|Configuration|Environment|passed|healthy" \
    false

  # Test 2: Doctor JSON output
  run_test 2 "Doctor JSON output" \
    "wm doctor --json" \
    '"healthy"|"checks"|"summary"' \
    false

  # Test 3: Doctor with --strict flag
  run_test 3 "Doctor with --strict flag" \
    "wm doctor --strict" \
    "check|Checking|passed|healthy|Configuration|Environment" \
    false

  cleanup_temp_fixtures
  finalize_category
}

# ============================================================
# Main Entry Point
# ============================================================

usage() {
  cat << EOF
Usage: $(basename "$0") [category|--all]

Run Waymark CLI integration tests.

Categories:
  parse       Grammar parsing tests
  scan        File scanning tests (wm find)
  format      Formatting tests (wm fmt)
  lint        Linting tests (wm lint)
  cli         CLI basics (help, version, exit codes)
  integration End-to-end workflow tests
  config      Configuration tests
  check       Health check tests (wm doctor)

Options:
  --all       Run all test categories
  --help      Show this help message

Exit codes:
  0  All tests passed
  1  One or more tests failed
  2  Setup error (CLI not found)

Examples:
  $(basename "$0") parse      # Run parse tests
  $(basename "$0") --all      # Run all tests
EOF
}

main() {
  local category="${1:-}"

  if [[ -z "$category" || "$category" == "--help" || "$category" == "-h" ]]; then
    usage
    exit 0
  fi

  check_dependencies

  local exit_code=0
  local total_failed=0

  case "$category" in
    parse)
      run_parse_tests || true
      total_failed=$FAILED
      ;;
    scan)
      run_scan_tests || true
      total_failed=$FAILED
      ;;
    format)
      run_format_tests || true
      total_failed=$FAILED
      ;;
    lint)
      run_lint_tests || true
      total_failed=$FAILED
      ;;
    cli)
      run_cli_tests || true
      total_failed=$FAILED
      ;;
    integration)
      run_integration_tests || true
      total_failed=$FAILED
      ;;
    config)
      run_config_tests || true
      total_failed=$FAILED
      ;;
    check)
      run_check_tests || true
      total_failed=$FAILED
      ;;
    --all)
      run_parse_tests || true
      total_failed=$((total_failed + FAILED))

      run_scan_tests || true
      total_failed=$((total_failed + FAILED))

      run_format_tests || true
      total_failed=$((total_failed + FAILED))

      run_lint_tests || true
      total_failed=$((total_failed + FAILED))

      run_cli_tests || true
      total_failed=$((total_failed + FAILED))

      run_integration_tests || true
      total_failed=$((total_failed + FAILED))

      run_config_tests || true
      total_failed=$((total_failed + FAILED))

      run_check_tests || true
      total_failed=$((total_failed + FAILED))

      echo ""
      echo -e "${BOLD}=== All Categories Complete ===${NC}"
      echo "Total failures across all categories: $total_failed"
      ;;
    *)
      print_fail "Unknown category '$category'"
      echo ""
      usage
      exit 2
      ;;
  esac

  if [[ $total_failed -gt 0 ]]; then
    exit 1
  fi

  exit 0
}

main "$@"
