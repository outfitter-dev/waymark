<!-- tldr ::: cache schema versioning and migration strategy documentation -->

# Cache Schema Migration Strategy

## Overview

The Waymark cache uses SQLite to store parsed waymark records and metadata for fast retrieval. When breaking schema changes are needed (e.g., column renames, type changes), the cache is automatically invalidated and regenerated from source files.

## Schema Versioning

- **Current Version**: `CACHE_SCHEMA_VERSION = 2` (defined in `schema.ts`)
- **Storage**: Version stored in `cache_metadata` table with key `schema_version`
- **Detection**: On cache initialization, current schema version is compared against stored version

## Migration Strategy

### Invalidation on Version Mismatch

When the stored schema version doesn't match the current version, the cache is invalidated:

1. All existing tables are dropped (`DROP TABLE IF EXISTS ...`)
2. Fresh schema is created with current version
3. Cache will be repopulated from source files on next scan

This approach is chosen because:

- Caches are ephemeral and regenerated from source files
- Simpler than complex column rename logic
- Ensures clean state without schema artifacts
- Fast regeneration from source (< 1s for typical repos)

### Version History

| Version | Date       | Changes                                     |
| ------- | ---------- | ------------------------------------------- |
| 1       | 2025-09-30 | Initial schema with `marker` column        |
| 2       | 2025-10-07 | Renamed `marker` → `type` column            |

## Implementation

### Schema Version Constants

```typescript
// Increment when making breaking schema changes
export const CACHE_SCHEMA_VERSION = 2;
```

### Version Detection

```typescript
export function getSchemaVersion(db: Database): number {
  // Returns 0 for fresh database, stored version otherwise
}
```

### Cache Invalidation

```typescript
export function invalidateCache(db: Database): void {
  // Drops all cache tables
}
```

### Automatic Migration

```typescript
export function createSchema(db: Database): void {
  const currentVersion = getSchemaVersion(db);
  if (currentVersion !== 0 && currentVersion !== CACHE_SCHEMA_VERSION) {
    invalidateCache(db); // Drop old schema
  }
  // Create fresh schema with current version
}
```

## Developer Guidelines

### Making Breaking Schema Changes

1. **Increment version**: Update `CACHE_SCHEMA_VERSION` in `schema.ts`
2. **Document change**: Add entry to version history table above
3. **Update schema**: Modify table creation in `createSchema()`
4. **Add tests**: Ensure migration logic works correctly
5. **Update TLDR**: Note schema version in commit message

### Non-Breaking Changes

For backward-compatible additions (new columns with defaults):

1. Use `ensureWaymarkRecordColumns()` for column additions
2. No version increment needed
3. Cache data preserved across restarts

### Testing Migration

```typescript
test("schema migration invalidates cache on version mismatch", () => {
  // Create old schema with version N
  // Insert test data
  // Run createSchema() (triggers migration)
  // Verify old data removed
  // Verify new schema correct
});
```

## User Impact

- **Automatic**: Users don't need to manually clear caches
- **Transparent**: Cache regeneration happens on first scan after upgrade
- **Fast**: Typical repos rebuild cache in < 1 second
- **Safe**: No risk of corrupted data from schema mismatches

## Future Considerations

If migration complexity increases, consider:

- Add migration functions per version (v1→v2, v2→v3, etc.)
- Preserve cache data when possible (ALTER TABLE)
- Add migration telemetry/logging

Current invalidation strategy is sufficient for v1.0 scope.
