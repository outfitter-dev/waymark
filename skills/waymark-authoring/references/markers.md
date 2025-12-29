# Waymark Markers Reference

Complete list of blessed markers with usage guidance.

## Work / Action Markers

### `todo`

Tasks to complete.

```javascript
// todo ::: implement input validation
// todo ::: @agent add error handling for edge cases
// *todo ::: critical feature needed for launch
```

**When to use:** New features, improvements, follow-up work.

### `fix`

Bugs or issues to address.

```javascript
// fix ::: memory leak when processing large files
// fix ::: race condition in concurrent requests
// *fix ::: security vulnerability in auth flow
```

**When to use:** Known bugs, incorrect behavior, regressions.

### `wip`

Work in progress.

```javascript
// wip ::: refactoring authentication module
// wip ::: migrating to new API version
```

**When to use:** Partially complete work, ongoing changes. Clear before merging.

### `done`

Completed work (temporary marker).

```javascript
// done ::: implemented caching layer
// done ::: closes:#123 fixed login bug
```

**When to use:** Short-lived handoff signal. Remove after verification.

### `review`

Needs human review.

```javascript
// review ::: @alice check this authorization logic
// review ::: verify error handling approach
```

**When to use:** Code needing human judgment, security-sensitive changes.

### `test`

Test-related annotations.

```javascript
// test ::: add integration tests for payment flow
// test ::: flaky - needs investigation
```

**When to use:** Test coverage gaps, test issues, test requirements.

### `check`

Verification needed.

```javascript
// check ::: confirm this works with legacy clients
// check ::: validate performance under load
```

**When to use:** Assumptions to verify, behavior to confirm.

## Information Markers

### `note`

General information or context.

```javascript
// note ::: this runs on a separate thread
// note ::: assumes UTC timestamps
```

**When to use:** Important context, non-obvious behavior, assumptions.

### `context`

Background and reasoning.

```javascript
// context ::: using async/await for Node 18+ compatibility
// context ::: algorithm from paper DOI:10.1234/example
```

**When to use:** Why decisions were made, external references.

### `tldr`

File-level summary (one per file).

```javascript
// tldr ::: handles user authentication and session management
```

**When to use:** First waymark in file, summarizes file purpose. See `waymark-tldrs` skill.

### `this`

Section or construct summary.

```javascript
// this ::: validates webhook signatures before processing
export function verifyWebhook() {}
```

**When to use:** Above classes/functions/blocks to describe scope. See references.

### `example`

Usage examples.

```javascript
// example ::: authenticate({ email, password }).then(session => ...)
```

**When to use:** API usage, pattern demonstrations.

### `idea`

Potential improvements.

```javascript
// idea ::: could cache this result for performance
// idea ::: consider using a state machine here
```

**When to use:** Future possibilities, optimizations to consider.

### `comment`

General commentary.

```javascript
// comment ::: this approach was chosen over X because Y
```

**When to use:** General discussion, rationale.

## Caution / Quality Markers

### `warn`

Warning about behavior.

```javascript
// warn ::: this function is not thread-safe
// warn ::: modifies input array in place
```

**When to use:** Potential gotchas, side effects, constraints.

### `alert`

Critical attention needed.

```javascript
// alert ::: changing this breaks backward compatibility
// alert ::: this endpoint has no rate limiting
```

**When to use:** High-risk code, security concerns.

### `deprecated`

Outdated code.

```javascript
// deprecated ::: use newMethod() instead, removing in v3.0
// deprecated ::: legacy API, see migration guide
```

**When to use:** Code scheduled for removal, superseded functionality.

### `temp`

Temporary code.

```javascript
// temp ::: workaround until upstream fix lands
// temp ::: remove after migration complete
```

**When to use:** Short-term solutions, code to remove soon.

### `hack`

Workarounds.

```javascript
// hack ::: working around browser bug in Safari
// hack ::: force refresh to clear stale cache
```

**When to use:** Non-ideal solutions, necessary workarounds.

## Workflow Markers

### `blocked`

Cannot proceed.

```javascript
// blocked ::: waiting on API key from vendor
// blocked ::: needs:#db/schema-update
```

**When to use:** External dependencies, blockers.

### `needs`

Dependency required.

```javascript
// needs ::: authentication module must be loaded first
// needs:#config/env environment variables required
```

**When to use:** Prerequisites, required setup.

## Inquiry Markers

### `question`

Needs clarification.

```javascript
// question ::: should this handle null input?
// question ::: @product is retry behavior correct?
```

**When to use:** Uncertainties, decisions needed.

## Marker Selection Guide

| Situation | Marker |
|-----------|--------|
| New feature to build | `todo` |
| Bug to fix | `fix` |
| Code under development | `wip` |
| Needs human judgment | `review` |
| Important context | `note` |
| Background/why | `context` |
| File purpose | `tldr` |
| Section purpose | `this` |
| Potential gotcha | `warn` |
| High-risk area | `alert` |
| Old code to remove | `deprecated` |
| Temporary workaround | `temp` / `hack` |
| Waiting on something | `blocked` |
| Prerequisite | `needs` |
| Need answer | `question` |
