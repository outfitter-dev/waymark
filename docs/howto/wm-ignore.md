<!-- tldr ::: guide for excluding waymark examples in documentation using ignore fences #docs/howto -->

# Ignoring Waymarks in Documentation

When writing documentation that includes waymark examples, you don't want those examples polluting your scan results. The `wm:ignore` fence attribute lets you mark code blocks as documentation-only.

## The Problem

Documentation files often contain waymark examples. Consider a markdown file with:

````text
```typescript
// todo ::: implement validation
```
````

Without special handling, `wm find` would report this example as a real waymark, cluttering your results with false positives.

## The Solution: `wm:ignore`

Add `wm:ignore` to any markdown code fence's info string to exclude its contents from parsing:

````text
```typescript wm:ignore
// todo ::: this is just an example
// fix ::: not a real waymark
```
````

The parser skips all waymark detection inside `wm:ignore` fences.

## Syntax

The attribute goes in the fence info string after the language:

```text
```<language> wm:ignore [other-attributes]
```

**Examples**:

````markdown
```typescript wm:ignore
// example waymarks here
```

```python wm:ignore
# also works for Python
```

```go wm:ignore title="Example"
// works with other attributes too
```
````

**Case insensitive**: `wm:ignore`, `WM:IGNORE`, and `WM:Ignore` all work.

**Position flexible**: Can appear anywhere in the info string:

````markdown
```typescript title="example" wm:ignore highlight={1}
// still ignored
```
````

## Fence Matching

The parser tracks backtick counts to handle nested fences correctly:

`````markdown
````typescript wm:ignore
Some content with a nested fence:
```bash
echo "this is inside the ignored block"
```
More content still ignored.
````
`````

A fence closes when it encounters the same (or more) backticks with no info string.

## Inspecting Ignored Waymarks

Sometimes you need to verify what's inside ignored fences. Use the `--include-ignored` flag:

```bash
# Normal scan (excludes wm:ignore content)
wm find docs/ --json | jq length
# → 5

# Include ignored fences for inspection
wm find docs/ --include-ignored --json | jq length
# → 47
```

### Configuration

You can also set this in your config file:

```yaml
# .waymark/config.yaml
scan:
  includeIgnored: true  # default: false
```

## When to Use

**Use `wm:ignore` for**:

- Documentation with waymark syntax examples
- Tutorial code showing waymark patterns
- Test fixtures in markdown
- README examples

**Don't use `wm:ignore` for**:

- Real code with waymarks you want tracked
- Suppressing waymarks you should fix (just fix them)

## Migration

If you have existing documentation with example waymarks, find high-density files:

```bash
# Find files with many waymarks (likely docs with examples)
wm find docs/ --json | jq -r '
  group_by(.file) |
  map({file: .[0].file, count: length}) |
  sort_by(-.count) |
  .[:10] |
  .[] | "\(.count)\t\(.file)"
'
```

Then add `wm:ignore` to the code fences in those files.

## See Also

- [Grammar Reference](../GRAMMAR.md) - Full waymark syntax specification
- [CLI Commands](../cli/commands.md) - Command-line reference
