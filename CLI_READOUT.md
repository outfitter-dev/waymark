<!-- tldr ::: working concepts for for #v0.1 CLI output -->
# CLI Readout Improvements

## Notes

- Let's improve the CLI output by updating its formatting.

## General thoughts

- Let's adopt a cleaner output format for non-JSON output, unless --keep-comment-markers is flagged (or a config option is enabled)
- Let's strip the comment artifacts (`//`, `<!-- ... -->`, etc.)
- Any content OUTSIDE of the comment markers should be stripped
  - e.g. `yaml_key: value # todo ::: fix this` would be reduced to `todo ::: fix this`
- Let's ensure that any leading and trailing whitespace is removed from the output
- Always maintain one line break between a file+waymarks block
- Always put the waymark content on a new line after the filename/path, except when `--compact` is enabled

## Style use

- Let's use Chalk for the colors and text styling in the CLI
- Waymark type-specific colors to differentiate types visually
  - `task`: `yellow`
  <!-- todo ::: @agent let's rename the `work` type to `todo` -->
  - `info`: `blue`
    - `tldr`: `greenBright`
    - `this`: `green`
  - `caution`: `magenta`
    - `alert`: `red`
  - `workflow`:
    - `blocked`: `redBright`
    - `needs`: `yellow`
  - `inquiry`: `yellow`
- File titles should be styled with `underline`
- `@` mentions should be styled with `bold` and `yellow`
  - NOTE: We must ensure that `@` mentions are distinguished from `@scope` to not visually style `@scope/text` as a mentions
    - This can be done with a simple heuristic: `@mentions` NEVER have a `/` or `:` in them, where `@scope` ALWAYS has a `/`
- `#` tags should be styled with `bold` and `cyan`
- `@scope/text` should be styled with `bold` and `cyan` (extending to those with `^v...` in them too)
- `[props]:` should be styled with `dim`
  - NOTE: `#text:subtext` should be still treated as tags
- The `:::` sigil should be styled with `dim`, and never `bold`
- Line numbers and trailing `:` should be styled with `dim`
- Signaled types (`*todo :::`, `^wip :::` should get an underline below the text, but not the symbol)
  - And we should bold the signal and type text.

## List output

- Goal: Adopt a cleaner output format for the list, similar to `rg`
- Style notes:
  - ALWAYS indent by two spaces after the line number and trailing `:`
  - If multiple waymarks are indentified in a given file, indent the beginning of all waymark content to the same character start
    - The first character of the waymark content should start at n+4, where `n` is the number of characters for the greatest line number in the file.

Example:

```text
.waymark/rules/WAYMARKS.md
209:  tldr ::: Bun-based CLI PRD defining v1.0 scope and requirements #docs/prd

packages/grammar/src/parser.test.ts
15:   todo ::: implement cache invalidation #arch/state
90:   todo ::: implement streaming parser
189:  todo ::: actual waymark
249:  todo ::: first waymark
278:  todo ::: multi-line task

example/file.md
99:   info ::: this is just an example that spans multiple lines
100:       ::: we should always keep the `:::` sigil at the same indentation level for all waymarks that are multiline
101:       ::: this means that we should judge the start of the `:::` by the greatest line number
102:  todo ::: multi-line waymarks without text before the `:::` are indented. Multiline waymarks with props preceding the `:::` are included in this scheme, but maintain their props
```
