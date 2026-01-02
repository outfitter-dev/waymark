<!-- tldr ::: documentation index for waymark project #docs -->

# Waymark Documentation

Welcome to the Waymark documentation. This guide helps you find the right resource for your needs.

## Quick Start

| I want to... | Start here |
| -------------- | ------------ |
| Use the CLI | [CLI Installation](./cli/README.md) → [Commands](./cli/commands.md) |
| Understand waymark syntax | [Grammar](./GRAMMAR.md) |
| See practical examples | [How-To Guides](./howto/README.md) |
| Learn development practices | [Architecture](./ARCHITECTURE.md) + [Agents](./AGENTS.md) |
| Understand design decisions | [Historical Priors](./about/priors.md) |

---

## Core Documentation

### [Grammar Specification](./GRAMMAR.md)

The canonical reference for waymark syntax, structure, and semantics.

**Contents**:

- Basic syntax and line form
- Signals, types, and markers
- Properties, relations, and canonicals
- Tags, mentions, and actors
- Multi-line waymarks
- Grammar rules (EBNF)
- Examples across languages

**Audience**: Anyone embedding waymarks in code or building tooling.

---

### CLI Documentation

Comprehensive guides to the `wm` command-line tool.

**[Installation & Quick Start](./cli/README.md)**:

- Installation (npm, Bun, source)
- Shell completions
- Getting started
- Common tasks

**[Commands Reference](./cli/commands.md)**:

- All commands with examples
- Configuration and scopes
- Output formats
- Filtering and searching
- Display modes
- Common workflows
- Troubleshooting

**[Waymark Editing](./cli/waymark_editing.md)**:

- Insert command (add waymarks)
- Remove command (delete waymarks)
- Modify command (update signals)
- Batch operations
- ID management

**Audience**: Developers using the Waymark CLI in their projects.

---

### [How-To Guides](./howto/README.md)

Practical, opinionated guides for common workflows.

**Contents**:

- Getting started
- Daily workflows (standup, pre-commit, code review)
- Team collaboration
- Agent integration
- Advanced patterns
- Use case examples
- Tips & tricks

**Audience**: Anyone looking for real-world usage patterns and recipes.

---

## Development Documentation

### [Architecture](./ARCHITECTURE.md)

Architectural principles and module organization guidelines.

**Contents**:

- Modularity over monoliths
- File size guidelines
- Testing strategy
- Type safety principles
- Performance considerations

**Audience**: Contributors and maintainers of the Waymark codebase.

---

### [Agent-Assisted Development](./AGENTS.md)

Guide to AI agent collaboration practices and tooling choices.

**Contents**:

- Philosophy and principles
- Tooling choices (Bun, TypeScript, Turbo)
- Agent collaboration patterns
- Quality standards
- Pre-commit workflows

**Audience**: Developers working with AI agents on the Waymark project.

---

## Supporting Materials

### [Historical Priors](./about/priors.md)

How other ecosystems influenced the waymark grammar.

**Contents**:

- Comment-level anchors across languages
- IDE navigation patterns
- Build system annotations
- Lessons learned from prior art

**Audience**: Anyone curious about design decisions and historical context.

---

## Document Structure

Waymark documentation follows these conventions:

- **Every doc has a TLDR waymark** at the top for grep-based discovery
- **Grammar docs** are tool-agnostic and vendor-neutral
- **CLI docs** assume you're using `@waymarks/cli`
- **How-To guides** are opinionated and prescriptive
- **Development docs** target contributors and maintainers

---

## Contributing to Docs

### Guidelines

1. **Add TLDR waymarks**: Every doc should start with `<!-- tldr ::: ... #docs/... -->`
2. **Use consistent headings**: H1 for title, H2 for major sections, H3 for subsections
3. **Include TOC for long docs**: Any doc over 200 lines should have a table of contents
4. **Link liberally**: Cross-reference related docs
5. **Examples over explanation**: Show code examples wherever possible
6. **Keep grammar layer pure**: Grammar docs should not assume CLI usage

### Adding New Docs

**Core documentation** (grammar, CLI, how-to):

- Discuss approach first via issue or PR
- Update this index when adding new files

**How-To guides**:

- Add to `howto/` directory
- Update `howto/README.md` with link
- Use the template provided in `howto/README.md`

**Development docs**:

- Add to `docs/` root
- Update this index

---

## Document Maintenance

| Document | Update Trigger | Owner |
| ---------- | --------------- | ------- |
| GRAMMAR.md | Grammar changes in PRD | Maintainers |
| cli/README.md | CLI command changes | Maintainers |
| howto/README.md | New workflow patterns | Contributors |
| ARCHITECTURE.md | Architectural decisions | Maintainers |
| AGENTS.md | Tooling/process changes | Maintainers |

---

## External Resources

- [Project README](../README.md) - Project overview and quick start
- [PRD](../PRD.md) - Product requirements and roadmap
- [PLAN](../PLAN.md) - Execution plan and decision log
- GitHub repository (internal: outfitter-dev/waymark) - Source code
- [npm Package](https://www.npmjs.com/package/@waymarks/cli) - CLI installation
