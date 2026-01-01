<!-- tldr ::: PR log for cleaning up agent rules and removing stale documentation -->

# PR #93: chore: clean up agent rules and remove stale docs

**Branch:** chore/clean-up-agent-rules  
**State:** open  
**Last Updated:** Dec 31, 2025 at 05:03 PM

## Comments (0)

*No comments*

## Reviews (3)

### @[object Object] • Dec 30, 2025 at 11:13 AM • commented

**Actionable comments posted: 0**

<details>
<summary>🧹 Nitpick comments (3)</summary><blockquote>

<details>
<summary>.agents/plans/v1/AUDIT.md (1)</summary><blockquote>

`3-4`: **Consider using contextual waymark for legacy notice.**

While the blockquote approach is readable, using a markdown comment with contextual waymark would improve machine-scannability:

```markdown
<!-- note ::: Legacy document; archived materials in `.agents/.archive/`. See CLAUDE.md for current guidance. -->
```

This aligns better with the coding guidelines' emphasis on contextual waymarks and grep-first documentation.

</blockquote></details>
<details>
<summary>AGENTS.md (1)</summary><blockquote>

`11-14`: **Use standard markdown link syntax for Key References.**

The `@` prefix syntax may not render consistently across markdown renderers. Use standard markdown links instead:

<details>
<summary>🔎 Suggested reference format</summary>

```diff
## Key References

- [@README.md](./README.md)
- [@WAYMARKS.md](./.waymark/rules/WAYMARKS.md)
```

Alternatively, if the `@` syntax is intentional for waymark-related references (e.g., mentions or transclusions), this should be documented or consistent with the codebase's link conventions.
</details>

</blockquote></details>
<details>
<summary>.codex/AGENTS.md (1)</summary><blockquote>

`11-11`: **Capitalize GitHub platform name.**

Line 11 references `github` as a lowercase identifier. For consistency with the official platform name, update to `GitHub`.

<details>
<summary>🔎 Proposed fix</summary>

```diff
- `.agents/rules/MCP.md` — Available MCP servers (context7, github, sequential-thinking)
+ `.agents/rules/MCP.md` — Available MCP servers (context7, GitHub, sequential-thinking)
```

</details>

</blockquote></details>

</blockquote></details>

<details>
<summary>📜 Review details</summary>

**Configuration used**: Path: .coderabbit.yaml

**Review profile**: CHILL

**Plan**: Pro

<details>
<summary>📥 Commits</summary>

Reviewing files that changed from the base of the PR and between 47af38eac8a5f5b79739d5780eb4aa71ecf89acf and daed1e86a32f854cd3902ad2687a7e6888e4c88e.

</details>

<details>
<summary>📒 Files selected for processing (14)</summary>

- `.agents/plans/v1/AUDIT.md`
- `.agents/plans/v1/PLAN.md`
- `.claude/settings.json`
- `.codex/AGENTS.md`
- `.gitattributes`
- `.gitignore`
- `AGENTS.md`
- `CLAUDE.md`
- `CLAUDE.md`
- `IMPROVEMENTS.md`
- `PLAN.md`
- `PRD.md`
- `SCRATCHPAD.md`
- `docs/waymark/tui-ab-plan.md`

</details>

<details>
<summary>💤 Files with no reviewable changes (4)</summary>

- SCRATCHPAD.md
- IMPROVEMENTS.md
- PRD.md
- PLAN.md

</details>

<details>
<summary>🧰 Additional context used</summary>

<details>
<summary>📓 Path-based instructions (4)</summary>

<details>
<summary>**/*.md</summary>

**📄 CodeRabbit inference engine (AGENTS.md)**

> `**/*.md`: All markdown files should have `<!-- tldr ::: <short description> -->` at the top
> Use contextual waymarks like `<!-- note ::: <description> -->` or `<!-- summary ::: <description> -->` in markdown documentation
> Keep markdown documentation focused and scannable with clear linking to related docs

Files:

- `docs/waymark/tui-ab-plan.md`
- `AGENTS.md`
- `CLAUDE.md`

</details>
<details>
<summary>**/*.{md,html,xml}</summary>

**📄 CodeRabbit inference engine (AGENTS.md)**

> Follow the `:::` sigil syntax in markdown comments (space before when prefix present)

Files:

- `docs/waymark/tui-ab-plan.md`
- `AGENTS.md`
- `CLAUDE.md`

</details>
<details>
<summary>docs/**/*.{ts,tsx,js,jsx,json,md}</summary>

**📄 CodeRabbit inference engine (docs/AGENTS.md)**

> Use deterministic formatting with Ultracite (Biome) via `bun run format` command; all files must pass linting automatically

Files:

- `docs/waymark/tui-ab-plan.md`

</details>
<details>
<summary>AGENTS.md</summary>

**📄 CodeRabbit inference engine (CLAUDE.md)**

> Document agent implementations, capabilities, and design patterns in AGENTS.md

Files:

- `AGENTS.md`

</details>

</details><details>
<summary>🪛 LanguageTool</summary>

<details>
<summary>.codex/AGENTS.md</summary>

[uncategorized] ~11-~11: The official name of this software platform is spelled with a capital “H”.
Context: ....md` — Available MCP servers (context7, github, sequential-thinking) - `.agents/rules/...

(GITHUB)

</details>

</details>

</details>

<details>
<summary>⏰ Context from checks skipped due to timeout of 90000ms. You can increase the timeout in your CodeRabbit configuration to a maximum of 15 minutes (900000ms). (1)</summary>

- GitHub Check: Graphite / mergeability_check

</details>

<details>
<summary>🔇 Additional comments (11)</summary><blockquote>

<details>
<summary>.claude/settings.json (1)</summary><blockquote>

`1-3`: **Configuration looks good.**

Valid JSON structure with clear plugin enablement intent. This aligns with the PR's agent rule updates and ties into the CLAUDE/AGENTS integration framework.

</blockquote></details>
<details>
<summary>docs/waymark/tui-ab-plan.md (3)</summary><blockquote>

`44-44`: **SCRATCHPAD reference updated correctly.**

The change from "capture notes in SCRATCHPAD" to "capture notes inline" aligns with the removal of SCRATCHPAD.md and keeps the plan self-contained.

---

`75-75`: **DX Notes reference updated.**

Properly updated from "Pain points recorded in SCRATCHPAD" to "Pain points recorded in this doc" to reflect the archival of SCRATCHPAD.md and consolidate documentation in the active plan.

---

`1-94`: **Verify formatting with Ultracite.**

Since this file is in the `docs/` directory, confirm it passes deterministic formatting via `bun run format` per coding guidelines.

</blockquote></details>
<details>
<summary>.gitignore (1)</summary><blockquote>

`63-63`: **Ignore pattern aligns with doc archival.**

Adding `.scratch/` under the "Agent archives" section is appropriate and supports the PR's archival and cleanup objectives.

</blockquote></details>
<details>
<summary>.gitattributes (1)</summary><blockquote>

`2-3`: **Merge driver configuration is clear.**

The comment and git attributes entry for `.beads/issues.jsonl` are well-formed and provide clear intent for custom merge handling.

</blockquote></details>
<details>
<summary>AGENTS.md (2)</summary><blockquote>

`1-9`: **AGENTS.md successfully reframes guidance.**

The new "Skills & Conventions" section cleanly replaces the rebuild narrative with actionable guidance. The restructuring aligns well with the PR's modernization of agent rules and the shift toward skill-based configuration referenced in CLAUDE.md.

---

`1-94`: **Verify markdown rendering of AGENTS.md.**

Per the PR note about confirming CLAUDE.md renders correctly, please ensure AGENTS.md renders as expected in your documentation viewer (GitHub/docs site). Pay special attention to the new reference syntax and list formatting to ensure no rendering regressions.

</blockquote></details>
<details>
<summary>.agents/plans/v1/PLAN.md (2)</summary><blockquote>

`3-4`: **Appropriate legacy document transition.**

The addition of the legacy document notice clearly signals the document's status and directs readers to CLAUDE.md for current guidance. The transition preserves valuable historical context while establishing a single source of truth going forward.

---

`840-843`: **Archive references properly updated.**

The References section now correctly points to archived materials under `.agents/.archive/`, supporting the consolidation and archival strategy described in the PR objectives.

<!-- review_comment_end] -->

</blockquote></details>
<details>
<summary>.codex/AGENTS.md (1)</summary><blockquote>

`1-30`: **Solid foundational guidance document.**

The file provides clear, hierarchical guidance for agents with well-organized sections and appropriate cross-references. The structure will help agents navigate project conventions consistently.

</blockquote></details>

</blockquote></details>

</details>

<!-- This is an auto-generated comment by CodeRabbit for review status -->

---

### @[object Object] • Dec 30, 2025 at 11:28 AM • commented

*⚠️ Potential issue* | *🟡 Minor*

**Capitalize "GitHub" per standard naming convention.**

The reference to `github` should be capitalized as `GitHub` to match the official product name.

<details>
<summary>🔎 Proposed fix</summary>

```diff
- `.agents/rules/MCP.md` — Available MCP servers (context7, github, sequential-thinking)
+ `.agents/rules/MCP.md` — Available MCP servers (context7, GitHub, sequential-thinking)
```

</details>

<!-- suggestion_start -->

<details>
<summary>📝 Committable suggestion</summary>

> ‼️ **IMPORTANT**
> Carefully review the code before committing. Ensure that it accurately replaces the highlighted code, contains no missing lines, and has no issues with indentation. Thoroughly test & benchmark the code to ensure it meets the requirements.

```suggestion
- `.agents/rules/MCP.md` — Available MCP servers (context7, GitHub, sequential-thinking)
```

</details>

<!-- suggestion_end -->

<details>
<summary>🧰 Tools</summary>

<details>
<summary>🪛 LanguageTool</summary>

[uncategorized] ~11-~11: The official name of this software platform is spelled with a capital “H”.
Context: ....md` — Available MCP servers (context7, github, sequential-thinking) - `.agents/rules/...

(GITHUB)

</details>

</details>

<details>
<summary>🤖 Prompt for AI Agents</summary>

```
In .codex/AGENTS.md around line 11, the entry lists `github` in lowercase;
update it to the proper product name `GitHub` (capitalize the "G" and "H") so
the line reads `.agents/rules/MCP.md` — Available MCP servers (context7, GitHub,
sequential-thinking); keep formatting consistent and scan the file for any other
lowercase `github` occurrences and fix them similarly.
```

</details>

<!-- fingerprinting:phantom:triton:mongoose -->

<!-- This is an auto-generated comment by CodeRabbit -->

---

### @[object Object] • Dec 30, 2025 at 11:28 AM • commented

**Actionable comments posted: 1**

<details>
<summary>📜 Review details</summary>

**Configuration used**: Path: .coderabbit.yaml

**Review profile**: CHILL

**Plan**: Pro

<details>
<summary>📥 Commits</summary>

Reviewing files that changed from the base of the PR and between daed1e86a32f854cd3902ad2687a7e6888e4c88e and a09c6276b1fb8632032b4c7d44bcd49389bb07f3.

</details>

<details>
<summary>📒 Files selected for processing (14)</summary>

- `.agents/plans/v1/AUDIT.md`
- `.agents/plans/v1/PLAN.md`
- `.claude/settings.json`
- `.codex/AGENTS.md`
- `.gitattributes`
- `.gitignore`
- `AGENTS.md`
- `CLAUDE.md`
- `CLAUDE.md`
- `IMPROVEMENTS.md`
- `PLAN.md`
- `PRD.md`
- `SCRATCHPAD.md`
- `docs/waymark/tui-ab-plan.md`

</details>

<details>
<summary>💤 Files with no reviewable changes (4)</summary>

- IMPROVEMENTS.md
- PLAN.md
- SCRATCHPAD.md
- PRD.md

</details>

<details>
<summary>✅ Files skipped from review due to trivial changes (2)</summary>

- CLAUDE.md
- .agents/plans/v1/PLAN.md

</details>

<details>
<summary>🚧 Files skipped from review as they are similar to previous changes (6)</summary>

- .agents/plans/v1/AUDIT.md
- .claude/settings.json
- .gitattributes
- .gitignore
- CLAUDE.md
- docs/waymark/tui-ab-plan.md

</details>

<details>
<summary>🧰 Additional context used</summary>

<details>
<summary>📓 Path-based instructions (3)</summary>

<details>
<summary>AGENTS.md</summary>

**📄 CodeRabbit inference engine (CLAUDE.md)**

> Document agent implementations, capabilities, and design patterns in AGENTS.md

Files:

- `AGENTS.md`

</details>
<details>
<summary>**/*.md</summary>

**📄 CodeRabbit inference engine (AGENTS.md)**

> `**/*.md`: All markdown files should have `<!-- tldr ::: <short description> -->` at the top
> Use contextual waymarks like `<!-- note ::: <description> -->` or `<!-- summary ::: <description> -->` in markdown documentation
> Keep markdown documentation focused and scannable with clear linking to related docs

Files:

- `AGENTS.md`

</details>
<details>
<summary>**/*.{md,html,xml}</summary>

**📄 CodeRabbit inference engine (AGENTS.md)**

> Follow the `:::` sigil syntax in markdown comments (space before when prefix present)

Files:

- `AGENTS.md`

</details>

</details><details>
<summary>🪛 LanguageTool</summary>

<details>
<summary>.codex/AGENTS.md</summary>

[uncategorized] ~11-~11: The official name of this software platform is spelled with a capital “H”.
Context: ....md` — Available MCP servers (context7, github, sequential-thinking) - `.agents/rules/...

(GITHUB)

</details>

</details>

</details>

<details>
<summary>⏰ Context from checks skipped due to timeout of 90000ms. You can increase the timeout in your CodeRabbit configuration to a maximum of 15 minutes (900000ms). (4)</summary>

- GitHub Check: Graphite / mergeability_check
- GitHub Check: Graphite / mergeability_check
- GitHub Check: Graphite / mergeability_check
- GitHub Check: Graphite / mergeability_check

</details>

<details>
<summary>🔇 Additional comments (3)</summary><blockquote>

<details>
<summary>AGENTS.md (3)</summary><blockquote>

`33-61`: **Best Practices and Quality Checks sections are well-structured and actionable.**

The guidance on contributing conventions (lines 33-45), MCP server expectations (lines 46-51), and pre-push quality checks (lines 53-61) is clear and practical. The tiered CI check options (local simulation → comprehensive → quick validation) provides good flexibility.

---

`63-93`: **Documentation Standards and Examples sections provide excellent reference material.**

The documentation standards (lines 63-68) directly align with the coding guidelines, and the examples (lines 71-93) comprehensively demonstrate waymark usage patterns with proper syntax. This section will serve as a strong reference for developers adding waymarks to new code.

---

`27-31`: All referenced documentation files and directories are present in the repository: `docs/about/priors.md` exists (59 lines), `.agents/rules/` contains 21 markdown files, and `.waymark/rules/` contains 5 markdown files. The references in lines 27-31 are valid and do not require correction.

</blockquote></details>

</blockquote></details>

</details>

<!-- This is an auto-generated comment by CodeRabbit for review status -->

---

## CI Checks (0)

*No CI checks*
