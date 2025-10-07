# tldr ::: PowerShell completion script for waymark CLI

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
                $element.Value.StartsWith('-') -or
                $element.Value -eq $wordToComplete) {
                break
            }
            $element.Value
        }
    ) -join ';'

    $completions = @(switch ($command) {
        'wm' {
            [CompletionResult]::new('format', 'format', [CompletionResultType]::ParameterValue, 'Format waymarks in a file')
            [CompletionResult]::new('insert', 'insert', [CompletionResultType]::ParameterValue, 'Insert waymarks into files')
            [CompletionResult]::new('modify', 'modify', [CompletionResultType]::ParameterValue, 'Modify existing waymarks')
            [CompletionResult]::new('remove', 'remove', [CompletionResultType]::ParameterValue, 'Remove waymarks from files')
            [CompletionResult]::new('lint', 'lint', [CompletionResultType]::ParameterValue, 'Validate waymark structure')
            [CompletionResult]::new('migrate', 'migrate', [CompletionResultType]::ParameterValue, 'Migrate legacy comments')
            [CompletionResult]::new('init', 'init', [CompletionResultType]::ParameterValue, 'Initialize waymark config')
            [CompletionResult]::new('update', 'update', [CompletionResultType]::ParameterValue, 'Update CLI to latest version')
            [CompletionResult]::new('help', 'help', [CompletionResultType]::ParameterValue, 'Display help for command')
            [CompletionResult]::new('--version', 'version', [CompletionResultType]::ParameterName, 'Output version number')
            [CompletionResult]::new('-v', 'v', [CompletionResultType]::ParameterName, 'Output version number')
            [CompletionResult]::new('--scope', 'scope', [CompletionResultType]::ParameterName, 'Config scope')
            [CompletionResult]::new('--verbose', 'verbose', [CompletionResultType]::ParameterName, 'Enable verbose logging')
            [CompletionResult]::new('--debug', 'debug', [CompletionResultType]::ParameterName, 'Enable debug logging')
            [CompletionResult]::new('--quiet', 'quiet', [CompletionResultType]::ParameterName, 'Only show errors')
            [CompletionResult]::new('-q', 'q', [CompletionResultType]::ParameterName, 'Only show errors')
            [CompletionResult]::new('--help', 'help', [CompletionResultType]::ParameterName, 'Display help')
            [CompletionResult]::new('-h', 'h', [CompletionResultType]::ParameterName, 'Display help')
            [CompletionResult]::new('--prompt', 'prompt', [CompletionResultType]::ParameterName, 'Show agent-facing documentation')
            [CompletionResult]::new('--type', 'type', [CompletionResultType]::ParameterName, 'Filter by waymark type')
            [CompletionResult]::new('-t', 't', [CompletionResultType]::ParameterName, 'Filter by waymark type')
            [CompletionResult]::new('--tag', 'tag', [CompletionResultType]::ParameterName, 'Filter by hashtag')
            [CompletionResult]::new('--mention', 'mention', [CompletionResultType]::ParameterName, 'Filter by mention')
            [CompletionResult]::new('--raised', 'raised', [CompletionResultType]::ParameterName, 'Show only raised waymarks')
            [CompletionResult]::new('-r', 'r', [CompletionResultType]::ParameterName, 'Show only raised waymarks')
            [CompletionResult]::new('--starred', 'starred', [CompletionResultType]::ParameterName, 'Show only important waymarks')
            [CompletionResult]::new('-s', 's', [CompletionResultType]::ParameterName, 'Show only important waymarks')
            [CompletionResult]::new('--map', 'map', [CompletionResultType]::ParameterName, 'Show file tree with TLDRs')
            [CompletionResult]::new('--graph', 'graph', [CompletionResultType]::ParameterName, 'Show dependency graph')
            [CompletionResult]::new('--json', 'json', [CompletionResultType]::ParameterName, 'Output as JSON')
            [CompletionResult]::new('--jsonl', 'jsonl', [CompletionResultType]::ParameterName, 'Output as JSON Lines')
            [CompletionResult]::new('--pretty', 'pretty', [CompletionResultType]::ParameterName, 'Output as pretty JSON')
            [CompletionResult]::new('--long', 'long', [CompletionResultType]::ParameterName, 'Show detailed information')
            [CompletionResult]::new('--tree', 'tree', [CompletionResultType]::ParameterName, 'Group by directory')
            [CompletionResult]::new('--flat', 'flat', [CompletionResultType]::ParameterName, 'Show flat list')
            [CompletionResult]::new('--group', 'group', [CompletionResultType]::ParameterName, 'Group by')
            [CompletionResult]::new('--sort', 'sort', [CompletionResultType]::ParameterName, 'Sort by')
            [CompletionResult]::new('--limit', 'limit', [CompletionResultType]::ParameterName, 'Limit results')
            [CompletionResult]::new('--page', 'page', [CompletionResultType]::ParameterName, 'Page number')
            break
        }
        'wm;format' {
            [CompletionResult]::new('--write', 'write', [CompletionResultType]::ParameterName, 'Write changes to file')
            [CompletionResult]::new('-w', 'w', [CompletionResultType]::ParameterName, 'Write changes to file')
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
            break
        }
        'wm;modify' {
            [CompletionResult]::new('--id', 'id', [CompletionResultType]::ParameterName, 'Modify by waymark ID')
            [CompletionResult]::new('--type', 'type', [CompletionResultType]::ParameterName, 'Change waymark type')
            [CompletionResult]::new('--raise', 'raise', [CompletionResultType]::ParameterName, 'Add raised signal')
            [CompletionResult]::new('--important', 'important', [CompletionResultType]::ParameterName, 'Add important signal')
            [CompletionResult]::new('--no-signal', 'no-signal', [CompletionResultType]::ParameterName, 'Remove all signals')
            [CompletionResult]::new('--content', 'content', [CompletionResultType]::ParameterName, 'Replace content (use - for stdin)')
            [CompletionResult]::new('--write', 'write', [CompletionResultType]::ParameterName, 'Apply modifications')
            [CompletionResult]::new('-w', 'w', [CompletionResultType]::ParameterName, 'Apply modifications')
            [CompletionResult]::new('--interactive', 'interactive', [CompletionResultType]::ParameterName, 'Interactive flow')
            [CompletionResult]::new('--json', 'json', [CompletionResultType]::ParameterName, 'Output as JSON')
            [CompletionResult]::new('--jsonl', 'jsonl', [CompletionResultType]::ParameterName, 'Output as JSON Lines')
            break
        }
        'wm;remove' {
            [CompletionResult]::new('--write', 'write', [CompletionResultType]::ParameterName, 'Actually remove')
            [CompletionResult]::new('-w', 'w', [CompletionResultType]::ParameterName, 'Actually remove')
            [CompletionResult]::new('--id', 'id', [CompletionResultType]::ParameterName, 'Remove by ID')
            [CompletionResult]::new('--from', 'from', [CompletionResultType]::ParameterName, 'Read from JSON file')
            [CompletionResult]::new('--criteria', 'criteria', [CompletionResultType]::ParameterName, 'Filter criteria')
            [CompletionResult]::new('--yes', 'yes', [CompletionResultType]::ParameterName, 'Skip confirmation')
            [CompletionResult]::new('--confirm', 'confirm', [CompletionResultType]::ParameterName, 'Force confirmation')
            [CompletionResult]::new('--json', 'json', [CompletionResultType]::ParameterName, 'Output as JSON')
            [CompletionResult]::new('--jsonl', 'jsonl', [CompletionResultType]::ParameterName, 'Output as JSON Lines')
            break
        }
        'wm;lint' {
            [CompletionResult]::new('--json', 'json', [CompletionResultType]::ParameterName, 'Output as JSON')
            break
        }
        'wm;migrate' {
            [CompletionResult]::new('--write', 'write', [CompletionResultType]::ParameterName, 'Write changes to file')
            [CompletionResult]::new('-w', 'w', [CompletionResultType]::ParameterName, 'Write changes to file')
            break
        }
        'wm;init' {
            [CompletionResult]::new('--format', 'format', [CompletionResultType]::ParameterName, 'Config format')
            [CompletionResult]::new('-f', 'f', [CompletionResultType]::ParameterName, 'Config format')
            [CompletionResult]::new('--preset', 'preset', [CompletionResultType]::ParameterName, 'Config preset')
            [CompletionResult]::new('-p', 'p', [CompletionResultType]::ParameterName, 'Config preset')
            [CompletionResult]::new('--scope', 'scope', [CompletionResultType]::ParameterName, 'Config scope')
            [CompletionResult]::new('-s', 's', [CompletionResultType]::ParameterName, 'Config scope')
            [CompletionResult]::new('--force', 'force', [CompletionResultType]::ParameterName, 'Overwrite existing')
            break
        }
        'wm;update' {
            [CompletionResult]::new('--dry-run', 'dry-run', [CompletionResultType]::ParameterName, 'Print command without executing')
            [CompletionResult]::new('--force', 'force', [CompletionResultType]::ParameterName, 'Run even if install method unknown')
            [CompletionResult]::new('--yes', 'yes', [CompletionResultType]::ParameterName, 'Skip confirmation')
            [CompletionResult]::new('--command', 'command', [CompletionResultType]::ParameterName, 'Override update command')
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

    $completions.Where{ $_.CompletionText -like "$wordToComplete*" } |
        Sort-Object -Property ListItemText
}
