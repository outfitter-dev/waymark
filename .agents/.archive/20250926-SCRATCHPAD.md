<!-- tldr ::: agent scratchpad - working memory for project development -->

# Scratchpad

## Formatting Guidelines

This scratchpad uses a structured format for tracking decisions and work:

- **Decisions**: Use `- **[✅|🛑|🗓️] <short-label>**: <text>` format
  - ✅ = decision to DO something
  - 🛑 = decision to NOT do something
  - 🗓️ = decision to defer to a future date
  - Use sublist items for supporting details
- **Questions**: Format as `- [Q]: <one-sentence question>`
  - Include sublist item `- [A]: PENDING` for answers
- **Log entries**: Start with `- YYYY-MM-DD HH:MM: <brief summary>`
  - Use sublist items for details
- **All sections**: Use hyphen list items (`-`) and maintain consistent indentation

## Notes

- Migration focus: Bottom-up rebuild with documentation and grep-based usage first
- Old project location: `~/Developer/outfitter/waymark-old` ([GitHub](https://github.com/outfitter-dev/waymark-old))
- Archive branch: `archive/pre-rebuild-2025-01`

## Questions

### Open

### Closed

## Decisions

### Syntax

- **[✅|🛑|🗓️] sigil-format**: Define the `:::` sigil usage and spacing rules
- **[✅|🛑|🗓️] prefix-list**: Establish allowed prefix vocabulary (todo, fix, tldr, etc.)
- **[✅|🛑|🗓️] property-syntax**: Define key:value property format and allowed keys
- **[✅|🛑|🗓️] hashtag-rules**: Set hashtag conventions and hierarchical namespace
- **[✅|🛑|🗓️] mention-format**: Define @mention syntax for assignments

### Core

- **[✅|🛑|🗓️] spec-location**: Where the waymark specification lives
- **[✅|🛑|🗓️] schema-format**: JSON Schema vs other validation approaches
- **[✅|🛑|🗓️] parser-approach**: Regex-based vs AST-based parsing
- **[✅|🛑|🗓️] core-library**: TypeScript/Bun implementation decisions
- **[✅|🛑|🗓️] api-design**: Library API surface and exports

### CLI

- **[✅|🛑|🗓️] cli-framework**: Choose CLI framework (commander, yargs, etc.)
- **[✅|🛑|🗓️] command-structure**: Define command hierarchy and naming
- **[✅|🛑|🗓️] output-formats**: JSON, table, human-readable outputs
- **[✅|🛑|🗓️] config-files**: Support for .waymarkrc or similar
- **[✅|🛑|🗓️] ripgrep-integration**: Direct rg usage vs abstraction

### CI/CD

- **[✅|🛑|🗓️] github-actions**: Use GitHub Actions for CI
- **[✅|🛑|🗓️] test-strategy**: Unit vs integration test approach
- **[✅|🛑|🗓️] release-process**: Semantic versioning and release automation
- **[✅|🛑|🗓️] npm-publishing**: NPM package publishing strategy
- **[✅|🛑|🗓️] pre-commit-hooks**: Waymark validation in git hooks

### Tooling

- **[✅|🛑|🗓️] vscode-extension**: Build VS Code extension
- **[✅|🛑|🗓️] eslint-plugin**: Create ESLint plugin for validation
- **[✅|🛑|🗓️] prettier-plugin**: Format waymark comments
- **[✅|🛑|🗓️] language-servers**: LSP implementation
- **[✅|🛑|🗓️] browser-tools**: Web-based waymark tools

## Log
