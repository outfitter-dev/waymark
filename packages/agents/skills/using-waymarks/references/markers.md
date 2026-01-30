<!-- tldr ::: complete waymark marker reference with categories and aliases -->

# Waymark Markers Reference

Markers categorize waymark intent. This reference covers all blessed markers with their categories, aliases, and usage guidance.

## Work / Action Markers

These markers indicate tasks and actions to be taken.

### `todo`

Task to complete.

```typescript wm:ignore
// todo ::: implement user validation
// todo ::: @agent add rate limiting #sec
```

### `fix` (alias: `fixme`)

Bug to address.

```typescript wm:ignore
// fix ::: memory leak in connection pool
// fixme ::: handle null case in parser
```

### `wip`

Work in progress. Indicates incomplete code.

```typescript wm:ignore
// wip ::: implementing OAuth flow
// wip ::: refactoring database layer
```

### `done`

Completed task. Temporary handoff marker, typically removed after acknowledgment.

```typescript wm:ignore
// done ::: implemented caching layer
// done ::: fixed authentication bug
```

### `review`

Needs code review.

```typescript wm:ignore
// review ::: check edge cases in validation
// review ::: @alice verify security implications
```

### `test`

Needs testing.

```typescript wm:ignore
// test ::: add unit tests for edge cases
// test ::: needs integration testing
```

### `check`

Needs verification.

```typescript wm:ignore
// check ::: verify performance under load
// check ::: confirm compatibility with v2 API
```

## Information Markers

These markers provide context and documentation.

### `note`

General observation or information.

```typescript wm:ignore
// note ::: tokens expire after 24 hours
// note ::: assumes UTC timestamps
```

### `context` (alias: `why`)

Background or reasoning for a decision.

```typescript wm:ignore
// context ::: using polling because webhooks unreliable
// why ::: disabled retry logic per compliance requirement
```

### `tldr`

File-level summary. **One per file, at top.**

```typescript wm:ignore
// tldr ::: authentication service with JWT tokens
// tldr ::: Stripe webhook handler verifying signatures
```

**Special rules:**

- First waymark in file (after shebang/frontmatter)
- Exactly one per file
- 8-14 words, active voice

### `about`

Section or block summary. Describes the code immediately following.

```typescript wm:ignore
// about ::: validates webhook signatures before processing
export function verifyWebhook() {}

// about ::: manages database connection pooling
class ConnectionPool {}
```

**Special rules:**

- Place directly above the construct it describes
- Multiple allowed per file
- Local scope (do not restate file-level TLDR)

### `example`

Usage example.

```typescript wm:ignore
// example ::: cache.get("user:123") returns User or null
// example ::: call with { retries: 3 } for automatic retry
```

### `idea`

Suggestion or potential improvement.

```typescript wm:ignore
// idea ::: could use Redis for distributed caching
// idea ::: consider splitting into microservices
```

### `comment`

General commentary.

```typescript wm:ignore
// comment ::: this approach chosen for simplicity
// comment ::: inherited from legacy codebase
```

## Caution / Quality Markers

These markers flag potential issues or quality concerns.

### `warn`

Warning about behavior or usage.

```typescript wm:ignore
// warn ::: not thread-safe, use mutex for concurrent access
// warn ::: modifies input array in place
```

### `alert`

Critical attention needed.

```typescript wm:ignore
// alert ::: security-critical code path
// alert ::: changes here affect billing calculations
```

### `deprecated`

Outdated code scheduled for removal.

```typescript wm:ignore
// deprecated ::: use AuthV2 service instead
// deprecated ::: will be removed in v3.0
```

### `temp` (alias: `tmp`)

Temporary code that should be removed.

```typescript wm:ignore
// temp ::: hardcoded for demo, needs config
// tmp ::: remove after feature flag rollout
```

### `hack` (alias: `stub`)

Workaround or temporary solution.

```typescript wm:ignore
// hack ::: workaround for upstream bug #1234
// stub ::: placeholder until API is ready
```

## Workflow Markers

These markers indicate workflow state.

### `blocked`

Cannot proceed due to external dependency.

```typescript wm:ignore
// blocked ::: waiting for API approval from partner
// blocked ::: depends on database migration
```

### `needs`

Dependency or requirement.

```typescript wm:ignore
// needs ::: database migration before enabling
// needs ::: approval from security team
```

## Inquiry Markers

### `question` (alias: `ask`)

Question or uncertainty needing clarification.

```typescript wm:ignore
// question ::: should we retry on 429 responses?
// ask ::: is this the correct business logic?
```

## Signal Combinations

Any marker can be combined with signals:

```typescript wm:ignore
// *fix ::: critical security vulnerability
// ~todo ::: refactoring in progress
// ~*fix ::: urgent bug I am actively working on
```

## Custom Markers

Custom markers are allowed but require configuration:

```yaml
allow_types:
  - todo
  - fix
  - note
  - mycustom
```

Without allowlisting, unknown markers trigger lint warnings.

## Marker Selection Guide

| Situation | Marker |
|-----------|--------|
| Task to implement | `todo` |
| Bug to fix | `fix` |
| Active work | `wip` |
| File purpose | `tldr` |
| Function/class purpose | `about` |
| General info | `note` |
| Reasoning | `context` |
| Potential issue | `warn` |
| Critical path | `alert` |
| Old code | `deprecated` |
| Temporary solution | `temp` or `hack` |
| Waiting on something | `blocked` |
| Needs something | `needs` |
| Uncertainty | `question` |
