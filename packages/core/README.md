# @waymarks/core

Core waymark utilities with caching, formatting, and mutation capabilities - the opinionated layer built on top of `@waymarks/grammar`.

## Installation

```bash
bun add @waymarks/core
```

## Key Exports

### Parsing (re-exported from grammar)

- `parse()` - Parse waymark comments into structured records
- `WaymarkRecord` - TypeScript type for parsed records

### Formatting & Normalization

- `formatText()` - Format and normalize waymark syntax
- `normalizeRecord()` - Normalize a waymark record with consistent casing/structure
- `normalizeType()` - Normalize waymark type to canonical form

### Caching & Storage

- `WaymarkCache` - SQLite-backed cache for parsed records and metadata
- `JsonIdIndex` - JSON-based index for waymark IDs and history

### Mutation Operations

- `insertWaymarks()` - Insert waymarks into files with formatting
- `removeWaymarks()` - Remove waymarks by ID, location, or criteria
- `WaymarkIdManager` - ID generation and fingerprinting utilities

### Analysis & Aggregation

- `buildRelationGraph()` - Extract dependency graphs from relations
- `searchRecords()` - Filter waymarks with complex queries

### Configuration

- `loadConfigFromDisk()` - Load project/user/default configs
- `resolveConfig()` - Resolve configuration with proper precedence
- `DEFAULT_CONFIG` - Default configuration values

## Example

```typescript
import { parse, formatText, insertWaymarks, WaymarkCache } from '@waymarks/core';

// Parse waymarks
const records = parse(sourceCode, { filePath: 'src/auth.ts' });

// Format waymark text
const formatted = formatText('//todo:::implement auth', {
  typeCase: 'lowercase'
});
// Result: "// todo ::: implement auth"

// Insert waymarks
const result = await insertWaymarks({
  file: 'src/auth.ts',
  insertions: [{
    line: 42,
    type: 'todo',
    content: 'implement rate limiting',
    signals: { raised: true }
  }]
});

// Use cache for fast lookups
const cache = new WaymarkCache({ dbPath: '.waymark/cache.db' });
cache.replaceFileWaymarks('src/auth.ts', records);
const todos = cache.findByType('todo');
```

## Documentation

See the [main README](../../README.md) for comprehensive documentation and usage guides.

## License

MIT
