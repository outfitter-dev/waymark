<!-- tldr ::: extended TLDR sentence patterns organized by file type -->

# TLDR Patterns by File Type

Extended patterns for writing effective TLDR waymarks.

## Pattern Templates

### Services / Classes

```text
[verb] [domain] [with/using/via] [key feature]
```

Examples:

- `manages user sessions with Redis caching`
- `processes payments using Stripe API`
- `validates input with JSON schema`

### Entry Points

```text
[component] entry [wiring/configuring] [framework] [features]
```

Examples:

- `CLI entry parsing arguments and dispatching commands`
- `server entry wiring Express middleware and routes`
- `application bootstrap configuring dependency injection`

### React Components

```text
[renders/displays] [element] [with/for] [feature]
```

Examples:

- `renders user profile card with avatar`
- `displays analytics dashboard with charts`
- `renders form with validation feedback`

### React Hooks

```text
[hook/hooks] [exposing/managing] [state/behavior] [context]
```

Examples:

- `hook exposing authentication state and methods`
- `hooks managing form state with validation`
- `hook providing theme context to components`

### Utilities / Helpers

```text
[capability] utilities for [domain/purpose]
```

Examples:

- `string manipulation utilities for formatting`
- `date handling helpers with timezone support`
- `validation utilities for common patterns`

### Middleware

```text
[middleware/handler] [doing what] [for/with] [scope]
```

Examples:

- `middleware validating JWT tokens for protected routes`
- `handler logging requests with structured format`
- `middleware rate limiting by IP address`

### Configuration

```text
[tool] configuration [for/with] [feature]
```

Examples:

- `TypeScript configuration with strict mode enabled`
- `ESLint configuration extending Ultracite rules`
- `Vite configuration with code splitting`

### Tests

```text
[test type] tests for [feature] [coverage scope]
```

Examples:

- `unit tests for authentication service`
- `integration tests covering payment flows`
- `E2E tests validating checkout process`

### Documentation

```text
[doc type] [describing/explaining] [topic] [context]
```

Examples:

- `API reference documenting authentication endpoints`
- `guide explaining deployment to Kubernetes`
- `quickstart showing first API request`

### Scripts

```text
[script purpose] [for/targeting] [environment/scope]
```

Examples:

- `deployment script for production Kubernetes`
- `migration script for database schema updates`
- `build script generating production assets`

## Verb Selection

Choose verbs that convey action:

| Category | Strong Verbs |
| -------- | ------------ |
| Processing | `validates`, `transforms`, `processes`, `parses` |
| Managing | `manages`, `orchestrates`, `coordinates`, `handles` |
| Creating | `generates`, `builds`, `creates`, `renders` |
| Retrieving | `fetches`, `loads`, `queries`, `resolves` |
| Exposing | `exposes`, `provides`, `exports`, `surfaces` |

**Avoid weak verbs:**

- "contains" (everything contains something)
- "does" (too vague)
- "is" (not action-oriented)
- "has" (descriptive, not active)

## Tag Conventions

### Domain Tags

- `#auth`, `#payments`, `#users`, `#billing`
- `#api`, `#frontend`, `#backend`, `#infra`

### Document Tags

- `#docs` - Required for all documentation
- `#docs/guide` - How-to guides
- `#docs/reference` - API/technical reference
- `#docs/tutorial` - Step-by-step tutorials

### Technical Tags

- `#perf` - Performance-related
- `#sec` - Security-related
- `#test` - Test files

## Anti-patterns

| Pattern | Problem | Better |
| ------- | ------- | ------ |
| "This file contains utilities" | Vague, contains is weak | "String formatting utilities for display" |
| "Module for handling stuff" | "stuff" meaningless | "Handles webhook event routing" |
| "Important authentication code" | "Important" doesn't describe | "Validates OAuth tokens against provider" |
| "TODO: add description" | Incomplete | Write actual description |
| "See README for details" | Not self-contained | Describe directly |
