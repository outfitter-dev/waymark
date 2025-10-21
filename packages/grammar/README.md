# @waymarks/grammar

Minimal, stable grammar parser for waymark syntax - the foundational parsing layer for the Waymark ecosystem.

## Installation

```bash
bun add @waymarks/grammar
```

## Key Exports

- `parse()` - Parse waymark comments from source text into structured records
- `parseLine()` - Parse a single line into a waymark record
- `isValidType()` - Validate waymark type against blessed markers
- `WaymarkRecord` - TypeScript type for parsed waymark records
- `ParseOptions` - Configuration options for parsing behavior
- `BLESSED_MARKERS` - Array of officially supported waymark types
- `MARKERS` - Rich marker definitions with metadata and categories
- `SIGIL` - The `:::` sigil constant
- `SIGNALS` - Signal prefix constants (`^` for raised, `*` for important)

## Example

```typescript
import { parse, type WaymarkRecord } from '@waymarks/grammar';

const sourceCode = `
// todo ::: implement rate limiting
// *fix ::: validate email format #security
// tldr ::: user authentication service ref:#auth/service
`;

const records: WaymarkRecord[] = parse(sourceCode, {
  language: 'typescript',
  filePath: 'src/auth.ts'
});

// records[0] = {
//   file: 'src/auth.ts',
//   language: 'ts',
//   startLine: 2,
//   type: 'todo',
//   contentText: 'implement rate limiting',
//   signals: { raised: false, important: false },
//   ...
// }
```

## Documentation

See the [main README](../../README.md) for comprehensive documentation and the [Waymark specification](../../docs/GRAMMAR.md) for grammar details.

## License

MIT
