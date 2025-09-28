<!-- tldr ::: default-language docstring compatibility guidance for waymarks -->

# Waymark & Docstring Compatibility

Docstrings/inline documentation and waymarks must complement one another without polluting rendered output. Country-specific docstrings (Go doc comments, Python triple quotes, JS JSDoc) should continue to work exactly as intended while still giving agents the anchors they need.

## General Guidance

- **Waymarks live outside docstrings.** Never place the `:::` sigil inside a string literal or rendered doc block. Use preceding or trailing comment lines instead.
- **Docstring first, waymark second.** When both appear at the top of a function/class, keep the docstring immediately adjacent to the code and attach the waymark on the preceding or following comment line.
- **Mirror docstring context.** If the docstring explains behavior, use `this :::` or `note :::` to summarize constraints so the waymark contains the machine-searchable version of the same idea.
- **Respect formatting tools.** Leave blank lines between docstrings and waymarks only if required by the language’s style guide (e.g., Python).

## Language Examples

### Python

```python
def send_email(message: Email) -> None:
    """Send an email using the configured transport."""
    # this ::: orchestrates outbound email delivery #comm/email
    # note ::: docstring is the human narrative; waymark is the searchable anchor
    transport.send(message)
```

### TypeScript

```ts
/**
 * Sanitizes incoming webhook payloads.
 */
// this ::: normalizes Stripe webhook data into canonical shape #payments/stripe
export function normalize(body: StripePayload) { /* ... */ }
```

### Go

```go
// sanitize normalizes webhook payloads before verification.
// this ::: ensures Stripe event payload conforms to canonical schema #payments/stripe
func sanitize(event Event) Event { /* ... */ }
```

### Markdown (Documentation)

```markdown
<!--
This guide explains how to authenticate against the waymark CLI.
-->
<!-- tldr ::: CLI authentication guide using BetterAuth ref:#docs/guide/auth -->
```

## Checklist

- [ ] Waymark appears outside the docstring/string literal.
- [ ] Waymark content reinforces docstring intent (no conflicts).
- [ ] Tags/canonicals follow existing conventions.
- [ ] Docstring still renders cleanly when processed by tooling.

Keep docstrings human-friendly and waymarks machine-greppable; together they give agents and readers the best experience.
