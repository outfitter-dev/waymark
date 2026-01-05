<!-- tldr ::: linear project management rules and configuration -->

# LINEAR.md

## Project

- Team: Waymark (subteam of Outfitter)
- Key: `WAY`
- Workspace: Outfitter

## Streamlinear MCP

This project uses the `streamlinear` MCP server for Linear integration. All actions use a single tool: `mcp__linear__linear`.

### Default Team Filter

Always filter by team `WAY` when searching:

```json
{ "action": "search", "query": { "team": "WAY" } }
```

### Common Actions

| Action | Example |
|--------|---------|
| Search team issues | `{ "action": "search", "query": { "team": "WAY" } }` |
| Search in progress | `{ "action": "search", "query": { "team": "WAY", "state": "In Progress" } }` |
| Get issue | `{ "action": "get", "id": "WAY-123" }` |
| Update status | `{ "action": "update", "id": "WAY-123", "state": "Done" }` |
| Add comment | `{ "action": "comment", "id": "WAY-123", "body": "Comment text" }` |
| Create issue | `{ "action": "create", "title": "Issue title", "team": "WAY" }` |
| GraphQL query | `{ "action": "graphql", "graphql": "query { ... }" }` |

## Rules

- Linear is the authoritative tracker. Log or locate an issue before meaningful work.
- Always use team filter `WAY` when searching to scope results to this project.
- When working on Linear issues, reference them in commits and PRs using the format below.

## Linear Issue References

### Commit Message Format

Reference Linear issues in the commit message footer:

```plaintext
feat: implement authentication flow

Implements user login with OAuth 2.0 and session management.

Fixes: WAY-123
```

### Multiple Issues

When a commit addresses multiple issues:

```plaintext
fix: resolve validation bugs

Fixes multiple edge cases in input validation.

Fixes: WAY-45, WAY-46
```

### Branch Naming

Graphite automatically creates branches from Linear issues:

```bash
# Branch name: way-123-implement-authentication
gt create -m "feat: implement auth"
```

### PR Title Format

Include the issue ID in PR titles for traceability:

```plaintext
feat: implement authentication flow [WAY-123]
```

### Alternative Keywords

You can use any of these keywords in commit footers:

- `Fixes: WAY-123` (closing)
- `Refs: WAY-123` (non-closing)
- `Related: WAY-123` (non-closing)

The important part is including the issue ID (e.g., `WAY-123`) for linking.
