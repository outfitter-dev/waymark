<!-- tldr ::: how we write clear, accurate docstrings across languages #docs/rules/docstrings -->

# Docstring Rules

## Goals

- Explain **what** the callable does, **why** it exists, and any external contracts.
- Document inputs, outputs, side effects, and error cases.
- Provide small, copyable examples when they accelerate understanding.
- Keep tone direct and neutral; avoid marketing language.

## General Guidelines

- Write from the perspective of a caller unfamiliar with internal context.
- Document default behavior and edge cases that are non-obvious from the signature alone.
- Prefer present tense, active voice (“Returns the cached value”).
- Keep docstrings under ~10 lines; if more context is required link to markdown docs.
- Update docstrings whenever behavior, return types, or invariants change—no stale narratives.

## Language-Specific Notes

### Python (PEP 257)

- Use triple-double-quoted strings (`"""Docstring."""`).
- Start with a single-sentence summary line, then add a blank line before extended description.
- Include **Args**, **Returns**, and **Raises** sections as needed.

```python
def fetch_user(user_id: str) -> User:
    """Return the active user for the given id.

    Args:
        user_id: Public identifier for the user.

    Returns:
        User object if found, otherwise raises `UserNotFound`.
    """
    ...
```

### TypeScript / JavaScript (JSDoc)

- Use `/** ... */` blocks directly above the declaration.
- Describe parameters with `@param` and return values with `@returns`.
- Include `@throws`, `@example`, and `@deprecated` when appropriate.

```ts
/**
 * Normalize a webhook payload into canonical form.
 *
 * @param payload - Raw Stripe webhook body.
 * @returns Canonical payload that downstream services expect.
 */
export function normalize(payload: StripePayload): CanonicalPayload { ... }
```

### Go

- Begin with the function/type name followed by the verb (“FetchUser returns…”).
- One sentence is usually enough; add more sentences to document edge cases.

```go
// FetchUser returns the active user for the provided ID.
// It panics if the database connection is nil.
func FetchUser(ctx context.Context, id string) (*User, error) { ... }
```

### Rust

- Use triple slash comments (`///`).
- The first line becomes the summary; subsequent paragraphs are rendered markdown.

```rust
/// Returns the cached value for the provided key.
///
/// # Errors
///
/// Returns `CacheError::Expired` if the entry has expired.
pub fn get_cached(key: &str) -> Result<Value, CacheError> { ... }
```

## Examples & Usage

- Include runnable examples when they clarify complex behavior. Prefer small code snippets that demonstrate inputs and outputs.
- For asynchronous or streaming APIs, show both success and failure flows in the example if practical.

## Quality Checklist

- [ ] Summary describes the callable in one sentence.
- [ ] Parameters, return values, and errors are documented.
- [ ] Examples compile or execute as written (if provided).
- [ ] Docstring reflects current behavior and naming.
- [ ] No duplicate information that already exists in nearby code comments.

Docstrings are the human narrative; keep them accurate, clear, and concise.
