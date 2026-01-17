<!-- tldr ::: schema references for waymark JSON inputs and outputs -->

# Schema Reference

Waymark JSON payloads are validated against schema files in `schemas/`.
Use these schemas when producing or consuming structured output.

## Core Schemas

- `schemas/waymark-record.schema.json` - Waymark record output
- `schemas/scan-result.schema.json` - Scan output
- `schemas/lint-report.schema.json` - Lint output
- `schemas/doctor-report.schema.json` - Doctor output

## Add Input

Insertions accept either a single object or an array. Fields:

```json
{
  "file": "src/auth.ts",
  "line": 42,
  "type": "todo",
  "content": "implement OAuth",
  "mentions": ["@agent"],
  "tags": ["#sec"],
  "properties": { "owner": "@alice" }
}
```

## Remove Input

Removal accepts `file`/`line` or `id`:

```json
{ "file": "src/auth.ts", "line": 42 }
{ "id": "[[a3k9m2p]]" }
```

## Graph Output

Graph mode emits edges:

```json
{ "source": "src/a.ts", "target": "#auth", "relation": "see" }
```

## Notes

- Use `--json` for arrays and `--jsonl` for streaming output.
- Always validate generated JSON against the schema for CI.
