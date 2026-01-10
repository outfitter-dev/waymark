<!-- tldr ::: guidance for writing clear about waymarks above code constructs -->

# Writing `about :::` Waymarks

`about :::` markers describe the code section immediately following them. They provide quick breadcrumbs for classes, functions, and major blocks.

## Placement

Place `about :::` on the comment line directly above the construct:

```typescript
// about ::: validates JWT tokens and extracts claims
export function validateToken(token: string): Claims {
  // ...
}
```

```python
# about ::: manages database connection pooling
class ConnectionPool:
    pass
```

## Scope

Focus on the upcoming section only - do not restate file-level TLDR:

**Good (section-specific):**

```typescript
// tldr ::: user authentication service
// ...

// about ::: validates password against security policy
function validatePassword(password: string) {}

// about ::: hashes password with bcrypt
function hashPassword(password: string) {}
```

**Bad (restates file purpose):**

```typescript
// about ::: handles user authentication  // too broad, same as tldr
function validatePassword(password: string) {}
```

## Sentence Patterns

Write short, active-voice sentences (6-12 words):

| Construct | Pattern | Example |
|-----------|---------|---------|
| Class | "encapsulates/manages [domain] [state/behavior]" | `encapsulates session lifecycle state` |
| Function | "validates/transforms/fetches [input] [action]" | `validates webhook signatures before processing` |
| Component | "renders [element] with [feature]" | `renders account overview with metrics` |
| Utility | "wraps/provides [capability] for [purpose]" | `wraps fetch with retry logic` |

## Examples by Language

### TypeScript / JavaScript

```typescript
// about ::: transforms API response into domain model
export function normalize(response: ApiResponse): User {
  return { id: response.id, name: response.full_name };
}

// about ::: React hook exposing auth state and methods
export function useAuth() {
  const [user, setUser] = useState(null);
  // ...
}

// about ::: validates request body against JSON schema
export const validateRequest = (schema: Schema) => (req, res, next) => {
  // ...
};
```

### Python

```python
# about ::: orchestrates email delivery through SMTP
class EmailService:
    def send(self, message: Email) -> None:
        # ...

# about ::: rate limits requests by IP address
@decorator
def rate_limit(requests_per_minute: int):
    # ...

# about ::: parses CSV into structured records
def parse_csv(file_path: str) -> list[Record]:
    # ...
```

### Go

```go
// about ::: handles graceful shutdown of HTTP server
func (s *Server) Shutdown(ctx context.Context) error {
    // ...
}

// about ::: validates configuration against required fields
func ValidateConfig(cfg *Config) error {
    // ...
}
```

### Rust

```rust
// about ::: deserializes JSON with custom error handling
impl FromStr for Config {
    type Err = ConfigError;
    fn from_str(s: &str) -> Result<Self, Self::Err> {
        // ...
    }
}
```

## With Tags

Reuse tag namespaces consistent with file-level TLDR:

```typescript
// tldr ::: payment processing service #payments

// about ::: validates Stripe webhook signatures #payments
export function verifyStripeWebhook() {}

// about ::: calculates transaction fees #payments #billing
export function calculateFees() {}
```

## With Canonical References

Rarely needed, but available for major sections:

```typescript
// about ::: core authentication flow ref:#auth/core #security
export class AuthenticationService {
  // ...
}
```

## Maintenance

Update `about :::` markers when behavior changes:

```typescript
// Before refactor
// about ::: fetches user by ID

// After refactor (now fetches by ID or email)
// about ::: fetches user by ID or email
```

Delete stale markers rather than leaving inaccurate guidance.

## Checklist

Before committing an `about :::` waymark:

- [ ] Comment sits immediately above the code it describes
- [ ] Sentence is concise (6-12 words) and active voice
- [ ] Focuses on section scope, not file scope
- [ ] Tags match established namespaces (if used)
- [ ] Will be updated when behavior changes

## Anti-patterns

**Avoid:**

```typescript
// about ::: this is a function  // too vague
// about ::: handles everything related to users  // too broad
// about ::: see documentation for details  // not self-descriptive
// about ::: TODO: write description  // incomplete
```

**Prefer:**

```typescript
// about ::: validates user credentials against LDAP
// about ::: fetches user profile from cache or database
// about ::: transforms API errors into user-friendly messages
```
