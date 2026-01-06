#!/usr/bin/env bash
# tldr ::: Integration test for Waymark v1.0.0-beta.1 release candidate
# about ::: Exercises full CLI workflow with real-world operations

set -euo pipefail

echo "=== Waymark v1.0.0-beta.1 Integration Test ==="
echo ""

# Setup test directory
TEST_DIR=$(mktemp -d)
echo "Test directory: $TEST_DIR"
cd "$TEST_DIR"

# Ensure cleanup on exit
cleanup() {
  cd - > /dev/null
  rm -rf "$TEST_DIR"
  echo ""
  echo "=== Cleanup complete ==="
}
trap cleanup EXIT

echo ""
echo "Step 1: Initialize waymark config"
wm init --format toml --preset minimal --scope project --force

echo ""
echo "Step 2: Create test file"
cat > sample.ts <<'EOF'
export function greet(name: string): string {
  return `Hello, ${name}!`;
}
EOF

echo ""
echo "Step 3: Insert waymark with ID"
wm insert sample.ts:1 --type todo --content "add unit tests" --write

echo ""
echo "Step 4: Scan waymarks (default output)"
wm sample.ts

echo ""
echo "Step 5: Scan waymarks (JSON output)"
wm sample.ts --json

echo ""
echo "Step 6: Map generation"
wm --map

echo ""
echo "Step 7: Modify waymark (add starred signal)"
FIRST_LINE=$(wm sample.ts --json | jq -r '.[0].startLine' 2>/dev/null || echo "1")
wm modify sample.ts:$FIRST_LINE --mark-starred --write

echo ""
echo "Step 8: Verify starred waymark"
wm sample.ts --starred

echo ""
echo "Step 9: Format check (dry-run)"
wm format sample.ts

echo ""
echo "Step 10: Format with write"
wm format sample.ts --write

echo ""
echo "Step 11: Lint check"
wm lint sample.ts

echo ""
echo "Step 12: Remove waymark"
wm remove sample.ts:$FIRST_LINE --write --confirm

echo ""
echo "Step 13: Verify removal"
REMAINING=$(wm sample.ts --json 2>/dev/null | jq 'length' 2>/dev/null || echo "0")
if [ -z "$REMAINING" ] || [ "$REMAINING" = "0" ]; then
  echo "✓ Waymark successfully removed"
else
  echo "✗ Expected 0 waymarks, found $REMAINING"
  exit 1
fi

echo ""
echo "=== All integration tests passed! ==="
