<!-- tldr ::: red-green-refactor workflow expectations for this repo #docs/rules/tdd -->

# Test-Driven Development Rules

## Philosophy

- Treat tests as the first consumer of an API—write them before implementation when feasible.
- Keep feedback loops tight: small, incremental commits backed by trustworthy tests.
- Tests are executable documentation; prioritize clarity over cleverness.

## Workflow (Red → Green → Refactor)

1. **Red**
   - Write a failing test that captures the desired behavior.
   - Failing for the right reason (assertion failure, not compilation error).
   - Minimal test code to express the requirement.
2. **Green**
   - Implement just enough production code to satisfy the failing test.
   - Keep changes scoped; avoid “nice-to-have” logic during the green step.
   - Run the full relevant suite (`bun test`, `cargo test`, etc.) before moving on.
3. **Refactor**
   - Clean up implementation and tests with tests still passing.
   - Remove duplication, clarify naming, extract helpers.
   - Re-run tests after every refactor to ensure safety.

## Test Design Guidelines

- Begin each test name with the scenario being validated (`it handles expired tokens`).
- One assertion per logical outcome; group related assertions when they describe the same behavior.
- Prefer fixtures/builders over verbose inline setup.
- Mock external boundaries only; avoid mocking domain objects.
- For regression bugs, add a failing test first, then commit the fix with the test.

## Coverage Expectations

- Critical business logic: unit tests + integration tests hitting the happy path and edge cases.
- CLI surface: snapshot or golden tests for human-readable output, unit tests for parsing.
- Parser/formatter: property-based or fixture-driven tests to prevent regressions.
- Agent tooling: end-to-end checks ensuring commands wire correctly to `@waymarks/core`.

## Continuous Feedback

- Run `bun test` / `cargo test` / `go test` locally before pushing.
- Use watch modes (`bun test --watch`) during red/green loops.
- Add tests for any discovered bug before fixing it.
- Review test diffs with the same scrutiny as production code—bad tests are worse than no tests.

## Checklist Before Merge

- [ ] Each new feature/bug fix has a corresponding test.
- [ ] Tests adhere to the red → green → refactor cadence (no large leaps).
- [ ] Duplicated test logic extracted into fixtures/helpers.
- [ ] Suites run clean locally (including integration/e2e where impacted).
- [ ] Tests remain deterministic and fast (<1s per unit test where possible).

Following these TDD practices keeps the codebase adaptable and gives both humans and agents reliable guardrails.
