# TypeScript Conventions

TypeScript rules for this codebase. Enforced by Ultracite + Biome: fast, deterministic, AI‑friendly.

## Defaults

- Type‑safety first → illegal states unrepresentable
- Minimal surface area → proven, boring patterns
- Compressed, directive language → “Use X, not Y”

## Before You Code

1. Scan patterns → align with existing conventions
2. Map edge cases → define failure modes
3. Apply rules exactly → document exceptions

---

## Type Safety (Use X, not Y)

- Use discriminated unions, not enums or `const enum`.
- Use `unknown` at boundaries + schema/guards to parse, not `any` or trusting input.
- Use `satisfies` for constraint checking, not `as` to force types (minimize assertions).
- Use `as const` to preserve exactness, not widened literals.
- Use `readonly` and immutability by default, not in‑place mutation.
- Use branded opaque IDs (e.g. `type UserId = string & { __brand: 'UserId' }`), not bare strings.
- Use exhaustive `switch` + `never`, not partial branching.
- Use `import type` / `export type`, not value imports/exports for types.
- Keep overloads adjacent, not scattered.
- Prefer literal/discriminated unions + composition, not inheritance hierarchies.

Example (exhaustive switch helper):

```typescript
type Kind = 'a' | 'b';
function assertNever(x: never): never { throw new Error(`Unhandled: ${x}`); }
function handle(kind: Kind) {
  switch (kind) {
    case 'a': return 1;
    case 'b': return 2;
    default: return assertNever(kind);
  }
}
```

### Compiler settings

- Enable `strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`.
- Avoid non‑null `!` assertions. Prove with control flow.

---

## Correctness & Safety (Use X, not Y)

- Use handled Promises (`await` or `.then/.catch`), not fire‑and‑forget.
- Use `Promise.all(…)` to batch, not `await` inside loops.
- Use `Number.isNaN`/`Number.isFinite`, not globals `isNaN`/`isFinite`.
- Use `parseInt(str, 10)`, not missing radix; use numeric literals for bin/oct/hex.
- Use `Array.isArray`, not `instanceof Array`.
- Use `import.meta.url` + `URL`/`fileURLToPath`, not global `__dirname`/`__filename`.
- Use `while` when no init/update needed, not ceremonial `for`.
- Never use `@ts-ignore`; fix types or use a targeted, justified escape hatch with comments.
- Prevent import cycles; split modules or invert dependencies.
- Do not hardcode secrets; load via configuration. Secrets must never appear in code or logs.
- Avoid: bitwise ops, `delete`, `eval`, `with`, control flow in `finally`.

---

## TypeScript Practices (Use X, not Y)

- Use unions/structural types, not enums/namespaces in new code.
- Use utility types/built‑ins, not redundant user‑defined types.
- Use implicit literals + `as const`, not redundant annotations.
- Use consistent arrays (`T[]` or `Array<T>`), not mixing styles.
- Use narrow parameter/return types that express invariants, not overly broad `string | number | unknown`.
- Use module‑scoped functions/types, not ambient/global declarations.

---

## Style & Consistency (Use X, not Y)

- Use `const`, not `var`; do not reassign parameters.
- Use `===`/`!==`, not `==`/`!=`.
- Use template literals, not string concatenation.
- Use arrow functions, not function expressions.
- Use `Date.now()`, not `new Date().getTime()`.
- Use assignment shorthand (`a += b`), not `a = a + b`.
- Use `new` when throwing (`new Error('msg')`), not bare throws.
- Avoid duplicate cases/members/conditions; avoid fallthrough unless explicit.
- Avoid sparse arrays, octal escapes, irregular whitespace, control chars.
- Keep `default` clause last; ensure getters return values.

---

## Logging & Console (Use X, not Y)

- Use a structured logger in applications/services (e.g., Pino/Winston or an app logger wrapper), not `console.*` for operational logs.
- Use `console` for CLIs/tools/scripts where the console is the user interface, not for app/server debug noise.
- Use level‑appropriate logging, not ad‑hoc prints:
  - `logger.error(error, { context })`, not `console.error('oops', err)` in apps
  - `logger.warn({ context }, '…')` for recoverable issues
  - `logger.info({ event, correlationId }, '…')` for business events
  - `logger.debug({ details }, '…')` gated by config/flags
- Use Error objects, not strings: `new Error('message')` with `.cause` where applicable.
- Use fields, not string concatenation: `logger.info({ userId }, 'User logged in')`, not `logger.info('User ' + userId + ' logged in')`.
- Use redaction for secrets/PII, not raw values in logs. Never log tokens, passwords, or full payloads.
- Use correlation/trace IDs on entry points, not per‑function ad‑hoc IDs.
- Use stable log schemas, not free‑form shapes.
- CLIs/commands:
  - Use `console.log`/`console.error` for user‑facing output/errors, not a heavy logger by default
  - Use `--verbose/--debug` flags to gate extra output, not unconditional noise

Minimal example for apps:

```ts
type AppLogger = {
  info: (message: string, meta?: Record<string, unknown>) => void;
  warn: (message: string, meta?: Record<string, unknown>) => void;
  error: (message: string, meta?: Record<string, unknown>) => void;
  debug: (message: string, meta?: Record<string, unknown>) => void;
};

function handleError(logger: AppLogger, error: unknown, context: Record<string, unknown>) {
  const err = error instanceof Error ? error : new Error('Unknown error', { cause: error });
  logger.error('Operation failed', { ...context, err });
}
```

---

## Performance (TypeScript‑focused)

- Use compile‑time guarantees to remove runtime checks, not layers of defensive code after parsing.
- Use early narrowing (guards/refinements), not wide types that force downstream checks.
- Use single‑pass transforms or generators, not unnecessary intermediate arrays (`.filter().map().reduce()` when one pass suffices).
- Use `for…of` for hot paths, not `forEach` with closures capturing outer scope.
- Use stable shapes for hot objects, not polymorphic maps that deopt engines.
- Avoid `JSON.parse(JSON.stringify(obj))` cloning; use structuredClone or explicit copy.
- Keep types simple: avoid deeply recursive or highly distributive conditional types that explode compile times.
- Measure before optimizing: benchmark with representative inputs; check bundle size and tsc time.

---

## Security (TypeScript‑focused)

- Types are not security: validate at trust boundaries (Zod/Valibot/TypeBox), not rely on compile‑time types for runtime safety.
- Use parameterized queries/escaping for SQL, not string interpolation.
- Use allowlists over denylists in validators, not regex bandaids.
- Use branded types for IDs to prevent cross‑domain mixups, not plain `string`.
- Use `unknown` for input, narrow to safe domain types, not `any`.
- Redact secrets in logs; never print tokens/keys; prefer opaque references.
- Do not execute dynamically constructed code; avoid `Function` and `eval`.

---

## Example: Error Handling

```ts
try {
  const result = await fetchData();
  return { success: true, data: result } as const;
} catch (error) {
  // Apps/services: structured logger
  appLogger.error('API call failed', { error });
  // CLIs/tools: console is acceptable
  // console.error('API call failed:', error);
  return { success: false, error: (error as Error).message } as const;
}
```

---

## Remember

- Type safety first: unions over enums; `unknown` at boundaries; no `@ts-ignore`.
- Be exhaustive: `switch` + `never`; handle all Promises; batch with `Promise.all`.
- Logging discipline: structured logs in apps; console only for CLI/user output; never log secrets.
- Keep types simple and expressive; prefer clarity over clever conditional types.
- Validate at boundaries; types do not sanitize input.
