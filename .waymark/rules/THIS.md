<!-- tldr ::: guidance for writing precise `this :::` waymarks on sections and blocks #docs/rules/waymarks -->

# `this :::` Waymarks

`this :::` markers describe the code immediately following them. They give readers and agents a quick breadcrumb for classes, functions, and major blocks after the TLDR frames the file.

## Core Principles

- **Placement**: Put `this :::` on the comment line directly above the construct it summarizes (class, function, block comment).
- **Scope**: Focus on the upcoming section only—do not restate the file-level TLDR.
- **Tone**: Short, active-voice sentences (6–12 words) that start with the capability and end with a relevant detail or tag.
- **Maintenance**: Update after any behavior change or refactor. Delete stale markers instead of leaving inaccurate guidance.

## Sentence Patterns

| Construct        | Pattern Example                                                 |
|------------------|-----------------------------------------------------------------|
| Class declaration| `// this ::: encapsulates session lifecycle state #auth/session`   |
| Function/method  | `// this ::: validates webhook signatures #payments/stripe`        |
| React component  | `// this ::: renders account overview card with metrics`          |
| Utility module   | `// this ::: wraps fetch with BetterAuth tokens`                  |

## Tags & Anchors

- Reuse existing namespaces (`#perf:hotpath`, `#sec:boundary`, `#docs/...`) so searches group related sections.
- Only add `ref:#token` when the section itself needs to be referenced elsewhere—rare compared to TLDR anchors.
- Before inventing a new tag, run `rg ":::\s.*#<fragment>"` to check precedent.

## Examples

```ts
// this ::: sanitizes Stripe event payloads before persistence #payments/stripe
export function sanitize(event: StripeEvent): SanitizedEvent { ... }
```

```py
def login(request: Request) -> Response:
    """Handle BetterAuth login flow."""
    # this ::: authenticates user credentials and creates session tokens ref:#auth/login
    ...
```

```md
<!-- this ::: workflow for installing the CLI with Bun -->
```

## Review Checklist

- ✅ Comment sits immediately above the code it describes.
- ✅ Sentence is concise, active, and section-specific.
- ✅ Tags (if present) follow established namespaces.
- ✅ Marker was revisited after recent changes to the section.
- ✅ No duplication of the TLDR’s content.

Thoughtful `this :::` markers make deep dives faster by turning large files into well-marked wayfinding points for both humans and agents.
