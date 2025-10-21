<!-- tldr ::: linear project management rules and configuration -->

# LINEAR.md

## Project

- Team: Waymark (subteam of Outfitter)
- ID: `WAY`
- Project: `Waymark v0.1`

## Rules

- This project uses Linear for project management. By default, issues should be created in Linear first. Creating GitHub issues is also important, but should come secondary to Linear.
- When working on Linear issues, reference them in commits and PRs using the format below.

## Linear Issue References

### Commit Message Format

Reference Linear issues in the commit message footer:

```plaintext
feat: implement authentication flow

Implements user login with OAuth 2.0 and session management.

Linear: WAY-123
```

### Multiple Issues

When a commit addresses multiple issues:

```plaintext
fix: resolve validation bugs

Fixes multiple edge cases in input validation.

Linear: WAY-45, WAY-46
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
[WAY-123] feat: implement authentication flow
```

### Alternative Keywords

You can use any of these keywords in commit footers:

- `Linear: WAY-123`
- `Refs: WAY-123`
- `Related: WAY-123`

The important part is including the issue ID (e.g., `WAY-123`) for linking.
