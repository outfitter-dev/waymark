// tldr ::: PowerShell completion generator for waymark CLI

import type { CompletionGenerator, GeneratorOptions } from "./types.ts";

export class PowerShellGenerator implements CompletionGenerator {
  private readonly options: GeneratorOptions;

  constructor(options: GeneratorOptions) {
    this.options = options;
  }

  getFilename(): string {
    return "wm.ps1";
  }

  generate(): string {
    const types = this.options.types;
    const typesArray = types.map((t) => `'${t}'`).join(", ");

    return `# tldr ::: PowerShell completion script for waymark CLI

using namespace System.Management.Automation
using namespace System.Management.Automation.Language

Register-ArgumentCompleter -Native -CommandName 'wm' -ScriptBlock {
    param($wordToComplete, $commandAst, $cursorPosition)

    $commandElements = $commandAst.CommandElements
    $command = @(
        'wm'
        for ($i = 1; $i -lt $commandElements.Count; $i++) {
            $element = $commandElements[$i]
            if ($element -isnot [StringConstantExpressionAst] -or
                $element.StringConstantType -ne [StringConstantType]::BareWord -or
                $element.Value.StartsWith('-')) {
                break
            }
            $element.Value
        }
    ) -join ';'

    $completions = @(switch ($command) {
        'wm' {
            [CompletionResult]::new('-v', 'v', [CompletionResultType]::ParameterName, 'Output version number')
            [CompletionResult]::new('--version', 'version', [CompletionResultType]::ParameterName, 'Output version number')
            [CompletionResult]::new('--scope', 'scope', [CompletionResultType]::ParameterName, 'Config scope')
            [CompletionResult]::new('--verbose', 'verbose', [CompletionResultType]::ParameterName, 'Enable verbose logging')
            [CompletionResult]::new('--debug', 'debug', [CompletionResultType]::ParameterName, 'Enable debug logging')
            [CompletionResult]::new('-q', 'q', [CompletionResultType]::ParameterName, 'Only show errors')
            [CompletionResult]::new('--quiet', 'quiet', [CompletionResultType]::ParameterName, 'Only show errors')
            [CompletionResult]::new('-h', 'h', [CompletionResultType]::ParameterName, 'Display help')
            [CompletionResult]::new('--help', 'help', [CompletionResultType]::ParameterName, 'Display help')
            [CompletionResult]::new('--prompt', 'prompt', [CompletionResultType]::ParameterName, 'Show agent-facing documentation')
            [CompletionResult]::new('-t', 't', [CompletionResultType]::ParameterName, 'Filter by waymark type')
            [CompletionResult]::new('--type', 'type', [CompletionResultType]::ParameterName, 'Filter by waymark type')
            [CompletionResult]::new('--tag', 'tag', [CompletionResultType]::ParameterName, 'Filter by hashtag')
            [CompletionResult]::new('--mention', 'mention', [CompletionResultType]::ParameterName, 'Filter by mention')
            [CompletionResult]::new('-r', 'r', [CompletionResultType]::ParameterName, 'Show only raised waymarks')
            [CompletionResult]::new('--raised', 'raised', [CompletionResultType]::ParameterName, 'Show only raised waymarks')
            [CompletionResult]::new('-s', 's', [CompletionResultType]::ParameterName, 'Show only important waymarks')
            [CompletionResult]::new('--starred', 'starred', [CompletionResultType]::ParameterName, 'Show only important waymarks')
            [CompletionResult]::new('--map', 'map', [CompletionResultType]::ParameterName, 'Show file tree with TLDRs')
            [CompletionResult]::new('--graph', 'graph', [CompletionResultType]::ParameterName, 'Show dependency graph')
            [CompletionResult]::new('--summary', 'summary', [CompletionResultType]::ParameterName, 'Show summary footer')
            [CompletionResult]::new('--json', 'json', [CompletionResultType]::ParameterName, 'Output as JSON')
            [CompletionResult]::new('--jsonl', 'jsonl', [CompletionResultType]::ParameterName, 'Output as JSON Lines')
            [CompletionResult]::new('--pretty', 'pretty', [CompletionResultType]::ParameterName, 'Output as pretty JSON')
            [CompletionResult]::new('--long', 'long', [CompletionResultType]::ParameterName, 'Show detailed information')
            [CompletionResult]::new('--tree', 'tree', [CompletionResultType]::ParameterName, 'Group by directory')
            [CompletionResult]::new('--flat', 'flat', [CompletionResultType]::ParameterName, 'Show flat list')
            [CompletionResult]::new('--keep-comment-markers', 'keep-comment-markers', [CompletionResultType]::ParameterName, 'Keep comment syntax')
            [CompletionResult]::new('--compact', 'compact', [CompletionResultType]::ParameterName, 'Compact output')
            [CompletionResult]::new('--no-color', 'no-color', [CompletionResultType]::ParameterName, 'Disable colors')
            [CompletionResult]::new('--group', 'group', [CompletionResultType]::ParameterName, 'Group by')
            [CompletionResult]::new('--sort', 'sort', [CompletionResultType]::ParameterName, 'Sort by')
            [CompletionResult]::new('-C', 'C', [CompletionResultType]::ParameterName, 'Context lines')
            [CompletionResult]::new('--context', 'context', [CompletionResultType]::ParameterName, 'Context lines')
            [CompletionResult]::new('-A', 'A', [CompletionResultType]::ParameterName, 'Lines after')
            [CompletionResult]::new('--after', 'after', [CompletionResultType]::ParameterName, 'Lines after')
            [CompletionResult]::new('-B', 'B', [CompletionResultType]::ParameterName, 'Lines before')
            [CompletionResult]::new('--before', 'before', [CompletionResultType]::ParameterName, 'Lines before')
            [CompletionResult]::new('--limit', 'limit', [CompletionResultType]::ParameterName, 'Limit results')
            [CompletionResult]::new('--page', 'page', [CompletionResultType]::ParameterName, 'Page number')
            [CompletionResult]::new('format', 'format', [CompletionResultType]::ParameterValue, 'Format waymarks in a file')
            [CompletionResult]::new('insert', 'insert', [CompletionResultType]::ParameterValue, 'Insert waymarks into files')
            [CompletionResult]::new('modify', 'modify', [CompletionResultType]::ParameterValue, 'Modify existing waymarks')
            [CompletionResult]::new('remove', 'remove', [CompletionResultType]::ParameterValue, 'Remove waymarks from files')
            [CompletionResult]::new('lint', 'lint', [CompletionResultType]::ParameterValue, 'Validate waymark structure')
            [CompletionResult]::new('migrate', 'migrate', [CompletionResultType]::ParameterValue, 'Migrate legacy comments')
            [CompletionResult]::new('init', 'init', [CompletionResultType]::ParameterValue, 'Initialize waymark config')
            [CompletionResult]::new('update', 'update', [CompletionResultType]::ParameterValue, 'Update CLI to latest version')
            [CompletionResult]::new('help', 'help', [CompletionResultType]::ParameterValue, 'Display help for command')
            break
        }
        'wm;format' {
            [CompletionResult]::new('-w', 'w', [CompletionResultType]::ParameterName, 'Write changes to file')
            [CompletionResult]::new('--write', 'write', [CompletionResultType]::ParameterName, 'Write changes to file')
            [CompletionResult]::new('-h', 'h', [CompletionResultType]::ParameterName, 'Display help')
            [CompletionResult]::new('--help', 'help', [CompletionResultType]::ParameterName, 'Display help')
            [CompletionResult]::new('--prompt', 'prompt', [CompletionResultType]::ParameterName, 'Show agent-facing documentation')
            break
        }
        'wm;insert' {
            [CompletionResult]::new('--from', 'from', [CompletionResultType]::ParameterName, 'Read from JSON file')
            [CompletionResult]::new('--mention', 'mention', [CompletionResultType]::ParameterName, 'Add mention')
            [CompletionResult]::new('--tag', 'tag', [CompletionResultType]::ParameterName, 'Add hashtag')
            [CompletionResult]::new('--property', 'property', [CompletionResultType]::ParameterName, 'Add property')
            [CompletionResult]::new('--ref', 'ref', [CompletionResultType]::ParameterName, 'Set canonical reference')
            [CompletionResult]::new('--depends', 'depends', [CompletionResultType]::ParameterName, 'Add dependency')
            [CompletionResult]::new('--needs', 'needs', [CompletionResultType]::ParameterName, 'Add needs relation')
            [CompletionResult]::new('--blocks', 'blocks', [CompletionResultType]::ParameterName, 'Add blocks relation')
            [CompletionResult]::new('--signal', 'signal', [CompletionResultType]::ParameterName, 'Add signal')
            [CompletionResult]::new('--json', 'json', [CompletionResultType]::ParameterName, 'Output as JSON')
            [CompletionResult]::new('--jsonl', 'jsonl', [CompletionResultType]::ParameterName, 'Output as JSON Lines')
            [CompletionResult]::new('-h', 'h', [CompletionResultType]::ParameterName, 'Display help')
            [CompletionResult]::new('--help', 'help', [CompletionResultType]::ParameterName, 'Display help')
            [CompletionResult]::new('--prompt', 'prompt', [CompletionResultType]::ParameterName, 'Show agent-facing documentation')
            break
        }
        'wm;modify' {
            [CompletionResult]::new('--id', 'id', [CompletionResultType]::ParameterName, 'Modify by waymark ID')
            [CompletionResult]::new('--type', 'type', [CompletionResultType]::ParameterName, 'Change waymark type')
            [CompletionResult]::new('--raise', 'raise', [CompletionResultType]::ParameterName, 'Add raised signal')
            [CompletionResult]::new('--important', 'important', [CompletionResultType]::ParameterName, 'Add important signal')
            [CompletionResult]::new('--no-signal', 'no-signal', [CompletionResultType]::ParameterName, 'Remove all signals')
            [CompletionResult]::new('--content', 'content', [CompletionResultType]::ParameterName, 'Replace content')
            [CompletionResult]::new('-w', 'w', [CompletionResultType]::ParameterName, 'Apply modifications')
            [CompletionResult]::new('--write', 'write', [CompletionResultType]::ParameterName, 'Apply modifications')
            [CompletionResult]::new('--interactive', 'interactive', [CompletionResultType]::ParameterName, 'Interactive flow')
            [CompletionResult]::new('--json', 'json', [CompletionResultType]::ParameterName, 'Output as JSON')
            [CompletionResult]::new('--jsonl', 'jsonl', [CompletionResultType]::ParameterName, 'Output as JSON Lines')
            [CompletionResult]::new('-h', 'h', [CompletionResultType]::ParameterName, 'Display help')
            [CompletionResult]::new('--help', 'help', [CompletionResultType]::ParameterName, 'Display help')
            [CompletionResult]::new('--prompt', 'prompt', [CompletionResultType]::ParameterName, 'Show agent-facing documentation')
            break
        }
        'wm;remove' {
            [CompletionResult]::new('-w', 'w', [CompletionResultType]::ParameterName, 'Actually remove')
            [CompletionResult]::new('--write', 'write', [CompletionResultType]::ParameterName, 'Actually remove')
            [CompletionResult]::new('--id', 'id', [CompletionResultType]::ParameterName, 'Remove by ID')
            [CompletionResult]::new('--from', 'from', [CompletionResultType]::ParameterName, 'Read from JSON file')
            [CompletionResult]::new('--criteria', 'criteria', [CompletionResultType]::ParameterName, 'Filter criteria')
            [CompletionResult]::new('--yes', 'yes', [CompletionResultType]::ParameterName, 'Skip confirmation')
            [CompletionResult]::new('--confirm', 'confirm', [CompletionResultType]::ParameterName, 'Force confirmation')
            [CompletionResult]::new('--json', 'json', [CompletionResultType]::ParameterName, 'Output as JSON')
            [CompletionResult]::new('--jsonl', 'jsonl', [CompletionResultType]::ParameterName, 'Output as JSON Lines')
            [CompletionResult]::new('-h', 'h', [CompletionResultType]::ParameterName, 'Display help')
            [CompletionResult]::new('--help', 'help', [CompletionResultType]::ParameterName, 'Display help')
            [CompletionResult]::new('--prompt', 'prompt', [CompletionResultType]::ParameterName, 'Show agent-facing documentation')
            break
        }
        'wm;lint' {
            [CompletionResult]::new('--json', 'json', [CompletionResultType]::ParameterName, 'Output as JSON')
            [CompletionResult]::new('-h', 'h', [CompletionResultType]::ParameterName, 'Display help')
            [CompletionResult]::new('--help', 'help', [CompletionResultType]::ParameterName, 'Display help')
            [CompletionResult]::new('--prompt', 'prompt', [CompletionResultType]::ParameterName, 'Show agent-facing documentation')
            break
        }
        'wm;migrate' {
            [CompletionResult]::new('-w', 'w', [CompletionResultType]::ParameterName, 'Write changes to file')
            [CompletionResult]::new('--write', 'write', [CompletionResultType]::ParameterName, 'Write changes to file')
            [CompletionResult]::new('-h', 'h', [CompletionResultType]::ParameterName, 'Display help')
            [CompletionResult]::new('--help', 'help', [CompletionResultType]::ParameterName, 'Display help')
            [CompletionResult]::new('--prompt', 'prompt', [CompletionResultType]::ParameterName, 'Show agent-facing documentation')
            break
        }
        'wm;init' {
            [CompletionResult]::new('-f', 'f', [CompletionResultType]::ParameterName, 'Config format')
            [CompletionResult]::new('--format', 'format', [CompletionResultType]::ParameterName, 'Config format')
            [CompletionResult]::new('-p', 'p', [CompletionResultType]::ParameterName, 'Config preset')
            [CompletionResult]::new('--preset', 'preset', [CompletionResultType]::ParameterName, 'Config preset')
            [CompletionResult]::new('-s', 's', [CompletionResultType]::ParameterName, 'Config scope')
            [CompletionResult]::new('--scope', 'scope', [CompletionResultType]::ParameterName, 'Config scope')
            [CompletionResult]::new('--force', 'force', [CompletionResultType]::ParameterName, 'Overwrite existing')
            [CompletionResult]::new('-h', 'h', [CompletionResultType]::ParameterName, 'Display help')
            [CompletionResult]::new('--help', 'help', [CompletionResultType]::ParameterName, 'Display help')
            break
        }
        'wm;update' {
            [CompletionResult]::new('--dry-run', 'dry-run', [CompletionResultType]::ParameterName, 'Print command without executing')
            [CompletionResult]::new('--force', 'force', [CompletionResultType]::ParameterName, 'Run even if install method unknown')
            [CompletionResult]::new('--yes', 'yes', [CompletionResultType]::ParameterName, 'Skip confirmation')
            [CompletionResult]::new('--command', 'command', [CompletionResultType]::ParameterName, 'Override update command')
            [CompletionResult]::new('-h', 'h', [CompletionResultType]::ParameterName, 'Display help')
            [CompletionResult]::new('--help', 'help', [CompletionResultType]::ParameterName, 'Display help')
            break
        }
        'wm;help' {
            [CompletionResult]::new('format', 'format', [CompletionResultType]::ParameterValue, 'Format command')
            [CompletionResult]::new('insert', 'insert', [CompletionResultType]::ParameterValue, 'Insert command')
            [CompletionResult]::new('modify', 'modify', [CompletionResultType]::ParameterValue, 'Modify command')
            [CompletionResult]::new('remove', 'remove', [CompletionResultType]::ParameterValue, 'Remove command')
            [CompletionResult]::new('lint', 'lint', [CompletionResultType]::ParameterValue, 'Lint command')
            [CompletionResult]::new('migrate', 'migrate', [CompletionResultType]::ParameterValue, 'Migrate command')
            [CompletionResult]::new('init', 'init', [CompletionResultType]::ParameterValue, 'Init command')
            [CompletionResult]::new('update', 'update', [CompletionResultType]::ParameterValue, 'Update command')
            [CompletionResult]::new('help', 'help', [CompletionResultType]::ParameterValue, 'Help command')
            break
        }
    })

    # Handle parameter value completions
    if ($commandElements.Count -gt 1) {
        $lastElement = $commandElements[-1]
        $lastParam = $commandElements[-2]

        if ($lastParam -match '^--(type|t)$') {
            $types = @(${typesArray})
            $types | ForEach-Object {
                [CompletionResult]::new($_, $_, [CompletionResultType]::ParameterValue, "Type: $_")
            }
        }
        elseif ($lastParam -match '^--scope$') {
            @('default', 'project', 'user') | ForEach-Object {
                [CompletionResult]::new($_, $_, [CompletionResultType]::ParameterValue, "Scope: $_")
            }
        }
        elseif ($lastParam -match '^--group$') {
            @('file', 'dir', 'type') | ForEach-Object {
                [CompletionResult]::new($_, $_, [CompletionResultType]::ParameterValue, "Group by: $_")
            }
        }
        elseif ($lastParam -match '^--sort$') {
            @('file', 'line', 'type', 'modified') | ForEach-Object {
                [CompletionResult]::new($_, $_, [CompletionResultType]::ParameterValue, "Sort by: $_")
            }
        }
        elseif ($lastParam -match '^--signal$') {
            @('^', '*') | ForEach-Object {
                [CompletionResult]::new($_, $_, [CompletionResultType]::ParameterValue, "Signal: $_")
            }
        }
        elseif ($lastParam -match '^--(format|f)$') {
            @('toml', 'jsonc', 'yaml', 'yml') | ForEach-Object {
                [CompletionResult]::new($_, $_, [CompletionResultType]::ParameterValue, "Format: $_")
            }
        }
        elseif ($lastParam -match '^--(preset|p)$') {
            @('full', 'minimal') | ForEach-Object {
                [CompletionResult]::new($_, $_, [CompletionResultType]::ParameterValue, "Preset: $_")
            }
        }
    }

    $completions.Where{ $_.CompletionText -like "$wordToComplete*" } |
        Sort-Object -Property ListItemText
}
`;
  }
}
